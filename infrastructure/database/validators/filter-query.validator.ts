import { Schema, Model } from 'mongoose'
import { injectable, unmanaged } from 'inversify'

/**
 * Результат валидации filterQuery
 */
export interface ValidationResult {
    isValid: boolean
    errors: string[]
}

/**
 * Конфигурация валидатора
 */
export interface ValidatorConfig {
    maxDepth?: number // Максимальная глубина вложенности (защита от DoS)
    allowedOperators?: string[] // Разрешенные операторы (по умолчанию стандартные MongoDB)
}

/**
 * Универсальный валидатор filterQuery для Mongoose схем
 */
@injectable()
export class FilterQueryValidator {
    private config: Required<ValidatorConfig>
    private errors: string[] = []

    // Стандартные операторы MongoDB
    private static readonly DEFAULT_OPERATORS = [
        // Comparison
        '$eq',
        '$ne',
        '$gt',
        '$gte',
        '$lt',
        '$lte',
        '$in',
        '$nin',
        // Logical
        '$and',
        '$or',
        '$not',
        '$nor',
        // Element
        '$exists',
        '$type',
        // Evaluation
        '$regex',
        '$options',
        '$expr',
        '$jsonSchema',
        '$mod',
        '$text',
        '$where',
        // Array
        '$all',
        '$elemMatch',
        '$size',
        // Bitwise
        '$bitsAllClear',
        '$bitsAllSet',
        '$bitsAnyClear',
        '$bitsAnySet',
        // Geospatial
        '$geoIntersects',
        '$geoWithin',
        '$near',
        '$nearSphere',
    ]

    // Опасные операторы, которые лучше блокировать в продакшене
    private static readonly DANGEROUS_OPERATORS = ['$where', '$expr']

    constructor(@unmanaged() config?: ValidatorConfig) {
        this.config = {
            maxDepth: config?.maxDepth ?? 10,
            allowedOperators:
                config?.allowedOperators ??
                FilterQueryValidator.DEFAULT_OPERATORS.filter(
                    (op) => !FilterQueryValidator.DANGEROUS_OPERATORS.includes(op),
                ),
        }
    }

    /**
     * Основной метод валидации filterQuery
     */
    validate(filterQuery: any, model: Model<any>): ValidationResult {
        this.errors = []
        const schema = model.schema

        try {
            // Проверка базовых типов
            if (filterQuery === null || filterQuery === undefined) {
                return { isValid: true, errors: [] }
            }

            if (typeof filterQuery !== 'object') {
                this.errors.push('FilterQuery must be an object')
                return { isValid: false, errors: this.errors }
            }

            if (Array.isArray(filterQuery)) {
                this.errors.push('FilterQuery cannot be an array at the top level')
                return { isValid: false, errors: this.errors }
            }

            // Рекурсивная валидация
            this.validateObject(filterQuery, '', 0, schema)

            return {
                isValid: this.errors.length === 0,
                errors: this.errors,
            }
        } catch (error) {
            this.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
            return { isValid: false, errors: this.errors }
        }
    }

