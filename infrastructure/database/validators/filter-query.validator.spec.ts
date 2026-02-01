import mongoose, { Schema, Model } from 'mongoose'
import {
  FilterQueryValidator,
  validateFilterQuery,
  parseAndValidateFilterQuery,
  ValidationResult,
} from './filter-query.validator'

// Тестовые схемы
interface ITestUser {
  name: string
  email: string
  age: number
  isActive: boolean
  createdAt: Date
  tags: string[]
  profile?: {
    bio: string
    avatarUrl?: string
  }
  metadata?: {
    level: number
    settings: {
      notifications: boolean
    }
  }
}

const TestUserSchema = new Schema<ITestUser>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: { type: Number, required: true },
  isActive: { type: Boolean, required: true },
  createdAt: { type: Date, required: true },
  tags: [{ type: String }],
  profile: {
    bio: { type: String },
    avatarUrl: { type: String },
  },
  metadata: {
    level: { type: Number },
    settings: {
      notifications: { type: Boolean },
    },
  },
})

let TestUserModel: Model<ITestUser>

// Простая схема для базовых тестов
interface ISimple {
  field: string
}

const SimpleSchema = new Schema<ISimple>({
  field: { type: String },
})

let SimpleModel: Model<ISimple>

describe('FilterQueryValidator', () => {
  beforeAll(() => {
    TestUserModel = mongoose.model('TestUser', TestUserSchema)
    SimpleModel = mongoose.model('Simple', SimpleSchema)
  })

  afterAll(async () => {
    mongoose.deleteModel('TestUser')
    mongoose.deleteModel('Simple')
  })

  describe('Базовая валидация', () => {
    it('должен принять пустой объект', () => {
      const result = validateFilterQuery(TestUserModel, {})
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен принять null', () => {
      const result = validateFilterQuery(TestUserModel, null)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен принять undefined', () => {
      const result = validateFilterQuery(TestUserModel, undefined)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('должен отклонить примитивные типы', () => {
      const result = validateFilterQuery(TestUserModel, 'string')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('FilterQuery must be an object')
    })

    it('должен отклонить массив на верхнем уровне', () => {
      const result = validateFilterQuery(TestUserModel, [])
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('FilterQuery cannot be an array at the top level')
    })

    it('должен принять простой фильтр по полю', () => {
      const result = validateFilterQuery(TestUserModel, { name: 'John' })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить несуществующее поле', () => {
      const result = validateFilterQuery(TestUserModel, { nonExistentField: 'value' })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('does not exist in schema')
    })
  })

  describe('Операторы сравнения', () => {
    it('должен принять $eq', () => {
      const result = validateFilterQuery(TestUserModel, { age: { $eq: 25 } })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $ne', () => {
      const result = validateFilterQuery(TestUserModel, { age: { $ne: 25 } })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $gt', () => {
      const result = validateFilterQuery(TestUserModel, { age: { $gt: 18 } })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $gte', () => {
      const result = validateFilterQuery(TestUserModel, { age: { $gte: 18 } })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $lt', () => {
      const result = validateFilterQuery(TestUserModel, { age: { $lt: 100 } })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $lte', () => {
      const result = validateFilterQuery(TestUserModel, { age: { $lte: 100 } })
      expect(result.isValid).toBe(true)
    })

    it('должен принять несколько операторов для одного поля', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $gte: 18, $lte: 65 },
      })
      expect(result.isValid).toBe(true)
    })
  })

  describe('Операторы $in и $nin', () => {
    it('должен принять $in с массивом', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $in: ['John', 'Jane'] },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $nin с массивом', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $nin: ['John', 'Jane'] },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $in без массива', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $in: 'John' },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must contain an array')
    })

    it('должен принять $in с пустым массивом', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $in: [] },
      })
      expect(result.isValid).toBe(true)
    })
  })

  describe('Логические операторы', () => {
    it('должен принять $and с массивом условий', () => {
      const result = validateFilterQuery(TestUserModel, {
        $and: [{ name: 'John' }, { age: 25 }],
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $or с массивом условий', () => {
      const result = validateFilterQuery(TestUserModel, {
        $or: [{ name: 'John' }, { name: 'Jane' }],
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $nor с массивом условий', () => {
      const result = validateFilterQuery(TestUserModel, {
        $nor: [{ name: 'John' }, { age: { $lt: 18 } }],
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $and без массива', () => {
      const result = validateFilterQuery(TestUserModel, {
        $and: { name: 'John' },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must contain an array')
    })

    it('должен отклонить $or с пустым массивом', () => {
      const result = validateFilterQuery(TestUserModel, {
        $or: [],
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('cannot contain an empty array')
    })

    it('должен отклонить $and с не-объектами', () => {
      const result = validateFilterQuery(TestUserModel, {
        $and: ['string', 123],
      })
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('должен принять вложенные логические операторы', () => {
      const result = validateFilterQuery(TestUserModel, {
        $and: [
          { name: 'John' },
          {
            $or: [{ age: { $lt: 25 } }, { age: { $gt: 65 } }],
          },
        ],
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять сложную комбинацию логических операторов', () => {
      const result = validateFilterQuery(TestUserModel, {
        $and: [
          {
            $or: [{ name: 'John' }, { name: 'Jane' }],
          },
          {
            $nor: [{ age: { $lt: 18 } }, { isActive: false }],
          },
        ],
      })
      expect(result.isValid).toBe(true)
    })
  })

  describe('Оператор $not', () => {
    it('должен принять $not с объектом', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $not: { $gt: 25 } },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $not с не-объектом', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $not: 25 },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must contain an object')
    })

    it('должен отклонить $not с массивом', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $not: [{ $gt: 25 }] },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен отклонить $not с null', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $not: null },
      })
      expect(result.isValid).toBe(false)
    })
  })

  describe('Оператор $exists', () => {
    it('должен принять $exists: true', () => {
      const result = validateFilterQuery(TestUserModel, {
        email: { $exists: true },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $exists: false', () => {
      const result = validateFilterQuery(TestUserModel, {
        email: { $exists: false },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $exists с не-boolean', () => {
      const result = validateFilterQuery(TestUserModel, {
        email: { $exists: 'true' },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must contain a boolean')
    })

    it('должен отклонить $exists с числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        email: { $exists: 1 },
      })
      expect(result.isValid).toBe(false)
    })
  })

  describe('Оператор $type', () => {
    it('должен принять $type со строкой', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $type: 'string' },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $type с числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $type: 2 },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $type с массивом типов', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $type: ['string', 'null'] },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $type с недопустимым типом', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $type: 'invalidType' },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Invalid type')
    })

    it('должен отклонить $type с недопустимым номером типа', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $type: 999 },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен принять все валидные типы', () => {
      const validTypes = ['double', 'string', 'object', 'array', 'bool', 'date', 'null', 'int']
      validTypes.forEach((type) => {
        const result = validateFilterQuery(TestUserModel, {
          name: { $type: type },
        })
        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('Оператор $regex', () => {
    it('должен принять $regex со строкой', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $regex: '^John' },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять $regex с RegExp', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $regex: /^John/i },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $regex с числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $regex: 123 },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must contain a string or RegExp')
    })
  })

  describe('Массивные операторы', () => {
    it('должен принять $all с массивом', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $all: ['nodejs', 'typescript'] },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $all без массива', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $all: 'nodejs' },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен принять $elemMatch с объектом', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $elemMatch: { $eq: 'nodejs' } },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $elemMatch без объекта', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $elemMatch: 'nodejs' },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен принять $size с числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $size: 3 },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $size с отрицательным числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $size: -1 },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен отклонить $size с дробным числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $size: 3.5 },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен отклонить $size со строкой', () => {
      const result = validateFilterQuery(TestUserModel, {
        tags: { $size: '3' },
      })
      expect(result.isValid).toBe(false)
    })
  })

  describe('Оператор $mod', () => {
    it('должен принять $mod с массивом из двух чисел', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $mod: [5, 0] },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить $mod с одним числом', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $mod: [5] },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен отклонить $mod с тремя числами', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $mod: [5, 0, 1] },
      })
      expect(result.isValid).toBe(false)
    })

    it('должен отклонить $mod со строками', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: { $mod: ['5', '0'] },
      })
      expect(result.isValid).toBe(false)
    })
  })

  describe('Вложенные поля', () => {
    it('должен принять фильтр по вложенному полю через точку', () => {
      const result = validateFilterQuery(TestUserModel, {
        'profile.bio': 'Developer',
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять фильтр по глубоко вложенному полю', () => {
      const result = validateFilterQuery(TestUserModel, {
        'metadata.settings.notifications': true,
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять фильтр по вложенному объекту', () => {
      const result = validateFilterQuery(TestUserModel, {
        profile: { bio: 'Developer' },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить несуществующее вложенное поле', () => {
      const result = validateFilterQuery(TestUserModel, {
        'profile.nonExistent': 'value',
      })
      expect(result.isValid).toBe(false)
    })

    it('должен принять операторы для вложенных полей', () => {
      const result = validateFilterQuery(TestUserModel, {
        'metadata.level': { $gte: 5 },
      })
      expect(result.isValid).toBe(true)
    })
  })

  describe('Проверка глубины вложенности', () => {
    it('должен принять запрос в пределах максимальной глубины', () => {
      const result = validateFilterQuery(
        TestUserModel,
        {
          $and: [
            { $or: [{ name: 'John' }, { name: 'Jane' }] },
            { $and: [{ age: { $gt: 18 } }, { isActive: true }] },
          ],
        },
        { maxDepth: 10 }
      )
      expect(result.isValid).toBe(true)
    })

    it('должен отклонить слишком глубокую вложенность', () => {
      const deepQuery = {
        $and: [
          {
            $and: [
              {
                $and: [
                  {
                    $and: [{ name: 'John' }],
                  },
                ],
              },
            ],
          },
        ],
      }
      const result = validateFilterQuery(TestUserModel, deepQuery, { maxDepth: 2 })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Maximum nesting depth exceeded')
    })

    it('должен использовать значение maxDepth по умолчанию', () => {
      let deepQuery: any = { name: 'John' }
      for (let i = 0; i < 15; i++) {
        deepQuery = { $and: [deepQuery] }
      }
      const result = validateFilterQuery(TestUserModel, deepQuery)
      expect(result.isValid).toBe(false)
    })
  })

  describe('Кастомные операторы', () => {
    it('должен отклонить недопустимый оператор', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $invalidOperator: 'value' },
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Invalid operator')
    })

    it('должен принять только разрешенные операторы из конфига', () => {
      const result = validateFilterQuery(
        TestUserModel,
        {
          name: { $regex: '^John' },
        },
        {
          allowedOperators: ['$eq', '$ne'],
        }
      )
      expect(result.isValid).toBe(false)
    })

    it('должен принять оператор из списка разрешенных', () => {
      const result = validateFilterQuery(
        TestUserModel,
        {
          name: { $eq: 'John' },
        },
        {
          allowedOperators: ['$eq', '$ne'],
        }
      )
      expect(result.isValid).toBe(true)
    })

    it('должен блокировать опасные операторы по умолчанию', () => {
      const result = validateFilterQuery(TestUserModel, {
        $where: 'this.name === "John"',
      })
      expect(result.isValid).toBe(false)
    })
  })

  describe('Типы значений полей', () => {
    it('должен отклонить неправильный тип для String поля', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: 123,
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must be a string')
    })

    it('должен отклонить неправильный тип для Number поля', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: 'not a number',
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must be a number')
    })

    it('должен отклонить неправильный тип для Boolean поля', () => {
      const result = validateFilterQuery(TestUserModel, {
        isActive: 'true',
      })
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('must be a boolean')
    })

    it('должен принять null для любого поля', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: null,
      })
      expect(result.isValid).toBe(true)
    })

    it('должен принять объект с операторами вместо прямого значения', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $ne: null },
      })
      expect(result.isValid).toBe(true)
    })
  })

  describe('Комплексные запросы', () => {
    it('должен принять реальный комплексный запрос', () => {
      const result = validateFilterQuery(TestUserModel, {
        $and: [
          {
            $or: [{ name: { $regex: '^John' } }, { email: { $regex: '@example.com$' } }],
          },
          {
            age: { $gte: 18, $lte: 65 },
          },
          {
            isActive: true,
          },
          {
            tags: { $in: ['developer', 'engineer'] },
          },
          {
            'profile.bio': { $exists: true },
          },
        ],
      })
      expect(result.isValid).toBe(true)
    })

    it('должен правильно обрабатывать смешанные операторы', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: 'John',
        $or: [{ age: { $lt: 25 } }, { age: { $gt: 65 } }],
        isActive: { $ne: false },
        tags: { $all: ['developer'] },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен собирать множественные ошибки', () => {
      const result = validateFilterQuery(TestUserModel, {
        nonExistentField1: 'value',
        nonExistentField2: 'value',
        age: 'not a number',
      })
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Edge cases', () => {
    it('должен обрабатывать пустую строку как поле', () => {
      const result = validateFilterQuery(SimpleModel, {
        '': 'value',
      })
      expect(result.isValid).toBe(false)
    })

    it('должен обрабатывать поля с спецсимволами', () => {
      const result = validateFilterQuery(TestUserModel, {
        'some.weird.field.name': 'value',
      })
      expect(result.isValid).toBe(false)
    })

    it('должен обрабатывать очень длинные имена полей', () => {
      const longFieldName = 'a'.repeat(1000)
      const result = validateFilterQuery(TestUserModel, {
        [longFieldName]: 'value',
      })
      expect(result.isValid).toBe(false)
    })

    it('должен обрабатывать Date объекты', () => {
      const result = validateFilterQuery(TestUserModel, {
        createdAt: new Date(),
      })
      expect(result.isValid).toBe(true)
    })

    it('должен обрабатывать RegExp объекты', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: /^John/i,
      })
      expect(result.isValid).toBe(true)
    })

    it('должен обрабатывать BigInt (если поддерживается)', () => {
      const result = validateFilterQuery(TestUserModel, {
        age: BigInt(25),
      })
      // BigInt может быть не поддержан, но не должен вызывать исключение
      expect(result).toBeDefined()
    })

    it('должен обрабатывать Symbol', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: Symbol('test'),
      })
      expect(result.isValid).toBe(false)
    })

    it('должен обрабатывать циклические ссылки без падения', () => {
      const circular: any = { name: 'John' }
      circular.self = circular
      
      // Может быть invalid или выброшено исключение, но не должно зависнуть
      expect(() => {
        validateFilterQuery(TestUserModel, circular)
      }).not.toThrow()
    })

    it('должен обрабатывать очень большие массивы', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $in: Array(10000).fill('test') },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен обрабатывать Unicode символы', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $eq: '你好世界' },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен обрабатывать emoji', () => {
      const result = validateFilterQuery(TestUserModel, {
        name: { $eq: '🚀😀' },
      })
      expect(result.isValid).toBe(true)
    })
  })

  describe('parseAndValidateFilterQuery', () => {
    it('должен парсить и валидировать корректный JSON', () => {
      const jsonString = '{"name":"John","age":25}'
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString)
      
      expect(result.validation.isValid).toBe(true)
      expect(result.filterQuery).toEqual({ name: 'John', age: 25 })
    })

    it('должен отклонить некорректный JSON', () => {
      const jsonString = '{name:"John"}'
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString)
      
      expect(result.validation.isValid).toBe(false)
      expect(result.filterQuery).toBeNull()
      expect(result.validation.errors[0]).toContain('JSON parsing error')
    })

    it('должен парсить и валидировать комплексный JSON', () => {
      const jsonString = JSON.stringify({
        $and: [{ name: 'John' }, { age: { $gte: 18 } }],
      })
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString)
      
      expect(result.validation.isValid).toBe(true)
    })

    it('должен отклонить JSON с невалидными полями', () => {
      const jsonString = '{"nonExistentField":"value"}'
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString)
      
      expect(result.validation.isValid).toBe(false)
      expect(result.filterQuery).toBeNull()
    })

    it('должен обрабатывать пустую строку', () => {
      const result = parseAndValidateFilterQuery(TestUserModel, '')
      
      expect(result.validation.isValid).toBe(false)
      expect(result.filterQuery).toBeNull()
    })

    it('должен обрабатывать JSON с экранированными символами', () => {
      const jsonString = '{"name":"John\\"Doe"}'
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString)
      
      expect(result.validation.isValid).toBe(true)
      expect(result.filterQuery?.name).toBe('John"Doe')
    })

    it('должен обрабатывать JSON с Unicode escape последовательностями', () => {
      const jsonString = '{"name":"\\u0048\\u0065\\u006C\\u006C\\u006F"}'
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString)
      
      expect(result.validation.isValid).toBe(true)
      expect(result.filterQuery?.name).toBe('Hello')
    })

    it('должен применять кастомную конфигурацию', () => {
      const jsonString = '{"name":{"$regex":"^John"}}'
      const result = parseAndValidateFilterQuery(TestUserModel, jsonString, {
        allowedOperators: ['$eq', '$ne'],
      })
      
      expect(result.validation.isValid).toBe(false)
    })
  })

  describe('FilterQueryValidator.isSafeQuery', () => {
    it('должен принять безопасный запрос', () => {
      const query = { name: 'John', age: { $gte: 18 } }
      expect(FilterQueryValidator.isSafeQuery(query)).toBe(true)
    })

    it('должен отклонить запрос с $where', () => {
      const query = { $where: 'this.name === "John"' }
      expect(FilterQueryValidator.isSafeQuery(query)).toBe(false)
    })

    it('должен отклонить запрос с $function', () => {
      const query = { $function: { body: 'function() { return true; }' } }
      expect(FilterQueryValidator.isSafeQuery(query)).toBe(false)
    })

    it('должен отклонить запрос с $accumulator', () => {
      const query = { $accumulator: {} }
      expect(FilterQueryValidator.isSafeQuery(query)).toBe(false)
    })

    it('должен отклонить запрос с $expr и $function', () => {
      const query = { $expr: { $function: {} } }
      expect(FilterQueryValidator.isSafeQuery(query)).toBe(false)
    })

    it('должен принять запрос с $where в строковом значении (не оператор)', () => {
      const query = { description: 'This is $where you find it' }
      expect(FilterQueryValidator.isSafeQuery(query)).toBe(true)
    })
  })

  describe('Производительность', () => {
    it('должен быстро валидировать простой запрос', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        validateFilterQuery(TestUserModel, { name: 'John' })
      }
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(1000) // должно быть быстрее 1 секунды для 1000 итераций
    })

    it('должен обрабатывать большие запросы за разумное время', () => {
      const largeQuery = {
        $and: Array(100).fill({ name: 'John' }),
      }
      
      const start = Date.now()
      validateFilterQuery(TestUserModel, largeQuery)
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(500)
    })
  })

  describe('Множественные ошибки', () => {
    it('должен находить все ошибки в одном запросе', () => {
      const result = validateFilterQuery(TestUserModel, {
        nonExistent1: 'value',
        nonExistent2: 'value',
        age: 'not a number',
        $invalidOp: [{ name: 'John' }],
        tags: { $size: -5 },
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(3)
    })

    it('должен предоставлять понятные сообщения об ошибках', () => {
      const result = validateFilterQuery(TestUserModel, {
        nonExistentField: 'value',
      })
      
      expect(result.errors[0]).toContain('does not exist in schema')
      expect(result.errors[0]).toContain('nonExistentField')
    })
  })

  describe('Специальные случаи MongoDB', () => {
    it('должен обрабатывать оператор $text', () => {
      const result = validateFilterQuery(
        TestUserModel,
        {
          $text: { $search: 'John' },
        },
        {
          allowedOperators: [...FilterQueryValidator['DEFAULT_OPERATORS']],
        }
      )
      expect(result).toBeDefined()
    })

    it('должен обрабатывать геопространственные операторы', () => {
      const result = validateFilterQuery(
        TestUserModel,
        {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [0, 0] },
              $maxDistance: 1000,
            },
          },
        },
        {
          allowedOperators: [...FilterQueryValidator['DEFAULT_OPERATORS']],
        }
      )
      expect(result).toBeDefined()
    })
  })

  describe('Интеграция с реальными сценариями', () => {
    it('должен валидировать фильтр для поиска активных пользователей', () => {
      const result = validateFilterQuery(TestUserModel, {
        isActive: true,
        age: { $gte: 18 },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен валидировать фильтр для поиска по дате регистрации', () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      const result = validateFilterQuery(TestUserModel, {
        createdAt: { $gte: weekAgo, $lte: now },
      })
      expect(result.isValid).toBe(true)
    })

    it('должен валидировать фильтр для полнотекстового поиска', () => {
      const result = validateFilterQuery(TestUserModel, {
        $or: [
          { name: { $regex: 'john', $options: 'i' } },
          { email: { $regex: 'john', $options: 'i' } },
          { 'profile.bio': { $regex: 'john', $options: 'i' } },
        ],
      })
      expect(result.isValid).toBe(true)
    })
  })
})