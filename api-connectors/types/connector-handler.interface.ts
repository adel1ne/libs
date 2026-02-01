import { ConnectorConfig, ConnectorTypeEnum } from '../types/connector.types'

export interface ConnectorHandler<T extends ConnectorConfig, R = JSON> {
    readonly type: T['type']
    canHandle(config: ConnectorConfig): boolean
    handle<R>(config: T): Promise<R>
}

// Type guard для проверки типа провайдера
export function isConnectorConfig<T extends ConnectorTypeEnum>(
    config: ConnectorConfig,
    type: T
): config is Extract<ConnectorConfig, { type: T }> {
    return config.type === type
}
