/**
 * Интерфейс для сервисов, которые поддерживают graceful shutdown
 */
export interface Shutdownable {
    /**
     * Корректно завершает работу сервиса
     * @returns Promise, который разрешается после завершения shutdown
     */
    shutdown(): Promise<void>
}

/**
 * Символ для регистрации сервисов в DI контейнере
 */
export const SHUTDOWN_SYMBOL = Symbol('SHUTDOWN')
