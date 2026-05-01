# Командный зачёт — Frontend

Веб-фронтенд игры «Командный зачёт». React + TypeScript + Vite.

## Быстрый старт

```bash
cd frontend
cp .env.example .env.development   # уже скопирован в репо
npm install
npm run dev                         # http://localhost:5173
```

По умолчанию `VITE_USE_MOCK=true` — бэкенд не нужен.

## Подключение бэкенда

1. Запустите backend на `http://localhost:8080` (или другом порту).
2. Отредактируйте `.env.development`:
   ```
   VITE_BACKEND_URL=http://localhost:8080
   VITE_API_BASE=/api
   VITE_USE_MOCK=false
   ```
3. Перезапустите `npm run dev`.

Vite проксирует запросы `/api/*` на `VITE_BACKEND_URL`, поэтому CORS не нужен в dev-режиме.

## Production-сборка

```bash
npm run build      # dist/
npm run preview    # проверка dist/ локально
```

## Структура проекта

```
src/
├── api/                  # HTTP-клиент + эндпоинты + mock-данные
│   ├── client.ts         # fetch-обёртка, ApiError
│   ├── endpoints/        # по одному файлу на ресурс (auth, teams, ...)
│   ├── mock/
│   │   ├── data.ts       # mock-объекты всех сущностей
│   │   └── delay.ts      # имитация задержки сети
│   └── index.ts          # реэкспорт всех API
│
├── components/
│   ├── ui/               # базовые UI-компоненты (Button, Card, Badge, ...)
│   └── layout/           # AppLayout, Sidebar, Header
│
├── features/
│   └── auth/             # AuthContext, ProtectedRoute, LoginPage
│
├── pages/                # страницы (1 файл = 1 маршрут)
├── styles/               # CSS-токены + reset + global
├── types/                # TypeScript-типы DTO (User, Team, Challenge, ...)
├── router.tsx            # react-router v6 createBrowserRouter
└── main.tsx
```

## API-интеграция

Полный контракт: [`docs/api-contract.md`](docs/api-contract.md).

Весь обмен данных инкапсулирован в `src/api/endpoints/*.ts`.
Для перехода с mock на реальный бэк достаточно:
1. Поставить `VITE_USE_MOCK=false`
2. Убедиться, что эндпоинты возвращают те же DTO, что описаны в `src/types/index.ts`

## Переменные окружения

| Переменная         | По умолчанию              | Описание                              |
|--------------------|---------------------------|---------------------------------------|
| `VITE_BACKEND_URL` | `http://localhost:8080`   | URL backend-сервера                   |
| `VITE_API_BASE`    | `/api`                    | Префикс всех API-запросов             |
| `VITE_USE_MOCK`    | `true`                    | `true` — mock, `false` — реальный бэк |

## Технологии

- React 18 + TypeScript 5
- Vite 5 (dev-сервер, сборка)
- React Router v6 (SPA-роутинг)
- CSS Modules (изоляция стилей)
- Нет глобального state-менеджера — state локален в компонентах + AuthContext

## Скрипты

| Команда           | Описание                              |
|-------------------|---------------------------------------|
| `npm run dev`     | Dev-сервер на порту 5173              |
| `npm run build`   | Production-сборка в `dist/`           |
| `npm run preview` | Локальный просмотр `dist/`            |
| `npm run typecheck` | Проверка типов без сборки           |
