# Keitaro Wrapper

[![CI](https://github.com/TerrniT/keitaro-wrap/actions/workflows/ci.yml/badge.svg)](https://github.com/TerrniT/keitaro-wrap/actions/workflows/ci.yml)

Обёртка над рекламным трекером **Keitaro**: создание кампаний в два клика и редактор офферов в потоках с живыми цифрами из Keitaro.

Проект сделан как тестовое задание: FastAPI + SQLAlchemy на бэкенде, React + shadcn/ui на фронтенде.

![Список кампаний](docs/screenshots/campaigns.png)

## Что умеет

### 1. Создаватор кампаний

Форма принимает:

- название кампании;
- гео (одна или несколько стран, ISO-2);
- оффер из Keitaro (поиск по названию или ID);
- домен, группу и источник (подставляются из настроек, можно изменить).

По нажатию «Создать кампанию» обёртка:

1. создаёт кампанию в Keitaro с префиксом `test_<фамилия>_` и уникальным alias;
2. привязывает домен, группу и traffic source;
3. создаёт **два потока**:
   - `Google` — фильтр `country IS <выбранные страны>`, редирект на `https://www.google.com`;
   - `Offers` — выбранный оффер со 100% трафика;
4. сохраняет метаданные кампании (гео, оффер, домен, группа, источник) в свою БД.

![Создание кампании](docs/screenshots/create-campaign.png)

### 2. Редактор офферов

Редактор открывается по клику на кампанию:

- показывает потоки кампании и офферы в них;
- позволяет **добавлять** офферы из кэша Keitaro и **удалять** их;
- удалённые офферы не исчезают: они остаются внизу таблицы с долей 0% и кнопкой «Вернуть»;
- доли активных офферов всегда пересчитываются так, чтобы сумма была ровно **100%**;
- изменения копятся в черновике и применяются только по кнопке **«Сохранить в Keitaro»**;
- «Отменить» возвращает состояние из Keitaro;
- показывает реальные клики, конверсии, выручку, профит, ROI и 14-дневный тренд по каждому офферу из отчётного API Keitaro;
- показывает «кликов сегодня» в заголовке каждого потока.

![Редактор кампании](docs/screenshots/campaign-editor.png)

### 3. Настройки

- префикс названий кампаний;
- домен, группа и источник по умолчанию;
- синхронизация кэша офферов;
- проверка подключения к Keitaro.

![Настройки](docs/screenshots/settings.png)

## Стек

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, httpx, Pydantic v2.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Recharts.
- **БД:** SQLite по умолчанию, PostgreSQL поддерживается (SQLAlchemy + psycopg).
- **Keitaro:** Admin API v1 (`/admin_api/v1`).

```
React + shadcn/ui  ──HTTP──▶  FastAPI  ──Admin API──▶  Keitaro
                                 │
                                 ▼
                         SQLAlchemy (SQLite/Postgres)
```

## Быстрый запуск через Docker

```bash
cp .env.example .env
# открой .env и укажи KEITARO_BASE_URL и KEITARO_API_KEY
docker compose up --build
```

Открой [http://localhost:8000](http://localhost:8000). Миграции Alembic применяются автоматически в entrypoint контейнера.

## Локальная разработка

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

cp ../.env.example ../.env
# заполни KEITARO_API_KEY и при необходимости DEFAULT_* настройки

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger: [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite откроется на `http://localhost:5173` и проксирует `/api` на `http://127.0.0.1:8000`.

### Сборка одного приложения

FastAPI умеет отдавать собранный фронтенд:

```bash
cd frontend
npm run build
rm -rf ../backend/static
cp -r dist ../backend/static
cd ../backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

После этого всё доступно на `http://localhost:8000`.

## Переменные окружения

| Переменная | Назначение | Пример |
|---|---|---|
| `KEITARO_BASE_URL` | Адрес трекера | `https://tlgk.host` |
| `KEITARO_API_KEY` | Admin API key из Keitaro | `xxxxxxxx` |
| `CAMPAIGN_PREFIX` | Обязательный префикс названий | `test_kotovsky_` |
| `DEFAULT_DOMAIN_ID` | Домен по умолчанию | `1813` |
| `DEFAULT_GROUP_ID` | Группа кампаний по умолчанию | `9799` |
| `DEFAULT_TRAFFIC_SOURCE_ID` | Источник по умолчанию | `836` |
| `DATABASE_URL` | SQLAlchemy URL | `sqlite:///./data/keitaro_wrapper.db` |
| `REPORT_TIMEZONE` | Таймзона отчётов | `Europe/Moscow` |
| `CORS_ORIGINS` | Разрешённые origins для dev | `http://localhost:5173,...` |
| `AUTO_CREATE_TABLES` | Создавать таблицы на старте без Alembic | `false` |
| `SEED_OFFER_CACHE_ON_STARTUP` | Прогревать кэш офферов при старте | `false` |

**Не коммить `.env`.** В репозитории лежит только `.env.example`.

### Где взять API-ключ Keitaro

1. Войди в админку Keitaro.
2. Нажми на иконку профиля справа сверху.
3. **Account → API keys → Create API key**.
4. Скопируй ключ в `KEITARO_API_KEY`.

Ключ используется только бэкендом. В браузер он не попадает.

## Миграции

Проект использует Alembic.

```bash
cd backend

# применить все миграции
alembic upgrade head

# откатить последнюю
alembic downgrade -1

# создать новую миграцию после изменения моделей
alembic revision --autogenerate -m "add something"
```

Начальная миграция: `backend/alembic/versions/b10b14dd10d1_initial_schema.py`.

Для PostgreSQL:

```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/keitaro_wrapper
```

и снова `alembic upgrade head`.

## Как это работает

### Создание кампании

`POST /api/campaigns`:

```json
{
  "name": "campaign1",
  "geo": ["DE", "AT"],
  "offer_id": 10184,
  "domain_id": 1813,
  "group_id": 9799,
  "traffic_source_id": 836
}
```

Бэкенд:

- валидирует ISO-коды через `pycountry`;
- проверяет оффер через кэш/Admin API;
- применяет префикс `test_<фамилия>_`;
- генерирует alias `<slug>-<random hex>`;
- создаёт кампанию и два потока через `/campaigns` и `/streams`;
- при ошибке создания второго потока архивирует уже созданную кампанию.

### Редактор и доли

Keitaro хранит у оффера в потоке поле `share`. Обёртка считает доли сама:

- `1` оффер → `[100]`
- `2` оффера → `[50, 50]`
- `3` оффера → `[34, 33, 33]`
- `4` оффера → `[25, 25, 25, 25]`
- `7` офферов → `[15, 15, 14, 14, 14, 14, 14]`

Сумма всегда 100%. Остаток от деления достаётся первым офферам.

Удаление оффера:

1. оффер убирается из `offers` потока;
2. в локальной таблице `removed_offers` появляется «надгробие» с ID, названием и последней долей;
3. в Keitaro уходит `PUT /streams/{id}` с новым списком офферов;
4. при следующем открытии кампании удалённый оффер показывается с 0% и кнопкой «Вернуть».

«Вернуть» добавляет оффер обратно в список, пересчитывает доли и удаляет «надгробие» после сохранения.

### Цифры

Статистика берётся из `POST /admin_api/v1/report/build`:

- клики, конверсии, выручка, cost, profit, ROI, CR, EPC;
- разрез `stream_id + offer_id` для таблицы;
- разрез `stream_id + offer_id + day` для спарклайнов;
- «клики сегодня» считается из дневного отчёта, без отдельного запроса.

Отчёты кэшируются на 60 секунд в таблице `stats_cache`, чтобы не дёргать Keitaro при каждом рендере.

### Зачем SQLAlchemy

Keitaro — источник истины. Локальная БД хранит только то, чего в удобном виде нет в API:

- `campaign_records` — гео/оффер/домен/группа/источник для кампаний, созданных через обёртку;
- `removed_offers` — удалённые офферы, чтобы работала кнопка «Вернуть»;
- `offers_cache` — быстрый автокомплит по офферам;
- `stats_cache` — TTL-кэш отчётов;
- `app_settings` — префикс и значения по умолчанию.

## API

Все методы бэкенда доступны в Swagger (`/docs`). Кратко:

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/health` | Проверка приложения и Keitaro |
| `GET` | `/api/meta` | Домены, группы, источники, страны, настройки |
| `GET` | `/api/settings` | Настройки по умолчанию |
| `PUT` | `/api/settings` | Обновить настройки |
| `GET` | `/api/countries` | Справочник стран |
| `GET` | `/api/campaigns` | Список кампаний + статистика |
| `POST` | `/api/campaigns` | Создать кампанию и два потока |
| `GET` | `/api/campaigns/{id}` | Кампания, потоки, офферы, цифры |
| `GET` | `/api/campaigns/{id}/stats` | Статистика кампании |
| `PUT` | `/api/campaigns/{id}/streams/{stream_id}/offers` | Сохранить список офферов и доли |
| `POST` | `/api/campaigns/{id}/streams/{stream_id}/offers` | Добавить оффер |
| `DELETE` | `/api/campaigns/{id}/streams/{stream_id}/offers/{offer_id}` | Удалить оффер |
| `POST` | `/api/campaigns/{id}/streams/{stream_id}/offers/{offer_id}/restore` | Вернуть оффер |
| `GET` | `/api/offers?q=` | Поиск офферов по кэшу |
| `POST` | `/api/offers/sync` | Обновить кэш офферов |
| `DELETE` | `/api/campaigns/{id}` | Архивировать кампанию |

## Тесты

### Backend

```bash
cd backend
pytest
```

Тесты не ходят в реальный Keitaro: используется in-memory SQLite и `FakeKeitaroClient`. Покрыты:

- распределение долей (сумма 100%);
- префикс и alias;
- валидация гео;
- создание кампании с двумя потоками;
- добавление/удаление/возврат офферов и «надгробия».

### E2E: полный цикл создания кампании в UI

Сценарий Playwright проходит весь путь в браузере:

1. открывает `Создать кампанию`;
2. проверяет, что кнопка создания заблокирована до заполнения обязательных полей;
3. вводит название, выбирает гео `Germany` и оффер `10184`;
4. проверяет предпросмотр `test_kotovsky_*` и выбранные потоки;
5. нажимает «Создать кампанию»;
6. проверяет, что приложение перешло в редактор кампании;
7. проверяет два потока (`Google` + `Offers`), оффер `#10184` и долю `100%`;
8. сверяет payload, который ушёл в `POST /api/campaigns` (имя, гео, offer_id, domain_id, group_id, traffic_source_id).

Файл: `frontend/e2e/create-campaign.spec.ts`.

```bash
cd frontend
npm install
npx playwright install chromium   # один раз
npm run test:e2e                  # mock Keitaro API, детерминированно, работает в CI
npm run test:e2e:ui               # Playwright UI mode
```

Mock-сервер для E2E лежит в `frontend/e2e/mock-api.ts`, фикстуры — в `fixtures.ts`.

#### Live E2E против настоящего Keitaro

Тот же сценарий можно прогнать против реального трекера. Тест создаёт кампанию
`test_kotovsky_e2e_<timestamp>`, проверяет два потока и **архивирует её в `finally`**.

```bash
# 1. В отдельном терминале подними backend с боевым .env
cd backend
uvicorn app.main:app --reload --port 8000

# 2. Запусти live-сценарий
cd frontend
E2E_LIVE=1 E2E_BACKEND_URL=http://127.0.0.1:8000 npm run test:e2e:live
```

Оффер по умолчанию — `10184`; можно переопределить:

```bash
E2E_LIVE=1 E2E_BACKEND_URL=http://127.0.0.1:8000 \
  E2E_OFFER_ID=10184 E2E_COUNTRY=Germany \
  npm run test:e2e:live
```

Файл: `frontend/e2e/create-campaign-live.spec.ts`.

## Структура проекта

```
.
├── .github/workflows/ci.yml     # backend tests + frontend build + E2E
├── backend/
│   ├── alembic/                 # миграции
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── keitaro.py           # async-клиент Admin API
│   │   ├── models.py            # SQLAlchemy-модели
│   │   ├── schemas.py           # Pydantic-схемы
│   │   ├── services/            # бизнес-логика
│   │   └── routers/             # HTTP-роуты
│   ├── tests/
│   └── requirements*.txt
├── frontend/
│   ├── e2e/                     # Playwright: mock + live сценарии
│   ├── src/
│   │   ├── components/          # shell, комбобоксы, shadcn/ui
│   │   ├── pages/               # кампании, создание, редактор, настройки
│   │   └── lib/                 # API-клиент, форматирование
│   ├── playwright.config.ts
│   └── package.json
├── docs/screenshots/
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Ограничения и заметки

- Обёртка **не создаёт офферы** — только привязывает существующие офферы Keitaro к потокам. В тестовом API-пользователе офферы могут быть доступны только на чтение; этого достаточно.
- Для кампаний, созданных не через обёртку, гео в списке может быть пустым. Открой редактор — фильтр страны виден в потоке.
- Если домен кампании не резолвится (бывает в тестовых трекерах), кнопка «Проверить» использует адрес самого трекера и alias кампании. Настройка домена при этом всё равно сохраняется в Keitaro.
- Префикс `test_` обязателен: бэкенд добавляет его сам, даже если пользователь ввёл название без префикса. Поменяй `CAMPAIGN_PREFIX` на свою фамилию.
- Keitaro иногда отвечает 502/429. Клиент повторяет безопасные GET/отчётные запросы, а интерфейс показывает понятную ошибку.
- Большие списки кампаний загружаются целиком (Admin API не даёт серверный поиск). Для тестового трекера это сотни записей; для десятков тысяч потребуется пагинация/виртуализация.

## Лицензия

MIT. Используй как угодно.
