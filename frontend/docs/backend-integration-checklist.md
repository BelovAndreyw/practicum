# Backend Integration Checklist

Статус интеграции фронтенда с реальным API.

## Готово

- Все страницы используют `frontend/src/api/endpoints/*.ts`, не захардкоженные mock-данные в runtime.
- Vite dev proxy читает `VITE_BACKEND_URL` из `.env*`.
- Docker-сборка фронтенда: `VITE_USE_MOCK=false`, `VITE_API_BASE=/api` (build-args в `frontend/Dockerfile` и compose).
- Загрузка файлов:
  - новости → `POST /posts/` (multipart)
  - отчёты → `POST /reports/{id}/files`
  - аватары → `POST /team/profile/avatar`
  - обложки событий → `POST /events/{id}/image`
- Открытие файлов отчётов: `reportsApi.openFile` → `GET /reports/{id}/files/{file_id}`

## Переменные окружения

### Production / Docker

```env
VITE_API_BASE=/api
VITE_USE_MOCK=false
```

Задаются через build-args compose, отдельный `frontend/.env.production` **не используется**.

### Локальная разработка с backend

**Docker backend (порт 8000):**

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_API_BASE=/api
VITE_FORCE_REAL_API=true
```

**Локальный uvicorn (порт 8080 в `main.py`):**

```env
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE=/api
VITE_FORCE_REAL_API=true
```

## Deploy

- Nginx проксирует `/api/*` → backend.
- Pilot: volume `uploads-pilot:/app/uploads` для сохранения загруженных файлов.

## Не интегрировано во фронтенде

- `POST /auth/verify`, `POST /auth/register` — нет UI-экранов
- `POST /team/{id}/join-request`, обработка заявок капитаном — только backend

## Справочники

- API: [`api-contract.md`](api-contract.md)
- Запуск фронта: [`../README.md`](../README.md)
- Обзор проекта: [`../../docs/project-overview.md`](../../docs/project-overview.md)
