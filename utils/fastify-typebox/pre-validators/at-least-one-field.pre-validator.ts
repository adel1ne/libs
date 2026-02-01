import { Static, TObject, TProperties } from '@sinclair/typebox'
import { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Helper type для извлечения типа из схемы TypeBox
 */
type SchemaStaticType<TSchema extends TObject<TProperties>> = Static<TSchema>

/**
 * Helper type для частичного типа из схемы TypeBox
 */
type SchemaPartialType<TSchema extends TObject<TProperties>> = Partial<SchemaStaticType<TSchema>>

/**
 * Тип для генерации всех возможных путей до 3 уровней вложенности из схемы
 * Генерирует все валидные пути вида: 'key', 'key.subkey', 'key.subkey.subsubkey'
 */
type GeneratePaths<TSchema extends TObject<TProperties>> = 
    // 1 уровень: прямые ключи схемы
    | (keyof Static<TSchema> & string)
    // 2 уровня: ключ.подключ
    | {
          [K1 in keyof Static<TSchema>]: Static<TSchema>[K1] extends Record<string, any>
              ? `${K1 & string}.${keyof Static<TSchema>[K1] & string}`
              : never
      }[keyof Static<TSchema>]
    // 3 уровня: ключ.подключ.подподключ
    | {
          [K1 in keyof Static<TSchema>]: Static<TSchema>[K1] extends Record<string, any>
              ? {
                    [K2 in keyof Static<TSchema>[K1]]: Static<TSchema>[K1][K2] extends Record<string, any>
                        ? `${K1 & string}.${K2 & string}.${keyof Static<TSchema>[K1][K2] & string}`
                        : never
                }[keyof Static<TSchema>[K1]]
              : never
      }[keyof Static<TSchema>]

/**
 * Универсальная функция для проверки наличия хотя бы одного поля из схемы TypeBox
 * @param obj - объект для проверки (типизирован как Partial<Static<TSchema>>)
 * @param schema - схема TypeBox объекта
 * @returns true, если хотя бы одно поле присутствует, иначе false
 */
function validateAtLeastOneField<TSchema extends TObject<TProperties>>(
    obj: SchemaPartialType<TSchema> | undefined,
    schema: TSchema
): obj is SchemaPartialType<TSchema> {
    if (!obj) {
        return false
    }
    
    const properties = schema.properties
    const fieldNames = Object.keys(properties) as Array<keyof SchemaStaticType<TSchema>>
    
    return fieldNames.some(fieldName => obj[fieldName] !== undefined)
}

/**
 * Рекурсивная функция для извлечения вложенной схемы по пути
 */
function extractSchemaByPath(
    schema: TObject<TProperties>,
    path: readonly string[]
): TObject<TProperties> {
    if (path.length === 0) {
        return schema
    }
    
    const [first, ...rest] = path
    if (first === undefined) {
        throw new Error('Invalid path: empty segment')
    }
    
    const properties = schema.properties as Record<string, any>
    const nestedSchema = properties[first]
    
    if (!nestedSchema || nestedSchema.type !== 'object') {
        throw new Error(`Property "${first}" is not an object schema`)
    }
    
    return extractSchemaByPath(nestedSchema, rest)
}

/**
 * Рекурсивная функция для извлечения значения объекта по пути
 */
function getValueByPath(obj: any, path: readonly string[]): any {
    if (path.length === 0) {
        return obj
    }
    
    const [first, ...rest] = path
    if (first === undefined) {
        return undefined
    }
    
    return getValueByPath(obj?.[first], rest)
}

/**
 * Преобразует строковый путь в массив сегментов
 */
function parsePath(pathString: string): readonly string[] {
    return pathString.split('.')
}

/**
 * Создает валидатор для Fastify preValidation, который проверяет наличие хотя бы одного поля в указанных путях
 * Каждый путь проверяется независимо: если путь существует в объекте, то в нем должно быть хотя бы одно поле
 * 
 * @param parentSchema - родительская схема TypeBox, содержащая вложенные объекты
 * @param paths - массив строковых путей к объектам в request.body (например, ['update', 'update.metadata', 'update.provider'])
 *   Поддерживается до 3 уровней вложенности
 * @returns функция-валидатор для Fastify preValidation
 * 
 * @example
 * ```typescript
 * // Простой путь
 * const validator1 = createAtLeastOneFieldValidator(UpdateApiKeyBodySchema, ['update'])
 * 
 * // Несколько путей с вложенностью
 * const validator2 = createAtLeastOneFieldValidator(
 *     CurrencyRequestUpdateSchema, 
 *     ['update', 'update.metadata']
 * )
 * 
 * // Глубокая вложенность (до 3 уровней)
 * const validator3 = createAtLeastOneFieldValidator(
 *     SomeSchema,
 *     ['update', 'update.metadata', 'update.metadata.list']
 * )
 * ```
 */
export function createAtLeastOneFieldValidator<
    TParentSchema extends TObject<TProperties>,
    TPaths extends readonly GeneratePaths<TParentSchema>[]
>(
    parentSchema: TParentSchema,
    paths: TPaths
) {
    // Создаем валидаторы для каждого пути
    const validators = paths.map((pathString) => {
        const pathArray = parsePath(pathString)
        
        // Проверяем глубину вложенности (максимум 3 уровня)
        if (pathArray.length > 3) {
            throw new Error(`Path "${pathString}" exceeds maximum nesting level of 3`)
        }
        
        const nestedSchema = extractSchemaByPath(parentSchema, pathArray)
        
        return {
            pathArray,
            pathString,
            nestedSchema,
            fieldNames: Object.keys(nestedSchema.properties) as Array<keyof SchemaStaticType<typeof nestedSchema>>,
        }
    })
    
    return async (
        request: FastifyRequest<{ Body: Partial<Static<TParentSchema>> & Record<string, any> }>,
        reply: FastifyReply
    ) => {
        // Проверяем каждый путь независимо
        for (const { pathArray, pathString, nestedSchema, fieldNames } of validators) {
            const obj = getValueByPath(request.body, pathArray) as SchemaPartialType<typeof nestedSchema> | undefined
            
            // Если объект существует (не undefined и не null), проверяем наличие хотя бы одного поля
            if (obj !== undefined && obj !== null && !validateAtLeastOneField(obj, nestedSchema)) {
                return reply.status(400).send({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: `At least one field must be provided in "${pathString}": ${fieldNames.join(', ')}`,
                })
            }
        }
    }
}

