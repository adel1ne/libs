import axios from 'axios'
import { inject, injectable } from 'inversify'
import { ConnectorConfig, GraphQLConnectorConfig, ConnectorHandler, ConnectorTypeEnum } from './types'
import { LoggerService } from '../utils/logger'

@injectable()
export class GraphQLConnectorHandler implements ConnectorHandler<GraphQLConnectorConfig> {
    readonly type = ConnectorTypeEnum.GRAPHQL

    constructor(
        private readonly logger: LoggerService,
    ) {}

    canHandle(config: ConnectorConfig): config is GraphQLConnectorConfig {
        return config.type === this.type
    }

    async handle<R>(config: GraphQLConnectorConfig): Promise<R> {
        this.logger.debug({
            query: config.metadata?.query,
            variables: config.metadata?.variables,
            headers: config.headers,
            timeout: config.timeoutMs ?? 30000,
        }, `[GraphQL][Request] POST ${config.endpoint}`)

        try {
            const response = await axios.post<R>(
                config.endpoint,
                {
                    query: config.metadata?.query,
                    variables: config.metadata?.variables,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...config.headers,
                    },
                    timeout: config.timeoutMs ?? 30000,
                }
            )

            return response.data
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    this.logger.error(
                        { status: error.response.status, statusText: error.response.statusText, data: error.response.data },
                        `[GraphQL][Error][HTTP] Status ${error.response.status}: ${error.response.statusText}`
                    )
                    throw new Error(
                        `GraphQL request failed with status ${error.response.status}: ${error.response.statusText}`
                    )
                } else if (error.code === 'ECONNABORTED') {
                    this.logger.error(`[GraphQL][Error][Timeout] Request timed out after ${config.timeoutMs ?? 30000} ms`)
                    throw new Error(`GraphQL request timed out after ${config.timeoutMs ?? 30000} ms`)
                } else if (error.request) {
                    this.logger.error({ err: error }, `[GraphQL][Error][No Response] No response received from server`)
                    throw new Error(`GraphQL request failed: no response received from server`)
                } else {
                    this.logger.error({ err: error }, `[GraphQL][Error][Setup] Request setup error`)
                    throw new Error(`GraphQL request setup error: ${error.message}`)
                }
            } else {
                this.logger.error({ err: error }, `[GraphQL][Error][Unknown]`)
                throw error
            }
        }
    }
}
