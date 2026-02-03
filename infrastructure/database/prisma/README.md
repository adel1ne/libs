# Вводный курс по Prisma ORM

## Что такое Prisma?

Prisma — современный ORM (Object-Relational Mapping) для Node.js и TypeScript, который обеспечивает:

- **Type-safe** доступ к базе данных — все запросы типизированы
- **Schema-first подход** — модели описываются в файле `schema.prisma`
- **Автогенерация клиента** — PrismaClient генерируется автоматически с полной типизацией
- **Встроенная система миграций** — управление схемой БД через код

## Ключевые концепции

### 1. Prisma Schema (`schema.prisma`)

Центральный файл, описывающий модели данных и конфигурацию:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "./generated/prisma"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  Int
}
```

### 2. PrismaClient — доступ к данным

```typescript
import { PrismaClient } from './generated/prisma'

const prisma = new PrismaClient()

// CREATE
const user = await prisma.user.create({
  data: { email: 'alice@example.com', name: 'Alice' }
})

// READ
const users = await prisma.user.findMany({
  where: { email: { contains: '@example.com' } },
  include: { posts: true }
})

// UPDATE
await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Alice Smith' }
})

// DELETE
await prisma.user.delete({ where: { id: 1 } })
```

### 3. Singleton Pattern (рекомендуемый подход)

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### 4. Основные команды CLI

| Команда | Описание |
|---------|----------|
| `npx prisma init` | Инициализация проекта (создаёт schema.prisma и .env) |
| `npx prisma generate` | Генерация PrismaClient из схемы |
| `npx prisma migrate dev --name init` | Создание и применение миграции (dev) |
| `npx prisma migrate deploy` | Применение миграций (production) |
| `npx prisma db push` | Быстрая синхронизация схемы без миграции |
| `npx prisma studio` | Веб-интерфейс для просмотра данных |

### 5. Отличия от Mongoose

| Аспект | Mongoose (MongoDB) | Prisma (PostgreSQL) |
|--------|--------------------|----------------------|
| Тип БД | Документная (NoSQL) | Реляционная (SQL) |
| Схема | В коде JS/TS | Файл schema.prisma |
| Типизация | Частичная (generics) | Полная автогенерация |
| Миграции | Внешние инструменты | Встроенная система |
| Связи | References/populate | Нативные JOIN |

## Использование в этой библиотеке

- **PrismaManager** — управление подключением: `connect()`, `disconnect()`, `healthCheck()`, `shutdown()`.
- **BasePrismaRepository** — базовый репозиторий с CRUD-методами; наследуйте его и задайте делегат и типы в проекте-потребителе.

Файл `schema.prisma` и команда `prisma generate` выполняются в проекте-потребителе, не в этой библиотеке. Пакеты `prisma` (dev) и `@prisma/client` тоже добавляются в проект-потребитель.
