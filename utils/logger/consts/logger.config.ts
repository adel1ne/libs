import { LoggerOptions } from 'pino'

/**
 * Конфигурация логгера Pino
 * Используется как в LoggerService, так и в Fastify
 */
export const loggerConfig: LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    // Настройки для правильной обработки Unicode
    transport: {
        target: 'pino-pretty',
        options: {
            // Формат времени с миллисекундами: HH:MM:ss.mmm
            translateTime: 'HH:MM:ss.l Z',
            ignore: 'pid,hostname',
            colorize: true,
            singleLine: false,
            hideObject: false,
        },
    },
}

/**
 * Конфигурация логгера для тестов
 * Использует более высокий уровень логирования, чтобы уменьшить шум от ошибок валидации
 */
export const testLoggerConfig: LoggerOptions = {
    level: process.env.LOG_LEVEL || 'warn', // По умолчанию warn для тестов, чтобы не логировать info-уровень (включая ошибки валидации)
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'HH:MM:ss.l Z',
            ignore: 'pid,hostname',
            colorize: true,
            singleLine: false,
            hideObject: false,
        },
    },
}

