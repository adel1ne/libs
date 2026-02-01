import { JSONPath } from 'jsonpath-plus'
import { JsonMapper, MappedResult } from './json-mapper.interface'

export class JsonMapperService {

    static extractArray(obj: any, mapper: JsonMapper): MappedResult[] {
        const arrayPath = mapper.objectsArray
        const arrayResult = JSONPath({ path: arrayPath, json: obj, wrap: false })

        if (!Array.isArray(arrayResult)) {
            throw new Error(`Path '${arrayPath}' does not resolve to an array`)
        }

        return arrayResult
    }
        

    /**
     * Валидирует объект согласно мапперу
     */
    static validateObj(obj: any, mapper: JsonMapper): { isValid: boolean; errors: string[] } {
        const errors: string[] = []

        try {
            const arrayPath = mapper.objectsArray
            const arrayResult = this.extractArray(obj, mapper)

            // Проверяем минимальную длину массива
            if (mapper.validation?.minArrayLength && arrayResult.length < mapper.validation.minArrayLength) {
                errors.push(
                    `Array length ${arrayResult.length} is less than required minimum ${mapper.validation.minArrayLength}`
                )
            }

            // Проверяем наличие хотя бы одного элемента
            if (arrayResult.length === 0) {
                errors.push(`Array at path '${arrayPath}' is empty`)
            }

            // Проверяем обязательные пути
            if (mapper.validation?.requiredPaths) {
                for (const requiredPath of mapper.validation.requiredPaths) {
                    const fullPath = `${arrayPath}[0].${requiredPath}`
                    const value = JSONPath({ path: fullPath, json: obj, wrap: false })
                    if (value === undefined || value === null) {
                        errors.push(`Required path '${fullPath}' is missing or null`)
                    }
                }
            }

            // Проверяем структуру первого элемента массива
            if (arrayResult.length > 0 && mapper.fieldsMapping) {
                for (const [sourcePath, mapping] of Object.entries(mapper.fieldsMapping)) {
                    const fullPath = `${arrayPath}[0].${sourcePath}`
                    const value = JSONPath({ path: fullPath, json: obj, wrap: false })

                    if (mapping.required && (value === undefined || value === null)) {
                        errors.push(`Required field '${fullPath}' is missing or null`)
                    }
                }
            }
        } catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }

        return {
            isValid: errors.length === 0,
            errors,
        }
    }

    /**
     * Выполняет маппинг объекта согласно мапперу
     */
    static mapObj(obj: any, mapper: JsonMapper): MappedResult[] {
        try {
            const arrayPath = mapper.objectsArray
            const arrayResult = this.extractArray(obj, mapper)

            if (arrayResult.length > 0 && mapper.fieldsMapping) {
                // Маппим каждый элемент
                return arrayResult.map((item, index) => {
                    const mappedItem: MappedResult = {}

                    for (const [sourcePath, mapping] of Object.entries(mapper.fieldsMapping!)) {
                        const fullPath = `${arrayPath}[${index}].${sourcePath}`
                        let value = JSONPath({ path: fullPath, json: obj, wrap: false })

                        // Применяем значение по умолчанию если поле отсутствует
                        if (value === undefined || value === null) {
                            if (mapping.defaultValue !== undefined) {
                                value = mapping.defaultValue
                            } else if (mapping.required) {
                                throw new Error(`Required field '${fullPath}' is missing`)
                            } else {
                                continue // Пропускаем необязательное поле
                            }
                        }

                        // Преобразуем тип данных
                        let transformedValue: string | number | boolean
                        switch (mapping.type) {
                            case 'string':
                                transformedValue = String(value)
                                break
                            case 'number':
                                transformedValue = Number(value)
                                if (isNaN(transformedValue)) {
                                    throw new Error(`Cannot convert '${value}' to number for field '${fullPath}'`)
                                }
                                break
                            case 'boolean':
                                if (typeof value === 'boolean') {
                                    transformedValue = value
                                } else if (typeof value === 'string') {
                                    transformedValue = value.toLowerCase() === 'true'
                                } else if (typeof value === 'number') {
                                    transformedValue = value !== 0
                                } else {
                                    transformedValue = Boolean(value)
                                }
                                break
                            default:
                                throw new Error(`Unsupported type '${mapping.type}' for field '${fullPath}'`)
                        }

                        mappedItem[mapping.mapTo] = transformedValue
                    }

                    return mappedItem
                })
            } else {
                return arrayResult
            }

        } catch (error) {
            throw new Error(`Mapping error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Полная обработка: валидация + маппинг
     */
    static process<T>(obj: any, mapper: JsonMapper): { success: boolean; data?: T[]; errors?: string[] } {
        const validation = this.validateObj(obj, mapper)

        if (!validation.isValid) {
            return { success: false, errors: validation.errors }
        }

        try {
            const mappedData = this.mapObj(obj, mapper)
            return { success: true, data: mappedData as T[] }
        } catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown mapping error'],
            }
        }
    }
}


