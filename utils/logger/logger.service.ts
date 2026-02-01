import { injectable } from 'inversify'
import pino, { Logger } from 'pino'
import { loggerConfig } from './consts/logger.config'

/**
 * ANSI коды для цветов
 */
const Colors = {
    RESET: '\x1b[0m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    RED: '\x1b[31m',
    BLUE: '\x1b[34m',
    CYAN: '\x1b[36m',
    MAGENTA: '\x1b[35m',
}

/**
 * Раскрашивает метки статусов в сообщении
 * Ищет паттерны [SUCCESS], [PROCESSING], [ERROR], [WARNING], [INFO], [INIT]
 * и раскрашивает их соответствующими цветами
 */
function colorizeStatusLabels(message: string): string {
    return message
        .replace(/\[SUCCESS\]/g, `${Colors.GREEN}[SUCCESS]${Colors.RESET}`)
        .replace(/\[PROCESSING\]/g, `${Colors.BLUE}[PROCESSING]${Colors.RESET}`)
        .replace(/\[ERROR\]/g, `${Colors.RED}[ERROR]${Colors.RESET}`)
        .replace(/\[WARNING\]/g, `${Colors.YELLOW}[WARNING]${Colors.RESET}`)
        .replace(/\[INFO\]/g, `${Colors.CYAN}[INFO]${Colors.RESET}`)
        .replace(/\[INIT\]/g, `${Colors.MAGENTA}[INIT]${Colors.RESET}`)
}

/**
 * Сервис логирования на основе Pino
 * Предоставляет единый интерфейс для логирования во всем приложении
 */
@injectable()
export class LoggerService {
    private logger: Logger

    constructor() {
        // Используем общую конфигурацию логгера
        this.logger = pino(loggerConfig)
    }

    /**
     * Получает имя вызывающего модуля из stack trace
     */
    private getCallerContext(): string {
        const stack = new Error().stack
        if (!stack) return 'unknown'
        
        const lines = stack.split('\n')
        // Пропускаем первые 3 строки (Error, getCallerContext, метод логирования)
        // Ищем первый вызов вне LoggerService
        for (let i = 3; i < lines.length; i++) {
            const line = lines[i]
            if (line && !line.includes('LoggerService') && !line.includes('logger.service')) {
                // Извлекаем имя файла и функции
                const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) || 
                             line.match(/at\s+(.+?):(\d+):(\d+)/)
                if (match && match.length > 0) {
                    const filePath = match[2] || match[1]
                    if (filePath) {
                        const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(ts|js)$/, '') || 'unknown'
                        const functionName = match[1]?.split('.').pop() || 'anonymous'
                        return `${fileName}:${functionName}`
                    }
                }
            }
        }
        return 'unknown'
    }

    /**
     * Логирование информационного сообщения
     */
    info(message: string, ...args: any[]): void
    info(obj: object, message?: string, ...args: any[]): void
    info(objOrMessage: object | string, message?: string, ...args: any[]): void {
        const context = this.getCallerContext()
        
        if (typeof objOrMessage === 'string') {
            const coloredMessage = colorizeStatusLabels(`[${context}] ${objOrMessage}`)
            this.logger.info(coloredMessage, ...args)
        } else {
            const msg = message || ''
            const coloredMessage = colorizeStatusLabels(`[${context}] ${msg}`)
            this.logger.info({ ...objOrMessage }, coloredMessage, ...args)
        }
    }

    /**
     * Логирование ошибки
     */
    error(message: string, ...args: any[]): void
    error(obj: object, message?: string, ...args: any[]): void
    error(objOrMessage: object | string, message?: string, ...args: any[]): void {
        const context = this.getCallerContext()
        
        if (typeof objOrMessage === 'string') {
            const coloredMessage = colorizeStatusLabels(`[${context}] ${objOrMessage}`)
            this.logger.error(coloredMessage, ...args)
        } else {
            const msg = message || ''
            const coloredMessage = colorizeStatusLabels(`[${context}] ${msg}`)
            this.logger.error({ ...objOrMessage }, coloredMessage, ...args)
        }
    }

    /**
     * Логирование предупреждения
     */
    warn(message: string, ...args: any[]): void
    warn(obj: object, message?: string, ...args: any[]): void
    warn(objOrMessage: object | string, message?: string, ...args: any[]): void {
        const context = this.getCallerContext()
        
        if (typeof objOrMessage === 'string') {
            const coloredMessage = colorizeStatusLabels(`[${context}] ${objOrMessage}`)
            this.logger.warn(coloredMessage, ...args)
        } else {
            const msg = message || ''
            const coloredMessage = colorizeStatusLabels(`[${context}] ${msg}`)
            this.logger.warn({ ...objOrMessage }, coloredMessage, ...args)
        }
    }

    /**
     * Логирование отладочной информации
     */
    debug(message: string, ...args: any[]): void
    debug(obj: object, message?: string, ...args: any[]): void
    debug(objOrMessage: object | string, message?: string, ...args: any[]): void {
        const context = this.getCallerContext()
        
        if (typeof objOrMessage === 'string') {
            const coloredMessage = colorizeStatusLabels(`[${context}] ${objOrMessage}`)
            this.logger.debug(coloredMessage, ...args)
        } else {
            const msg = message || ''
            const coloredMessage = colorizeStatusLabels(`[${context}] ${msg}`)
            this.logger.debug({ ...objOrMessage }, coloredMessage, ...args)
        }
    }

    /**
     * Логирование критической ошибки
     */
    fatal(message: string, ...args: any[]): void
    fatal(obj: object, message?: string, ...args: any[]): void
    fatal(objOrMessage: object | string, message?: string, ...args: any[]): void {
        const context = this.getCallerContext()
        
        if (typeof objOrMessage === 'string') {
            const coloredMessage = colorizeStatusLabels(`[${context}] ${objOrMessage}`)
            this.logger.fatal(coloredMessage, ...args)
        } else {
            const msg = message || ''
            const coloredMessage = colorizeStatusLabels(`[${context}] ${msg}`)
            this.logger.fatal({ ...objOrMessage }, coloredMessage, ...args)
        }
    }

    /**
     * Логирование трассировки
     */
    trace(message: string, ...args: any[]): void
    trace(obj: object, message?: string, ...args: any[]): void
    trace(objOrMessage: object | string, message?: string, ...args: any[]): void {
        const context = this.getCallerContext()
        
        if (typeof objOrMessage === 'string') {
            const coloredMessage = colorizeStatusLabels(`[${context}] ${objOrMessage}`)
            this.logger.trace(coloredMessage, ...args)
        } else {
            const msg = message || ''
            const coloredMessage = colorizeStatusLabels(`[${context}] ${msg}`)
            this.logger.trace({ ...objOrMessage }, coloredMessage, ...args)
        }
    }

    /**
     * Создает дочерний логгер с дополнительным контекстом
     */
    child(bindings: pino.Bindings): Logger {
        return this.logger.child(bindings)
    }

    /**
     * Получить базовый экземпляр Pino logger (для продвинутого использования)
     */
    getPinoLogger(): Logger {
        return this.logger
    }
}

