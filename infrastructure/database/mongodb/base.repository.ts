import { Model, Document, FilterQuery, SortOrder, UpdateQuery, ProjectionType, UpdateResult } from 'mongoose'

// Тип для lean объектов - обычные JavaScript объекты без методов Mongoose
export type LeanObject<T> = Omit<T, keyof Document> & { _id: string }

// Вспомогательные типы для работы с projection
// Извлекает ключи из inclusion projection (где значение 1 или true)
type ExtractProjectionKeys<P> = P extends Record<string, any>
    ? {
          [K in keyof P]: P[K] extends 1 | true ? K : never
      }[keyof P]
    : never

// Создает тип результата на основе projection:
// - Если projection строка → возвращает полный LeanObject<T> (парсинг строки сложен)
// - Если projection пустой объект или нет ключей для включения → возвращает полный LeanObject<T>
// - Иначе → возвращает Pick с только указанными полями
type ProjectedLeanObject<T, P extends ProjectionType<T>> = P extends string
    ? LeanObject<T>
    : P extends Record<string, any>
        ? ExtractProjectionKeys<P> extends never
            ? LeanObject<T>
            : Pick<LeanObject<T>, ExtractProjectionKeys<P> & keyof LeanObject<T>>
        : LeanObject<T>

export abstract class BaseRepository<T extends Document> {
    protected readonly model: Model<T>

    constructor(model: Model<T>) {
        this.model = model
    }

    async create(item: Partial<T>): Promise<T> {
        try {
            const doc = new this.model(item)
            return await doc.save()
        } catch (error) {
            throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async createMany(items: Partial<T>[]): Promise<T[]> {
        try {
            return await this.model.create(items)
        } catch (error) {
            throw new Error(
                `Failed to create multiple documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    async findById(id: string): Promise<T | null> {
        try {
            return await this.model.findById(id).exec()
        } catch (error) {
            throw new Error(
                `Failed to find document by id: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    async findOne(filter: FilterQuery<T>): Promise<T | null> {
        try {
            return await this.model.findOne(filter).exec()
        } catch (error) {
            throw new Error(`Failed to find document: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async findAll(
        filter: FilterQuery<T> = {},
        sort: { [key: string]: SortOrder } = {},
        limit = 0,
        skip = 0,
    ): Promise<T[]> {
        try {
            return await this.model.find(filter).sort(sort).limit(limit).skip(skip).exec()
        } catch (error) {
            throw new Error(`Failed to find documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    // Lean versions - возвращают обычные JavaScript объекты
    async findAllLean(
        filter: FilterQuery<T> = {},
        projection: ProjectionType<T> = {},
        sort: { [key: string]: SortOrder } = {},
        limit = 0,
        skip = 0,
    ): Promise<LeanObject<T>[]> {
        try {
            return (await this.model
                .find(filter)
                .sort(sort)
                .limit(limit)
                .skip(skip)
                .select({
                    _id: 0,
                    // __v: 0,
                    ...(typeof projection === 'object' && projection !== null ? projection : {}),
                })
                .lean()
                .exec()) as LeanObject<T>[]
        } catch (error) {
            throw new Error(`Failed to find documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async findByIdLean(id: string): Promise<LeanObject<T> | null> {
        try {
            return (await this.model.findById(id).lean().exec()) as LeanObject<T> | null
        } catch (error) {
            throw new Error(
                `Failed to find document by id: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    async findOneLean<P extends ProjectionType<T> = {}>(
        filter: FilterQuery<T>,
        projection?: P,
    ): Promise<ProjectedLeanObject<T, P> | null> {
        try {
            const selectProjection =
                projection && typeof projection === 'object' && projection !== null
                    ? projection
                    : projection || {}

            return (await this.model
                .findOne(filter)
                .select(selectProjection)
                .lean()
                .exec()) as ProjectedLeanObject<T, P> | null
        } catch (error) {
            throw new Error(`Failed to find document: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async update(id: string, update: UpdateQuery<T>): Promise<T | null> {
        try {
            return await this.model.findByIdAndUpdate(id, update, { new: true }).exec()
        } catch (error) {
            throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async updateMany(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<UpdateResult> {
        try {
            return await this.model.updateMany(filter, update).exec()
        } catch (error) {
            throw new Error(`Failed to update documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async updateOneBy(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T | null> {
        const updatedDoc = await this.model.findOneAndUpdate(filter, update, { new: true }).exec()
        if (!updatedDoc) {
            throw new Error('No document found')
        }
        return updatedDoc
    }

    async updateOneByLean(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<LeanObject<T>> {
        try {
            const updatedDoc = (await this.model
                .findOneAndUpdate(filter, update, { new: true, projection: { _id: 0, __v: 0 } })
                .lean()
                .exec()) as LeanObject<T> | null

            if (!updatedDoc) {
                throw new Error(`No document found for filter: ${JSON.stringify(filter)}`)
            }

            return updatedDoc
        } catch (error) {
            throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async delete(id: string): Promise<T | null> {
        try {
            return await this.model.findByIdAndDelete(id).exec()
        } catch (error) {
            throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    // Новые методы для Mongoose 8
    async count(filter: FilterQuery<T> = {}): Promise<number> {
        try {
            return await this.model.countDocuments(filter).exec()
        } catch (error) {
            throw new Error(`Failed to count documents: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async exists(filter: FilterQuery<T>): Promise<boolean> {
        try {
            const result = await this.model.exists(filter)
            return result !== null
        } catch (error) {
            throw new Error(
                `Failed to check document existence: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    async deleteMany(filter: FilterQuery<T>): Promise<void> {
        await this.model.deleteMany(filter).exec()
    }
}
