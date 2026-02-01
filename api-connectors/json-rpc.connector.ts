import axios from 'axios'
import { inject, injectable } from 'inversify'
import { ConnectorConfig, JsonRpcConnectorConfig, ConnectorHandler, ConnectorTypeEnum } from './types'
import { LoggerService } from '../utils/logger'

const DEFAULT_TIMEOUT_MS = 30000

@injectable()
export class JsonRpcConnectorHandler implements ConnectorHandler<JsonRpcConnectorConfig> {
    readonly type = ConnectorTypeEnum.JSON_RPC

    constructor(
        private readonly logger: LoggerService,
    ) {}

    canHandle(config: ConnectorConfig): config is JsonRpcConnectorConfig {
        return config.type === this.type
    }

    async handle<R>(config: JsonRpcConnectorConfig): Promise<R> {
        const requestBody = {
            jsonrpc: '2.0',
            method: config.metadata?.method,
            params: config.metadata?.params ?? {},
            id: config.metadata?.id ?? 1,
        }

        this.logger.debug({
            method: requestBody.method,
            params: requestBody.params,
            id: requestBody.id,
            headers: config.headers,
            timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        }, `[JSON-RPC][Request] POST ${config.endpoint}`)

        try {
            const response = await axios.post(config.endpoint, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers,
                },
                timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            })

            // JSON-RPC-ответ может содержать поле error даже при HTTP 200
            if (response.data.error) {
                this.logger.error({ error: response.data.error }, `[JSON-RPC][Error][RPC]`)
                throw new Error(
                    `JSON-RPC error: ${response.data.error.message} (code: ${response.data.error.code})`
                )
            }

            return response.data.result
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    this.logger.error(
                        { status: error.response.status, statusText: error.response.statusText, data: error.response.data },
                        `[JSON-RPC][Error][HTTP] Status ${error.response.status}: ${error.response.statusText}`
                    )
                    throw new Error(
                        `JSON-RPC request failed with status ${error.response.status}: ${error.response.statusText}`
                    )
                } else if (error.code === 'ECONNABORTED') {
                    this.logger.error(
                        `[JSON-RPC][Error][Timeout] Request timed out after ${config.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`
                    )
                    throw new Error(
                        `JSON-RPC request timed out after ${config.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`
                    )
                } else if (error.request) {
                    this.logger.error(
                        { err: error },
                        `[JSON-RPC][Error][No Response] No response received from server`
                    )
                    throw new Error(
                        `JSON-RPC request failed: no response received from server`
                    )
                } else {
                    this.logger.error(
                        { err: error },
                        `[JSON-RPC][Error][Setup] Request setup error`
                    )
                    throw new Error(
                        `JSON-RPC request setup error: ${error.message}`
                    )
                }
            } else {
                this.logger.error({ err: error }, `[JSON-RPC][Error][Unknown]`)
                throw error
            }
        }
    }
}