    /**
     * Рекурсивная валидация объекта
     */
    private validateObject(obj: any, path: string, depth: number, schema: Schema): void {
        // Проверка глубины вложенности
        if (depth > this.config.maxDepth) {
            this.errors.push(`Maximum nesting depth exceeded (${this.config.maxDepth}) at path: ${path}`)
            return
        }

        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key

            // Проверка операторов
            if (key.startsWith('$')) {
                this.validateOperator(key, value, currentPath, depth, schema)
            } else {
                // Проверка поля схемы
                this.validateField(key, value, currentPath, depth, schema)
            }
        }
    }

    /**
     * Валидация оператора MongoDB
     */
    private validateOperator(operator: string, value: any, path: string, depth: number, schema: Schema): void {
        // Проверка, что оператор разрешен
        if (!this.config.allowedOperators.includes(operator)) {
            this.errors.push(`Invalid operator "${operator}" at path: ${path}`)
            return
        }

        // Валидация логических операторов
        if (['$and', '$or', '$nor'].includes(operator)) {
            if (!Array.isArray(value)) {
                this.errors.push(`Operator ${operator} must contain an array at path: ${path}`)
                return
            }

            if (value.length === 0) {
                this.errors.push(`Operator ${operator} cannot contain an empty array at path: ${path}`)
                return
            }

            value.forEach((item, index) => {
                if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                    this.errors.push(`Element ${index} in ${operator} must be an object at path: ${path}`)
                } else {
                    this.validateObject(item, `${path}[${index}]`, depth + 1, schema)
                }
            })
        }

        // Валидация оператора $not
        else if (operator === '$not') {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                this.errors.push(`Operator $not must contain an object at path: ${path}`)
                return
            }
            this.validateObject(value, path, depth + 1, schema)
        }

        // Валидация операторов сравнения с массивами
        else if (['$in', '$nin', '$all'].includes(operator)) {
            if (!Array.isArray(value)) {
                this.errors.push(`Operator ${operator} must contain an array at path: ${path}`)
            }
        }

        // Валидация $exists
        else if (operator === '$exists') {
            if (typeof value !== 'boolean') {
                this.errors.push(`Operator $exists must contain a boolean at path: ${path}`)
            }
        }

        // Валидация $type
        else if (operator === '$type') {
            const validTypes = [
                'double',
                'string',
                'object',
                'array',
                'binData',
                'objectId',
                'bool',
                'date',
                'null',
                'regex',
                'int',
                'timestamp',
                'long',
                'decimal',
                'number',
                'many',
            ]
            const validTypeNumbers = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 16, 17, 18, 19]

            if (Array.isArray(value)) {
                value.forEach((v) => {
                    if (typeof v === 'string' && !validTypes.includes(v)) {
                        this.errors.push(`Invalid type "${v}" in $type at path: ${path}`)
                    } else if (typeof v === 'number' && !validTypeNumbers.includes(v)) {
                        this.errors.push(`Invalid type number "${v}" in $type at path: ${path}`)
                    }
                })
            } else if (typeof value === 'string' && !validTypes.includes(value)) {
                this.errors.push(`Invalid type "${value}" in $type at path: ${path}`)
            } else if (typeof value === 'number' && !validTypeNumbers.includes(value)) {
                this.errors.push(`Invalid type number "${value}" in $type at path: ${path}`)
            }
        }

        // Валидация $regex
        else if (operator === '$regex') {
            if (typeof value !== 'string' && !(value instanceof RegExp)) {
                this.errors.push(`Operator $regex must contain a string or RegExp at path: ${path}`)
            }
        }

        // Валидация $options (используется вместе с $regex)
        else if (operator === '$options') {
            if (typeof value !== 'string') {
                this.errors.push(`Operator $options must contain a string at path: ${path}`)
            }
        }

        // Валидация $elemMatch
        else if (operator === '$elemMatch') {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                this.errors.push(`Operator $elemMatch must contain an object at path: ${path}`)
            } else {
                this.validateObject(value, path, depth + 1, schema)
            }
        }

        // Валидация $size
        else if (operator === '$size') {
            if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
                this.errors.push(`Operator $size must contain a positive integer at path: ${path}`)
            }
        }

        // Валидация $mod
        else if (operator === '$mod') {
            if (
                !Array.isArray(value) ||
                value.length !== 2 ||
                typeof value[0] !== 'number' ||
                typeof value[1] !== 'number'
            ) {
                this.errors.push(`Operator $mod must contain an array of two numbers at path: ${path}`)
            }
        }
    }

    private validateField(
        fieldName: string,
        value: any,
        path: string,
        depth: number,
        schemaContext: Schema,
    ): void {
        const schemaToSearch = schemaContext

        // Поиск schemaPath (с поддержкой точечной нотации)
        let schemaPath = schemaToSearch.path(fieldName)

        // Если поле не найдено по имени, пробуем найти по полному пути (для вложенных полей, не являющихся субдокументами)
        if (!schemaPath) {
            // Убираем индексы массивов из пути (users[0].name -> users.name)
            const cleanPath = path.replace(/\[\d+\]/g, '')
            if (cleanPath !== fieldName) {
                schemaPath = schemaToSearch.path(cleanPath)
            }
        }

        if (!schemaPath) {
            const parts = fieldName.split('.')
            if (parts.length > 1) {
                let found = false
                for (let i = 1; i <= parts.length; i++) {
                    const testPath = parts.slice(0, i).join('.')
                    const testSchemaPath = schemaToSearch.path(testPath)
                    if (testSchemaPath) {
                        if (i === parts.length) {
                            schemaPath = testSchemaPath
                            found = true
                            break
                        }
                        if (testSchemaPath.schema) {
                            const remaining = parts.slice(i).join('.')
                            const nested = testSchemaPath.schema.path(remaining)
                            if (nested) {
                                schemaPath = nested
                                found = true
                                break
                            }
                        }
                    }
                }
                if (!found) {
                    // Если не найдено при сплите, попробуем проверить на родительский путь (для вложенных полей через точку)
                    // Но это уже должно было быть покрыто логикой в начале функции или ниже
                }
            } 
            
            if (!schemaPath) {
                // Проверка, что это родительский путь для вложенных полей (например profile для profile.bio)
                const cleanPath = path.replace(/\[\d+\]/g, '')
                const isParent = Object.keys(schemaToSearch.paths).some(p => p.startsWith(cleanPath + '.'))

                if (isParent) {
                    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                        this.validateObject(value, path, depth + 1, schemaToSearch)
                        return
                    } else {
                        // Родительский путь должен содержать объект
                        this.errors.push(`Field "${path}" must be an object`)
                        return
                    }
                }

                this.errors.push(`Field "${fieldName}" does not exist in schema at path: ${path}`)
                return
            }
        }

        // Если значение — объект (вложенный или с операторами)
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const hasOperators = Object.keys(value).some(k => k.startsWith('$'))

            if (hasOperators) {
                this.validateObject(value, path, depth + 1, schemaToSearch)
                return
            }

            // Это точное совпадение вложенного объекта: { profile: { bio: '...' } }
            if (schemaPath.schema) {
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    const nestedSchemaPath = schemaPath.schema.path(nestedKey)
                    if (!nestedSchemaPath) {
                        this.errors.push(`Field "${fieldName}.${nestedKey}" does not exist in subschema at path: ${path}`)
                        continue
                    }

                    const nestedPath = `${path}.${nestedKey}`

                    if (nestedValue !== null && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                        const hasNestedOps = Object.keys(nestedValue).some(k => k.startsWith('$'))
                        if (hasNestedOps) {
                            this.validateObject(nestedValue, nestedPath, depth + 1, schemaPath.schema)
                        } else {
                            this.validateField(nestedKey, nestedValue, nestedPath, depth + 1, schemaPath.schema)
                        }
                    } else {
                        // Проверка типа для примитивного значения внутри вложенного объекта
                        this.validateFieldType(nestedSchemaPath, nestedValue, nestedPath)
                    }
                }
                return
            } else {
                // Это обычный вложенный объект (не субдокумент), например profile: { bio: '...' }
                // В Mongoose такие поля доступны через точечную нотацию: profile.bio
                // Проверяем каждое вложенное поле через основную схему
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    const nestedFieldPath = `${fieldName}.${nestedKey}`
                    const nestedSchemaPath = schemaToSearch.path(nestedFieldPath)

                    if (!nestedSchemaPath) {
                        this.errors.push(`Field "${nestedFieldPath}" does not exist in schema at path: ${path}`)
                        continue
                    }

                    const nestedFullPath = `${path}.${nestedKey}`

                    if (nestedValue !== null && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                        const hasNestedOps = Object.keys(nestedValue).some(k => k.startsWith('$'))
                        if (hasNestedOps) {
                            this.validateObject(nestedValue, nestedFullPath, depth + 1, schemaToSearch)
                        } else {
                            // Рекурсивно проверяем ещё глубже вложенные объекты
                            this.validateField(nestedFieldPath, nestedValue, nestedFullPath, depth + 1, schemaToSearch)
                        }
                    } else {
                        // Проверяем тип примитивного значения
                        this.validateFieldType(nestedSchemaPath, nestedValue, nestedFullPath)
                    }
                }
                return
            }
        }

        // Если дошли сюда — значение примитивное (строка, число, null и т.д.)
        // Проверяем тип только для примитивов и объектов с операторами (но их уже обработали выше)
        this.validateFieldType(schemaPath, value, path)
    }

    /**
     * Валидация типа значения поля
     */
    private validateFieldType(schemaPath: any, value: any, path: string): void {
        const schemaType = schemaPath.instance

        // Если значение - это объект с операторами, пропускаем проверку типа
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const hasOperators = Object.keys(value).some((k) => k.startsWith('$'))
            if (hasOperators) return
        }

        // Базовая проверка типов
        switch (schemaType) {
            case 'String':
                if (value !== null && typeof value !== 'string' && typeof value !== 'object') {
                    this.errors.push(`Field "${path}" must be a string, got: ${typeof value}`)
                }
                break
            case 'Number':
                if (value !== null && typeof value !== 'number' && typeof value !== 'object') {
                    this.errors.push(`Field "${path}" must be a number, got: ${typeof value}`)
                }
                break
            case 'Boolean':
                if (value !== null && typeof value !== 'boolean' && typeof value !== 'object') {
                    this.errors.push(`Field "${path}" must be a boolean, got: ${typeof value}`)
                }
                break
            case 'Date':
                if (
                    value !== null &&
                    !(value instanceof Date) &&
                    typeof value !== 'string' &&
                    typeof value !== 'object'
                ) {
                    this.errors.push(`Field "${path}" must be a date, got: ${typeof value}`)
                }
                break
        }
    }

    /**
     * Дополнительная проверка безопасности запроса
     * Проверяет только ключи операторов, а не значения полей
     */
    static isSafeQuery(filterQuery: any): boolean {
        if (!filterQuery || typeof filterQuery !== 'object' || Array.isArray(filterQuery)) {
            return true
        }

        // Рекурсивная проверка ключей операторов
        const checkKeys = (obj: any): boolean => {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    // Проверяем, является ли ключ опасным оператором
                    if (key.startsWith('$')) {
                        const dangerousOperators = ['$where', '$function', '$accumulator']
                        if (dangerousOperators.includes(key)) {
                            return false
                        }
                        // Проверяем вложенные операторы в $expr
                        if (key === '$expr' && typeof obj[key] === 'object' && obj[key] !== null) {
                            if (!checkKeys(obj[key])) {
                                return false
                            }
                        }
                    }

                    // Рекурсивно проверяем вложенные объекты и массивы
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        if (Array.isArray(obj[key])) {
                            for (const item of obj[key]) {
                                if (typeof item === 'object' && item !== null && !checkKeys(item)) {
                                    return false
                                }
                            }
                        } else if (!checkKeys(obj[key])) {
                            return false
                        }
                    }
                }
            }
            return true
        }

        return checkKeys(filterQuery)
    }
}

/**
 * Хелпер для быстрой валидации
 */
export function validateFilterQuery(model: Model<any>, filterQuery: any, config?: ValidatorConfig): ValidationResult {
    const validator = new FilterQueryValidator(config)
    return validator.validate(filterQuery, model)
}

/**
 * Хелпер для проверки и парсинга строкового filterQuery
 */
export function parseAndValidateFilterQuery(
    model: Model<any>,
    filterQueryString: string,
    config?: ValidatorConfig,
): { filterQuery: any | null; validation: ValidationResult } {
    try {
        const filterQuery = JSON.parse(filterQueryString)
        const validation = validateFilterQuery(model, filterQuery, config)

        return {
            filterQuery: validation.isValid ? filterQuery : null,
            validation,
        }
        } catch (error) {
            return {
                filterQuery: null,
                validation: {
                    isValid: false,
                    errors: [`JSON parsing error: ${error instanceof Error ? error.message : String(error)}`],
                },
            }
        }
}
