import { inject, injectable } from 'inversify'
import { EventEmitter } from 'eventemitter3'
import { Shutdownable } from '../shutdown'
import { LoggerService } from '../../utils/logger'

/**
 * Сервис для управления событиями в приложении
 * Обертка над eventemitter3 с поддержкой graceful shutdown
 * Независимый модуль без знания о конкретных типах событий
 */
@injectable()
export class EventEmitterService extends EventEmitter implements Shutdownable {
    constructor(
        private readonly logger: LoggerService,
    ) {
        super()
    }
    /**
     * Подписка на событие
     * @param event - название события
     * @param handler - обработчик события
     */
    on<T = unknown>(event: string | symbol, handler: (data: T) => void): this {
        return super.on(event, handler)
    }

    /**
     * Подписка на событие (одноразовая)
     * @param event - название события
     * @param handler - обработчик события
     */
    once<T = unknown>(event: string | symbol, handler: (data: T) => void): this {
        return super.once(event, handler)
    }

    /**
     * Эмиссия события
     * @param event - название события
     * @param data - данные события
     */
    emit<T = unknown>(event: string | symbol, data: T): boolean {
        return super.emit(event, data)
    }

    /**
     * Отписка от события
     * @param event - название события
     * @param handler - обработчик события (опционально)
     */
    off<T = unknown>(event: string | symbol, handler?: (data: T) => void): this {
        return super.off(event, handler)
    }

    /**
     * Корректно завершает работу EventEmitter
     * Удаляет все подписки на события
     */
    async shutdown(): Promise<void> {
        this.logger.info('[PROCESSING] Shutting down EventEmitterService...')
        
        try {
            // Удаляем все обработчики событий
            this.removeAllListeners()
            
            this.logger.info('[SUCCESS] EventEmitterService shutdown completed')
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error during EventEmitterService shutdown')
            throw error
        }
    }
}

