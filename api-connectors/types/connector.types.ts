import { JsonMapper } from '../../utils/json-mapper'

export const API_CONNECTORS = Symbol('API_CONNECTORS')

export enum ConnectorTypeEnum {
    GRAPHQL = 'GRAPHQL',
    REST = 'REST',
    GRPC = 'GRPC',
    RMQ = 'RMQ',
    WEBSOCKET = 'WEBSOCKET',
    JSON_RPC = 'JSON_RPC',
}

// Базовый интерфейс для всех конфигураций
export interface BaseConnectorConfig {
    type: ConnectorTypeEnum
    timeoutMs?: number
    metadata: Record<string, unknown>
}

// Конкретные конфигурации с discriminated union
export interface GraphQLConnectorConfig extends BaseConnectorConfig {
    type: ConnectorTypeEnum.GRAPHQL
    endpoint: string
    headers: Record<string, string>
    metadata: {
        query: string
        variables?: Record<string, unknown>
    }
}

export interface JsonRpcConnectorConfig extends BaseConnectorConfig {
    type: ConnectorTypeEnum.JSON_RPC
    endpoint: string
    headers: Record<string, string>
    metadata: {
        method: string
        params?: Record<string, unknown>
        id?: number
    }
}

export interface RESTConnectorConfig extends BaseConnectorConfig {
    type: ConnectorTypeEnum.REST
    endpoint: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers: Record<string, string>
    body?: unknown
}

export interface GRPCConnectorConfig extends BaseConnectorConfig {
    type: ConnectorTypeEnum.GRPC
    endpoint: string
    service: string
    method: string
    requestData?: unknown
}

export interface RMQConnectorConfig extends BaseConnectorConfig {
    type: ConnectorTypeEnum.RMQ
    queue: string
    exchange: string
    routingKey: string
    message: unknown
}

export interface WebSocketConnectorConfig extends BaseConnectorConfig {
    type: ConnectorTypeEnum.WEBSOCKET
    url: string
    protocol?: string
    message: unknown
}

// Union тип для всех конфигураций
export type ConnectorConfig =
    | GraphQLConnectorConfig
    | JsonRpcConnectorConfig
    | RESTConnectorConfig
    | GRPCConnectorConfig
    | RMQConnectorConfig
    | WebSocketConnectorConfig

// Mapped type для создания type-safe map конфигураций по типу
export type ConnectorConfigMap = {
    [K in ConnectorTypeEnum]: Extract<ConnectorConfig, { type: K }>
}

// Generic интерфейс провайдера
export interface Connector<T extends ConnectorTypeEnum = ConnectorTypeEnum> {
    connectorName: string
    mapper: JsonMapper
    config: ConnectorConfigMap[T]
}

// Generic job data с type safety
export interface JobData<T extends ConnectorTypeEnum = ConnectorTypeEnum> {
    type: T
    config: ConnectorConfigMap[T]
}

export interface ConnectorsJobData<T extends ConnectorTypeEnum = ConnectorTypeEnum> {
    delay?: number
    connectors: Connector<T>[]
}
