import { RedisOptions } from "ioredis"

export type RedisConfig = {
    uri: string
    options: RedisOptions
}