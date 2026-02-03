import { injectable } from 'inversify'
import { Shutdownable } from '../../shutdown'
import { LoggerService } from '../../../utils/logger'

/**
 * Минимальный интерфейс клиента, совместимый с PrismaClient.
 * Позволяет использовать сгенерированный клиент из проекта-потребителя.
 */
export interface PrismaClientLike {
    $connect(): Promise<void>
    $disconnect(): Promise<void>
    $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>
}

export interface PrismaDatabaseConfig {
    /**
     * Экземпляр PrismaClient (сгенерированный в проекте-потребителе).
     */
    client: PrismaClientLike
}

@injectable()
export class PrismaManager implements Shutdownable {
    private readonly randomId = crypto.randomUUID()
    private client: PrismaClientLike | null = null
    private isShuttingDown = false

    constructor(
        private readonly logger: LoggerService,
    ) {
        this.logger.info(`[SUCCESS] PrismaManager initialized with randomId: ${this.randomId}`)
    }

    /**
     * Подключается к базе данных через переданный PrismaClient.
     */
    async connect(config: PrismaDatabaseConfig): Promise<PrismaClientLike> {
        if (this.client) {
            return this.client
        }

        try {
            this.logger.info('[PROCESSING] Connecting to database via Prisma...')
            this.client = config.client
            await this.client.$connect()
            this.logger.info('[SUCCESS] Prisma connected successfully')
            return this.client
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Failed to connect via Prisma')
            throw error
        }
    }

    /**
     * Возвращает текущий клиент.
     * @throws Error если connect() ещё не вызывался
     */
    getClient(): PrismaClientLike {
        if (!this.client) {
            throw new Error('Database connection not established. Call connect() first.')
        }
        return this.client
    }

    /**
     * Отключается от базы данных.
     */
    async disconnect(): Promise<void> {
        try {
            if (this.client) {
                await this.client.$disconnect()
                this.logger.info('[SUCCESS] Prisma connection closed successfully')
            }
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error closing Prisma connection')
            throw error
        } finally {
            this.client = null
        }
    }

    /**
     * Проверяет доступность базы данных.
     */
    async healthCheck(): Promise<boolean> {
        try {
            if (!this.client) {
                return false
            }
            await this.client.$queryRaw`SELECT 1`
            return true
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Prisma health check failed')
            return false
        }
    }

    /**
     * Graceful shutdown — реализует интерфейс Shutdownable.
     */
    async shutdown(): Promise<void> {
        if (this.isShuttingDown) {
            this.logger.warn('[WARNING] Prisma shutdown already in progress')
            return
        }

        this.logger.info('[PROCESSING] Starting graceful shutdown of Prisma connection...')
        this.isShuttingDown = true

        try {
            await this.disconnect()
            this.logger.info('[SUCCESS] Prisma connection gracefully closed')
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error during Prisma shutdown')
            throw error
        }
    }
}
