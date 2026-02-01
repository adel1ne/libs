import { inject, injectable } from 'inversify'
import mongoose, { Connection, ConnectOptions, MongooseOptions } from 'mongoose'
import { Shutdownable } from '../shutdown'
import { LoggerService } from '../../utils/logger'

export interface DatabaseConfig {
    uri: string
    options?: ConnectOptions
    mongooseOptions?: MongooseOptions
}

export interface ConnectionStatus {
    isConnected: boolean
    isConnecting: boolean
    isDisconnecting: boolean
    readyState: number
}

@injectable()
export class DatabaseManager implements Shutdownable {
    private readonly randomId = crypto.randomUUID()
    private connectionPromise: Promise<Connection> | null = null
    private config: DatabaseConfig | null = null
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectDelay = 1000
    private isShuttingDown = false

    constructor(
        private readonly logger: LoggerService,
    ) {
        this.setupGlobalMongooseOptions()
        this.logger.info(`[SUCCESS] DatabaseManager initialized with randomId: ${this.randomId}`)
    }

    /**
     * Устанавливает глобальные опции Mongoose
     */
    private setupGlobalMongooseOptions(): void {
        // Отключаем глобальное буферирование команд для лучшего контроля
        mongoose.set('bufferCommands', false)
        
        // Включаем строгий режим для запросов
        mongoose.set('strictQuery', true)
        
        mongoose.set('autoIndex', false)
    }

    /**
     * Создает и устанавливает глобальное подключение к MongoDB
     */
    async connect(config: DatabaseConfig): Promise<Connection> {
        if (mongoose.connection.readyState === 1) {
            return mongoose.connection
        }

        if (this.connectionPromise) {
            return this.connectionPromise
        }

        this.config = config
        this.connectionPromise = this.createGlobalConnection()
        return this.connectionPromise
    }

    /**
     * Проверяет наличие конфигурации и возвращает её
     * @throws Error если конфигурация не установлена
     */
    private ensureConfig(): DatabaseConfig {
        if (!this.config) {
            throw new Error('Database configuration not set. Call connect() first.')
        }
        return this.config
    }

    /**
     * Создает глобальное подключение с настройками
     */
    private async createGlobalConnection(): Promise<Connection> {
        try {
            const config = this.ensureConfig()
            const defaultOptions: ConnectOptions = {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                heartbeatFrequencyMS: 10000,
                family: 4, // Принудительно использовать IPv4 для лучшей совместимости
                ...config.options,
            }

            // Используем глобальное подключение mongoose.connect()
            this.logger.info(`[PROCESSING] Connecting to MongoDB with URI: ${config.uri}`)
            await mongoose.connect(config.uri, defaultOptions)
            
            // Настраиваем обработчики событий для глобального подключения
            this.setupGlobalConnectionEventHandlers()
            
            this.logger.info(`[SUCCESS] MongoDB connected successfully to: ${config.uri}`)
            
            return mongoose.connection
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Failed to connect to MongoDB')
            this.connectionPromise = null
            throw error
        }
    }

    /**
     * Настраивает обработчики событий для глобального подключения
     */
    private setupGlobalConnectionEventHandlers(): void {
        mongoose.connection.on('connected', () => {
            this.logger.info('[SUCCESS] MongoDB connection established')
            this.reconnectAttempts = 0
            this.isShuttingDown = false // Сбрасываем флаг при успешном подключении
        })

        mongoose.connection.on('open', () => {
            this.logger.info('[SUCCESS] MongoDB connection opened')
        })

        mongoose.connection.on('disconnected', () => {
            this.logger.warn('[WARNING] MongoDB connection disconnected')
            this.handleDisconnection()
        })

        mongoose.connection.on('reconnected', () => {
            this.logger.info('[SUCCESS] MongoDB connection reconnected')
            this.reconnectAttempts = 0
            this.isShuttingDown = false // Сбрасываем флаг при успешном переподключении
        })

        mongoose.connection.on('disconnecting', () => {
            this.logger.warn('[WARNING] MongoDB connection disconnecting')
        })

        mongoose.connection.on('close', () => {
            this.logger.info('[WARNING] MongoDB connection closed')
        })

        mongoose.connection.on('error', (error) => {
            this.logger.error({ err: error }, '[ERROR] MongoDB connection error')
            this.handleConnectionError(error)
        })
    }

