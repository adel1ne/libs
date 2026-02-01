/**
 * Типы событий для BullMQ
 */
export enum BullmqEventType {
    /**
     * Общая ошибка при обработке job
     */
    JOB_ERROR = 'job:error',
    /**
     * Достигнут лимит попыток обработки job
     */
    JOB_ERROR_MAX_ATTEMPTS = 'job:error:max-attempts',
}

/**
 * Данные события ошибки job
 */
export interface JobErrorEventData {
    jobId: string
    jobName: string
    queueName: string
    error: Error | unknown
    attemptsMade: number
    maxAttempts: number
}

/**
 * Данные события достижения лимита попыток
 */
export interface JobErrorMaxAttemptsEventData extends JobErrorEventData {
    finalAttempt: boolean
}

