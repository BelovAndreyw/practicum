# Командный зачёт — Frontend

Фронтенд игры «Командный зачёт» на React + TypeScript + Vite.

## Быстрый запуск (локально)

```bash
git clone https://github.com/BelovAndreyw/practicum.git
cd practicum/frontend
npm install
npm run dev
```

Открыть: `http://localhost:5173`

## Локальный вход в mock-режиме

По умолчанию в `dev` mock включён автоматически (`frontend/src/api/mock/config.ts`), даже без `.env`.

- Данные из `frontend/src/api/mock/`
- Вход: поле «логин» сопоставляется с **email** mock-пользователя (например `student@urfu.ru`), пароль любой

Для демонстрации UI backend не нужен.

## Как включить реальный backend

### Вариант A: Docker dev-стенд (рекомендуется)

```bash
# из корня репозитория
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d --build
```

API: `http://localhost/api/...` (nginx), backend напрямую: `http://localhost:8000`

В `frontend/.env.development`:

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_API_BASE=/api
VITE_FORCE_REAL_API=true
```

### Вариант B: backend без Docker (`uvicorn` на 8080)

```env
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE=/api
VITE_FORCE_REAL_API=true
```

Vite proxy по умолчанию смотрит на `http://localhost:8080` (`frontend/vite.config.ts`).

Перезапустить: `npm run dev`

> `VITE_USE_MOCK=false` в dev **не отключает** mock сам по себе — нужен `VITE_FORCE_REAL_API=true`.

## Production-сборка

Docker-сборка фронтенда (`frontend/Dockerfile`, compose) передаёт build-args:

- `VITE_API_BASE=/api`
- `VITE_USE_MOCK=false`

Локально:

```bash
npm run build
npm run preview
```

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `VITE_BACKEND_URL` | Адрес backend для Vite proxy (dev) |
| `VITE_API_BASE` | Префикс API, обычно `/api` |
| `VITE_USE_MOCK` | `true` в production-like сборках без mock |
| `VITE_FORCE_REAL_API` | В dev принудительно отключает mock |

## API и контракт

Актуальные вызовы — в `frontend/src/api/endpoints/*.ts`. Справочник: [`docs/api-contract.md`](docs/api-contract.md). OpenAPI backend: `/docs` (при запущенном API).

## Частые проблемы

1. **Пустые списки при «залогиненном» UI** — протухший JWT; перелогиньтесь или включите `VITE_FORCE_REAL_API=true` и проверьте backend.
2. **`localhost:5173` не открывается** — запущен ли `npm run dev`, свободен ли порт 5173.
3. **Белая страница** — DevTools → Console, `Ctrl+F5`.
4. **Node.js** — рекомендуется 20+.
