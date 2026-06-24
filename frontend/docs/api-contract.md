# API Contract — Командный зачёт

Актуальный контракт между фронтендом и backend. Все пути относительны `VITE_API_BASE` (по умолчанию `/api`).

**Источник правды в коде:**

- Backend: `backend/app/modules/*/router.py`, OpenAPI `/docs`
- Frontend: `frontend/src/api/endpoints/*.ts`, мапперы в `frontend/src/api/mappers/`

> Старые пути (`/users`, `/news`, `/rescues`) **не используются** — это legacy mock-схема.

## Авторизация

- JWT в заголовке `Authorization: Bearer <token>` (`frontend/src/api/client.ts`)
- Токен в `localStorage` (`access_token`)
- `credentials: 'include'` на fetch; cookie `session` **не** используется
- Роли frontend: `student` | `captain` | `organizer` (backend: `student`, `captain`, `teacher`, `admin`)

### POST `/auth/login`

```json
{ "username": "smirnov_ap", "password": "..." }
```

Ответ:

```json
{ "access_token": "...", "token_type": "bearer" }
```

Профиль после логина: `GET /auth/me` + `GET /team/profile`, `GET /rating/my-rating`.

### GET `/auth/me`

Текущий пользователь. Синхронизация достижений выполняется при **логине** (`backend/app/modules/auth/logic.py`), не при каждом `/me`.

### POST `/auth/verify`, POST `/auth/register`

Реализованы на backend; **отдельного UI нет** — только `LoginPage` с логином/паролем.

### Logout

Backend endpoint отсутствует. Клиент очищает `localStorage` (`authApi.logout`).

## Профиль и команда (`/team`)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/team/profile` | Свой профиль |
| PATCH | `/team/profile` | ФИО, контакты, внешний `avatar_url` |
| POST | `/team/profile/avatar` | Загрузка аватара (multipart `file`) |
| DELETE | `/team/profile/avatar` | Удалить загруженный аватар |
| GET | `/team/users/{id}` | Публичный профиль |
| GET | `/team/users/{id}/avatar` | Файл аватара |
| POST | `/team/create` | Создать команду |
| GET | `/team/search?query=*` | Поиск команд |
| GET | `/team/{id}` | Детали команды |
| POST | `/team/join-by-link` | Вступление по коду |
| POST | `/team/{id}/invite` | Создать инвайт (капитан) |
| POST | `/team/{id}/join-request` | Заявка на вступление (**UI не реализован**) |
| GET | `/team/{id}/requests` | Заявки капитану (**UI не реализован**) |

## Контент и активность

| Префикс | Назначение |
|---------|------------|
| `/posts` | Новости; `POST /` multipart (title, content, files[]); `GET /{post_id}/images/{image_id}` |
| `/feed` | Лента активностей |
| `/challenges` | Челленджи, запись команд |
| `/reports` | Отчёты; `POST /{id}/files` — вложения |
| `/events` | События; `POST/DELETE/GET /{id}/image` — обложка |
| `/checkins` | Weekly check-in |
| `/help` | «Спасения» |
| `/rating` | `my-rating`, `top-teams`, `leaderboard`, админ-настройки |
| `/voting` | Раунды голосования в команде |

## Загрузка файлов

| Тип | Директория на диске | Лимит |
|-----|---------------------|-------|
| Посты | `uploads/posts/` | image/*, 5 MB |
| Отчёты | `uploads/reports/` | 10 MB |
| Аватары | `uploads/avatars/` | image/*, 5 MB |
| События | `uploads/events/` | image/*, 5 MB |

В pilot данные в volume `uploads-pilot`. В dev/test при пересоздании контейнера файлы теряются.

Приоритет URL: загруженный файл → внешний `avatar_url` / `image_url`.

## Ошибки

FastAPI: `{ "detail": "..." }` или массив validation errors. Клиент: `ApiError` в `frontend/src/api/client.ts`.

## Mock-режим

В dev по умолчанию endpoints в `frontend/src/api/endpoints/*.ts` возвращают данные из `frontend/src/api/mock/`. Отключение: `VITE_FORCE_REAL_API=true`.
