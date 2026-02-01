import { inject, injectable } from 'inversify'
import { Job, Queue, Worker } from 'bullmq'
import { RedisService } from '../redis/redis.service'
import { Shutdownable } from '../shutdown'
import { EventEmitterService } from '../event-emitter'
import { LoggerService } from '../../utils/logger'
import { BullmqEventType, JobErrorEventData, JobErrorMaxAttemptsEventData } from './bullmq.types'

export const REDIS_BULLMQ_SYMBOL = Symbol('REDIS_BULLMQ')

export interface JobProcessor<T = unknown> {
    (job: Job<T>): Promise<void>
}

@injectable()
export class BullmqService implements Shutdownable {
    private readonly workers: Worker[] = []

    constructor(
        @inject(REDIS_BULLMQ_SYMBOL)
        private readonly bullmqRedisService: RedisService,
        private readonly eventEmitterService: EventEmitterService,
        private readonly logger: LoggerService,
    ) {}

    createQueue(name: string): Queue {
        const queue = new Queue(name, {
            connection: this.bullmqRedisService.getRedis(),
        })

        return queue
    }

    createWorker<T = any>(
        queueName: string,
        processor: JobProcessor<T>,
        options: { autorun: boolean, concurrency?: number },
    ): Worker {
        const worker = new Worker(
            queueName,
            async (job: Job, token?: string) => {
                try {
                    await processor(job)
                    this.logger.info(`[SUCCESS] SUCCESS job: ${job.name} in queue: ${job.queueName}`)
                } catch (error) {
                    this.logger.error({ err: error }, '[ERROR] ERROR')
                    
                    const attemptsMade = job.attemptsMade + 1
                    const maxAttempts = job.opts.attempts || 1
                    const isMaxAttemptsReached = attemptsMade === maxAttempts

                    // Эмитим событие ошибки job
                    const jobErrorData: JobErrorEventData = {
                        jobId: job.id || '',
                        jobName: job.name || '',
                        queueName: job.queueName,
                        error,
                        attemptsMade,
                        maxAttempts,
                    }
                    this.eventEmitterService.emit<JobErrorEventData>(BullmqEventType.JOB_ERROR, jobErrorData)

                    // Если достигнут лимит попыток, эмитим дополнительное событие
                    if (isMaxAttemptsReached) {
                        this.logger.error(`[ERROR] ATTEMPTS LIMIT REACHED, MOVE TO FAILED ${job.name}:${job.id}`)
                        
                        const maxAttemptsData: JobErrorMaxAttemptsEventData = {
                            ...jobErrorData,
                            finalAttempt: true,
                        }
                        this.eventEmitterService.emit<JobErrorMaxAttemptsEventData>(
                            BullmqEventType.JOB_ERROR_MAX_ATTEMPTS,
                            maxAttemptsData,
                        )
                    }

                    throw error
                }
            },
            {
                connection: this.bullmqRedisService.getRedis(),
                autorun: options.autorun,
                ...(options.concurrency && { concurrency: options.concurrency }),
            },
        )

        // Добавляем worker в массив для последующего graceful shutdown
        this.workers.push(worker)

        return worker
    }

    /**
     * Корректно завершает работу всех созданных workers
     */
    async shutdown(): Promise<void> {
        if (this.workers.length === 0) {
            this.logger.info('[PROCESSING] No BullMQ workers to shutdown')
            return
        }

        this.logger.info(`[PROCESSING] Shutting down ${this.workers.length} BullMQ workers...`)

        try {
            // Закрываем всех workers параллельно
            await Promise.all(
                this.workers.map(async (worker, index) => {
                    try {
                        this.logger.info(`[PROCESSING] Closing worker ${index + 1}/${this.workers.length}`)
                        await worker.close()
                        this.logger.info(`[SUCCESS] Worker ${index + 1} closed successfully`)
                    } catch (error) {
                        this.logger.error({ err: error }, `[ERROR] Error closing worker ${index + 1}`)
                        // Не прерываем процесс shutdown других workers
                    }
                }),
            )

            // Очищаем массив workers
            this.workers.length = 0
            this.logger.info('[SUCCESS] All BullMQ workers shutdown completed')
        } catch (error) {
            this.logger.error({ err: error }, '[ERROR] Error during BullMQ workers shutdown')
            throw error
        }
    }

    /**
     * Получает количество активных workers
     */
    getActiveWorkersCount(): number {
        return this.workers.length
    }

    /**
     * Получает информацию об активных workers
     */
    getActiveWorkersInfo(): string[] {
        return this.workers.map((worker, index) => `Worker ${index + 1}: ${worker.name} (queue: ${worker.name})`)
    }
}
