# Полный флоу работы с Prisma

## 1. Инициализация проекта

В корне проекта-потребителя:

```bash
npx prisma init
```

Создаются:
- `prisma/schema.prisma` — схема и конфигурация
- `.env` — переменные окружения (добавьте `DATABASE_URL`)

Для PostgreSQL в `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

В `schema.prisma` укажите:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "./generated/prisma"
}
```

## 2. Создание и редактирование схемы

Добавляйте модели в `prisma/schema.prisma`:

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String?
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  title    String
  authorId Int
  author   User @relation(fields: [authorId], references: [id])
}
```

После изменений схемы — генерация клиента и (при необходимости) миграция.

## 3. Генерация клиента

После каждого изменения схемы:

```bash
npx prisma generate
```

Клиент появляется в пути из `generator client.output` (например, `./generated/prisma`). Импортируйте типы и PrismaClient оттуда.

## 4. Миграции

### Разработка (dev)

Создать миграцию и применить к БД:

```bash
npx prisma migrate dev --name add_user_table
```

Создаётся папка с SQL-миграцией и применяется к базе.

### Production

Только применить уже созданные миграции:

```bash
npx prisma migrate deploy
```

### Быстрая синхронизация (без миграций)

Только для прототипов и dev, без истории миграций:

```bash
npx prisma db push
```

## 5. Подключение к БД в коде

Создайте единственный экземпляр PrismaClient (singleton) и при старте приложения вызовите `$connect()`:

```typescript
import { PrismaClient } from './generated/prisma'

const prisma = new PrismaClient()

async function main() {
  await prisma.$connect()
  // ...
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

При использовании этой библиотеки передайте этот `prisma` в `PrismaManager.connect({ client: prisma })`.

## 6. Работа с транзакциями

Интерактивная транзакция:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.user.create({ data: { email: 'a@b.com', name: 'A' } })
  await tx.post.create({ data: { title: 'First', authorId: 1 } })
})
```

Последовательность запросов в одной транзакции:

```typescript
const [u, p] = await prisma.$transaction([
  prisma.user.create({ data: { email: 'a@b.com', name: 'A' } }),
  prisma.post.findMany(),
])
```

## 7. Seed данных

В `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

В `package.json`:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Запуск:

```bash
npx prisma db seed
```

## 8. Типичные сценарии и best practices

- **Один PrismaClient на приложение** — создавайте один экземпляр и переиспользуйте (singleton / DI).
- **Всегда вызывать `$disconnect()` при завершении** — в shutdown или в `finally` главного скрипта.
- **Миграции в dev — `migrate dev`**, в production — только **`migrate deploy`**.
- **Не коммитить сгенерированный клиент** — генерируйте его в CI или при `postinstall` через `prisma generate`.
- **Переменная `DATABASE_URL`** — хранить в `.env`, не в коде; в production — через секреты окружения.
