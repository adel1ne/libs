# Сборка и публикация npm-пакета

## 1. Сборка пакета

Перед публикацией или использованием пакета нужно собрать артефакты:

```bash
yarn install   # если ещё не ставили зависимости
yarn build     # компиляция TypeScript → папка dist/
```

В `dist/` появятся скомпилированные `.js`, `.d.ts` и `.map`. В npm-пакет попадает только папка `dist` (указано в `package.json` → `files`).

---

## 2. Варианты использования

### Вариант A: Публикация в npm Registry (публичный или приватный)

**Подготовка:**

1. Убедитесь, что в `package.json` указаны:
   - `name` — например `@adel1ne/libs` (scoped) или `your-libs`
   - `version` — семантическая версия (например `0.0.1`, `1.0.0`)

2. Для **приватного** пакета в npm: в `package.json` добавьте `"private": false` и оплатите приватные пакеты, либо используйте другой registry (GitHub Packages, Verdaccio и т.п.).

**Публикация:**

```bash
yarn build                    # собрать перед публикацией
npm login                     # войти в npm (один раз)
npm publish --access public   # для scoped-пакета (@scope/name) первый раз нужен --access public
```

Для следующих версий:

```bash
# Поднять версию (patch/minor/major)
npm version patch   # 0.0.1 → 0.0.2
# или вручную поменять "version" в package.json

yarn build
npm publish
```

**Подключение в другом проекте:**

```bash
yarn add @adel1ne/libs
# или
npm install @adel1ne/libs
```

---

### Вариант B: Локальное использование (без публикации в registry)

**Через путь к папке (file:):**

В проекте, где нужен пакет:

```bash
yarn add file:../path/to/libs
# или в package.json:
# "dependencies": { "@adel1ne/libs": "file:../libs" }
```

После этого в проекте доступны импорты из `@adel1ne/libs` (или как указано в `name`). При изменении libs нужно заново выполнить `yarn build` в libs и при необходимости обновить зависимость в целевом проекте.

**Через yarn link:**

```bash
# В репозитории libs:
cd d:\www\libs
yarn build
yarn link

# В целевом проекте:
yarn link "@adel1ne/libs"
```

Удобно для разработки: изменения в libs после `yarn build` подхватываются в проекте без переустановки.

**Через tgz-архив (перенос на другую машину):**

```bash
cd d:\www\libs
yarn build
npm pack    # создаётся файл adel1ne-libs-0.0.1.tgz (или без scope: libs-0.0.1.tgz)
```

В другом проекте:

```bash
yarn add ./path/to/adel1ne-libs-0.0.1.tgz
```

---

## 3. Что попадает в пакет

- В `package.json` задано `"files": ["dist"]` — в архив пакета включается только `dist/`.
- Исходники (`api-connectors/`, `infrastructure/`, `utils/`, `*.ts`) в пакет не попадают.

Перед каждой публикацией или упаковкой обязательно выполняйте `yarn build`.

---

## 4. Чек-лист перед публикацией

- [ ] Версия в `package.json` обновлена при необходимости.
- [ ] Выполнен `yarn build`, папка `dist/` актуальна.
- [ ] При необходимости обновлены `description`, `repository`, `license` в `package.json`.
- [ ] Для публикации в npm: выполнен `npm login`, для scoped-пакета первый раз указан `--access public` при `npm publish`.

---

## 5. Импорты в проекте-потребителе

После установки пакета:

```ts
// Всё из одного входа
import { LoggerService } from '@adel1ne/libs'

// Или по подпутям
import { LoggerService } from '@adel1ne/libs/utils'
import { BullmqService } from '@adel1ne/libs/infrastructure'
import { GraphQLConnectorHandler } from '@adel1ne/libs/api-connectors'
```

Имя пакета везде замените на актуальное из `package.json` (`name`).
