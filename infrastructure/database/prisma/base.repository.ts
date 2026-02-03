/**
 * Минимальный интерфейс делегата модели Prisma (например prisma.user).
 * Совместим с сгенерированными делегатами в проекте-потребителе.
 */
export interface PrismaDelegate<T, TWhereUnique, TWhere, TCreateInput, TUpdateInput> {
    create(args: { data: TCreateInput }): Promise<T>
    createMany(args: { data: TCreateInput[] }): Promise<{ count: number }>
    findUnique(args: { where: TWhereUnique }): Promise<T | null>
    findFirst(args?: { where?: TWhere; orderBy?: unknown; take?: number; skip?: number }): Promise<T | null>
    findMany(args?: { where?: TWhere; orderBy?: unknown; take?: number; skip?: number }): Promise<T[]>
    update(args: { where: TWhereUnique; data: TUpdateInput }): Promise<T>
    updateMany(args: { where?: TWhere; data: TUpdateInput }): Promise<{ count: number }>
    delete(args: { where: TWhereUnique }): Promise<T>
    deleteMany(args?: { where?: TWhere }): Promise<{ count: number }>
    count(args?: { where?: TWhere }): Promise<number>
}

/**
 * Базовый репозиторий для работы с моделью Prisma.
 * Типы T, TWhereUnique, TWhere, TCreateInput, TUpdateInput задаются в проекте-потребителе.
 */
export abstract class BasePrismaRepository<
    T,
    TWhereUnique,
    TWhere = unknown,
    TCreateInput = Partial<T>,
    TUpdateInput = Partial<T>,
> {
    protected abstract get delegate(): PrismaDelegate<T, TWhereUnique, TWhere, TCreateInput, TUpdateInput>

    /**
     * Строит условие where по первичному ключу (для findById, update, delete).
     */
    protected abstract buildWhereById(id: number | string): TWhereUnique

    async create(data: TCreateInput): Promise<T> {
        try {
            return await this.delegate.create({ data: data })
        } catch (error) {
            throw new Error(`Failed to create: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async createMany(items: TCreateInput[]): Promise<number> {
        try {
            const result = await this.delegate.createMany({ data: items })
            return result.count
        } catch (error) {
            throw new Error(
                `Failed to create many: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    async findById(id: number | string): Promise<T | null> {
        try {
            return await this.delegate.findUnique({ where: this.buildWhereById(id) })
        } catch (error) {
            throw new Error(
                `Failed to find by id: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    async findOne(where: TWhere): Promise<T | null> {
        try {
            return await this.delegate.findFirst({ where: where as TWhere })
        } catch (error) {
            throw new Error(`Failed to find one: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async findMany(
        where: TWhere = {} as TWhere,
        options?: { orderBy?: unknown; take?: number; skip?: number },
    ): Promise<T[]> {
        try {
            return await this.delegate.findMany({
                where: where as TWhere,
                orderBy: options?.orderBy,
                take: options?.take,
                skip: options?.skip,
            })
        } catch (error) {
            throw new Error(`Failed to find many: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async update(id: number | string, data: TUpdateInput): Promise<T> {
        try {
            return await this.delegate.update({
                where: this.buildWhereById(id),
                data: data as TUpdateInput,
            })
        } catch (error) {
            throw new Error(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async updateMany(where: TWhere, data: TUpdateInput): Promise<number> {
        try {
            const result = await this.delegate.updateMany({ where: where as TWhere, data: data as TUpdateInput })
            return result.count
        } catch (error) {
            throw new Error(`Failed to update many: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async delete(id: number | string): Promise<T> {
        try {
            return await this.delegate.delete({ where: this.buildWhereById(id) })
        } catch (error) {
            throw new Error(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async deleteMany(where?: TWhere): Promise<number> {
        try {
            const result = await this.delegate.deleteMany({ where: where as TWhere })
            return result.count
        } catch (error) {
            throw new Error(`Failed to delete many: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async count(where: TWhere = {} as TWhere): Promise<number> {
        try {
            return await this.delegate.count({ where: where as TWhere })
        } catch (error) {
            throw new Error(`Failed to count: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async exists(where: TWhere): Promise<boolean> {
        try {
            const n = await this.delegate.count({ where: where as TWhere })
            return n > 0
        } catch (error) {
            throw new Error(
                `Failed to check existence: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }
}
