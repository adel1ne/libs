import { inject, injectable, multiInject } from 'inversify'
import { Shutdownable, SHUTDOWN_SYMBOL } from './graceful-shutdown.types'
import { LoggerService } from '../../utils/logger'

/**
 * Сервис для корректного завершения работы всех зарегистрированных компонентов
 */
@injectable()
export class GracefulShutdownService {
    constructor(
        @multiInject(SHUTDOWN_SYMBOL) 
        private readonly _servicesToShutdown: Shutdownable[],
        private readonly logger: LoggerService,
    ) {}

    /**
     * Корректно завершает работу всех зарегистрированных сервисов
     * @param timeout - максимальное время ожидания завершения (по умолчанию 30 секунд)
     * @returns Promise, который разрешается после завершения всех сервисов
     */
    async shutdown(timeout: number = 30000): Promise<void> {
        if (this._servicesToShutdown.length === 0) {
            this.logger.info('[PROCESSING] No services registered for graceful shutdown')
            return
        }

        this.logger.info(`[PROCESSING] Starting graceful shutdown of ${this._servicesToShutdown.length} services...`)

        try {
            // Создаем Promise с таймаутом
            const shutdownPromise = Promise.all(
                this._servicesToShutdown.map(async (service, index) => {
                    try {
                        this.logger.info(`[PROCESSING] Shutting down service ${index + 1}/${this._servicesToShutdown.length}`)
                        await service.shutdown()
                        this.logger.info(`[SUCCESS] Service ${service.constructor.name} shutdown completed`)
                    } catch (error) {
                        this.logger.error({ err: error }, `[ERROR] Error shutting down service ${index + 1}`)
                        // Не прерываем процесс shutdown других сервисов
                    }
                })
            )

            // Ждем завершения с таймаутом
            await Promise.race([
                shutdownPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Shutdown timeout')), timeout)
                )
            ])

            this.logger.info('[SUCCESS] All services shutdown completed successfully')
        } catch (error: any) {
            if (error.message === 'Shutdown timeout') {
                this.logger.error(`[ERROR] Graceful shutdown timeout after ${timeout}ms`)
            } else {
                this.logger.error({ err: error }, '[ERROR] Error during graceful shutdown')
            }
            throw error
        }
    }

    /**
     * Получает количество зарегистрированных сервисов
     */
    getRegisteredServicesCount(): number {
        return this._servicesToShutdown.length
    }

    /**
     * Получает информацию о зарегистрированных сервисах
     */
    getRegisteredServicesInfo(): string[] {
        return this._servicesToShutdown.map((service, index) => 
            `Service ${index + 1}: ${service.constructor.name}`
        )
    }
}