    /**
     * Обрабатывает отключение от базы данных
     */
    private handleDisconnection(): void {
        // Не пытаемся переподключиться, если происходит graceful shutdown
        if (this.isShuttingDown) {
            this.logger.warn('[WARNING] Database disconnection during graceful shutdown - skipping reconnection')
            return
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
            
            this.logger.info(
                `[PROCESSING] Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            )
            
            setTimeout(() => {
                this.reconnect()
            }, delay)
        } else {
            this.logger.error('[ERROR] Max reconnection attempts reached. Manual intervention required.')
        }
    }

    /**
     * Обрабатывает ошибки подключения
     */
    private handleConnectionError(error: Error): void {
        this.logger.error({ err: error }, '[ERROR] MongoDB connection error occurred')
        
        // Для критических ошибок можно добавить логику уведомлений
        if (process.env.NODE_ENV === 'production') {
            // Здесь можно добавить отправку уведомлений в Slack, email и т.д.
            this.logger.error('Production environment - consider sending alerts')
        }
    }

    /**
     * Попытка переподключения
     */
    private async reconnect(): Promise<void> {
        try {
            this.logger.info('[PROCESSING] Attempting to reconnect to MongoDB...')
            this.connectionPromise = null
            const config = this.ensureConfig()
            await this.connect(config)
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Reconnection failed')
        }
    }

    /**
     * Получает текущее глобальное подключение
     */
    getConnection(): Connection {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database connection not established. Call connect() first.')
        }
        return mongoose.connection
    }

    /**
     * Получает статус глобального подключения
     */
    getConnectionStatus(): ConnectionStatus {
        return {
            isConnected: mongoose.connection.readyState === 1,
            isConnecting: mongoose.connection.readyState === 2,
            isDisconnecting: mongoose.connection.readyState === 3,
            readyState: mongoose.connection.readyState,
        }
    }

    /**
     * Получает имя базы данных из URI
     */
    private getDatabaseName(): string {
        try {
            const config = this.ensureConfig()
            const url = new URL(config.uri)
            return url.pathname.slice(1) || 'default'
        } catch {
            return 'unknown'
        }
    }

    /**
     * Закрывает глобальное подключение к базе данных
     */
    async disconnect(): Promise<void> {
        try {
            await mongoose.disconnect()
            this.logger.info('[SUCCESS] MongoDB connection closed successfully')
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error closing MongoDB connection')
            throw error
        } finally {
            this.connectionPromise = null
        }
    }

    /**
     * Проверяет здоровье глобального подключения
     */
    async healthCheck(): Promise<boolean> {
        try {
            if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
                return false
            }

            // Простой ping для проверки подключения
            await mongoose.connection.db.admin().ping()
            return true
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Database health check failed')
            return false
        }
    }

    /**
     * Получает статистику глобального подключения
     */
    getConnectionStats(): any {
        const config = this.config // Может быть null, если connect() не вызывался
        return {
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host || 'unknown',
            port: mongoose.connection.port || 'unknown',
            name: mongoose.connection.name || 'unknown',
            reconnected: this.reconnectAttempts,
            configured: !!config,
        }
    }

    /**
     * Graceful shutdown - корректное завершение работы
     * Реализует интерфейс Shutdownable
     */
    async shutdown(): Promise<void> {
        if (this.isShuttingDown) {
            this.logger.warn('[WARNING] Database shutdown already in progress')
            return
        }

        this.logger.info('[PROCESSING] Starting graceful shutdown of database connection...')
        this.isShuttingDown = true
        
        try {
            await this.disconnect()
            this.logger.info('[SUCCESS] Database connection gracefully closed')
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error during database shutdown')
            throw error
        }
    }
}
