import { injectable } from 'inversify'
import * as Joi from 'joi'
import * as dotenv from 'dotenv'
import { LoggerService } from '../logger'

/**
 * Универсальный сервис конфигурации
 * @template T - тип конфигурации (интерфейс с переменными окружения)
 */
@injectable()
export class ConfigService<T extends Record<string, any>> {
    private config: T | null = null
    private schema: Joi.ObjectSchema<T> | null = null
    private isInitialized = false

    constructor(
        private readonly logger: LoggerService,
    ) {}

    /**
     * Инициализирует сервис конфигурации
     * @param schema - Joi схема для валидации переменных окружения
     * @param envPath - опциональный путь к .env файлу
     */
    public initialize(schema: Joi.ObjectSchema<T>, envPath?: string): void {
        if (this.isInitialized) {
            return
        }

        this.schema = schema

        // Загружаем переменные из .env файла
        // TODO появляется сообщение при старте
        // [dotenv@17.2.2] injecting env (2) from .env -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild
        if (envPath) {
            dotenv.config({ path: envPath })
        } else {
            dotenv.config()
        }

        // Валидируем переменные окружения
        const { error, value } = this.schema.validate(process.env, {
            allowUnknown: true,
            stripUnknown: true,
            abortEarly: false,
        })

        if (error) {
            const errorMessage = `Configuration validation failed:\n${error.details
                .map((detail) => `  - ${detail.message}`)
                .join('\n')}`
            throw new Error(errorMessage)
        }

        this.config = value
        this.isInitialized = true
        this.logger.info(`[SUCCESS] ConfigService initialized`)
    }

    /**
     * Получает значение переменной окружения по ключу
     * @param key - ключ переменной окружения
     * @returns типизированное значение
     */
    public get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
        if (!this.isInitialized) {
            throw new Error('ConfigService not initialized. Call initialize() first.')
        }

        if (!this.config) {
            throw new Error('Configuration not loaded')
        }

        const value = this.config[key]
        if (value === undefined) {
            if (defaultValue !== undefined) {
                return defaultValue
            }
            throw new Error(`Configuration key '${String(key)}' is not defined`)
        }

        return value
    }

    /**
     * Проверяет, инициализирован ли сервис
     */
    public isReady(): boolean {
        return this.isInitialized
    }
}
