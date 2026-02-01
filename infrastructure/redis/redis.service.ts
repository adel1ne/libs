import Redis from 'ioredis'
import { inject, injectable } from 'inversify'
import { RedisConfig } from './redis.types'
import { Shutdownable } from '../shutdown/graceful-shutdown.types'
import { LoggerService } from '../../utils/logger'

@injectable()
export class RedisService implements Shutdownable {
    private isInitialized = false
    private redis: Redis | null = null

    constructor(
        private readonly logger: LoggerService,
    ) {}

    // TODO переделать на initialize
    public initialize(config: RedisConfig): void {
        if (this.isInitialized) {
            return
        }

        this.redis = new Redis(config.uri, config.options)

        this.redis.on('connect', () => {
            this.logger.info(`[SUCCESS] Redis connected successfully to uri: ${config.uri}`)
            this.isInitialized = true
        })

        this.redis.on('error', (err) => {
            this.logger.error({ err }, '[ERROR] Redis error')
            process.exit(1)
        })
    }

    public getRedis(): Redis {
        if (!this.redis) {
            throw new Error('[ERROR] Redis not initialized')
        }
        return this.redis
    }

    /**
     * Корректно завершает работу Redis подключения
     */
    async shutdown(): Promise<void> {
        if (!this.redis || !this.isInitialized) {
            this.logger.info('[PROCESSING] Redis not initialized, nothing to shutdown')
            return
        }

        this.logger.info('[PROCESSING] Shutting down Redis connection...')

        try {
            // Отключаем все обработчики событий
            this.redis.removeAllListeners()

            // Закрываем подключение
            await this.redis.quit()
            
            this.logger.info('[SUCCESS] Redis connection closed successfully')
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error during Redis shutdown')
            
            // Если quit() не сработал, принудительно закрываем подключение
            try {
                this.redis.disconnect()
                this.logger.warn('[WARNING] Redis connection force disconnected')
            } catch (disconnectError) {
                this.logger.error({ err: disconnectError }, '[ERROR] Error force disconnecting Redis')
            }
            
            throw error
        } finally {
            this.redis = null
            this.isInitialized = false
        }
    }

    /**
     * Проверяет, инициализирован ли Redis
     */
    public isReady(): boolean {
        return this.isInitialized && this.redis !== null
    }

    /**
     * Получает статус подключения Redis
     */
    public getConnectionStatus(): string {
        if (!this.redis) {
            return 'not_initialized'
        }
        
        return this.redis.status
    }
}
