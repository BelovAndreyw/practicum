# Командный зачёт — обзор проекта

**«Командный зачёт»** — учебный веб-сервис для УрФУ: командная игра с рейтингами, челленджами, событиями и взаимопомощью между командами. Проект разворачивается на [teamzachet.ru](https://teamzachet.ru) и ведётся как practicum-репозиторий с полноценной DevOps-инфраструктурой.

## Назначение

Студенты объединяются в команды, выполняют задания, участвуют в событиях, сдают еженедельные check-in'ы, помогают другим командам («спасения») и накапливают **КРК** (командный рейтинговый коэффициент). Организаторы управляют челленджами, новостями, модерацией отчётов и голосованиями.

### Роли

| Роль (backend) | Роль (frontend) | Возможности |
|----------------|-----------------|-------------|
| `student` | `student` | Участие в команде, челленджи, инструменты |
| `captain` | `captain` | Управление командой, приглашения, заявки |
| `teacher` | `organizer` | Панель организатора (маппинг в `frontend/src/api/mappers/user.ts`) |
| `admin` | `organizer` | То же, что `teacher` |

## Архитектура

```
┌─────────────────────┐
│   Пользователь      │
│   (Браузер / SPA)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Nginx             │
│   (TLS, reverse     │
│    proxy, headers)  │
└──────┬────────┬─────┘
       │        │
       ▼        ▼
┌──────────┐ ┌──────────┐
│ Frontend │ │ Backend  │
│ React    │ │ FastAPI  │
└──────────┘ └──┬───────┘
                │
                ▼
         ┌──────────┐
         │PostgreSQL│
         │  (БД)    │
         └──────────┘
```

- **Nginx** — единая точка входа: `/` → фронтенд, `/api` → backend.
- **Backend** — модульный монолит на FastAPI с async SQLAlchemy.
- **Frontend** — SPA на React 18 + TypeScript + Vite, CSS Modules, собственная UI-библиотека.

Подробнее о развёртывании: [`deployment-schema.md`](deployment-schema.md).

## Технологический стек

### Backend

- Python 3.12, **FastAPI**, Uvicorn
- **SQLAlchemy 2** (async), **asyncpg** (PostgreSQL), **aiosqlite** (локально/CI)
- **JWT** (`python-jose`), пароли — **bcrypt**
- Pydantic v2, `python-multipart` для загрузки файлов

### Frontend

- **React 18**, **TypeScript**, **Vite 5**, **React Router 6**
- Mock-режим по умолчанию в dev; переключение на реальный API через env (см. [`../frontend/README.md`](../frontend/README.md))

### Инфраструктура

- **Docker** + **Docker Compose** (dev / test / pilot)
- **Nginx** (TLS, gzip, HSTS, rate-limit на `/api/auth/`)
- **GitHub Actions**: сборка, healthchecks, pytest, `pip-audit`, gitleaks, деплой pilot

## Структура репозитория

```
practicum/
├── backend/          # FastAPI API
│   ├── app/
│   │   ├── core/     # config, DB, security, demo seed
│   │   ├── models/   # SQLAlchemy-модели
│   │   └── modules/  # бизнес-модули (auth, team, rating, …)
│   └── tests/        # pytest
├── frontend/         # React SPA
│   └── src/
│       ├── api/      # клиент, endpoints, mappers, mock
│       ├── pages/    # экраны приложения
│       ├── features/ # auth (Login, ProtectedRoute)
│       └── components/
├── infra/            # docker-compose, nginx, SSL-скрипты
├── docs/             # документация
├── scripts/          # seed, deploy, sync
└── .github/workflows/
```

## Backend: модули и API

Все роутеры подключаются в `backend/app/main.py`. Префиксы API (через nginx — под `/api`):

| Модуль | Префикс | Назначение |
|--------|---------|------------|
| `auth` | `/auth` | Верификация студента, регистрация, логин, `/me` |
| `team` | `/team` | Создание команды, участники, инвайты, заявки |
| `teams` | `/teams` | Публичные профили команд |
| `posts` | `/posts` | Новости/посты с изображениями |
| `feed` | `/feed` | Лента активностей |
| `challenges` | `/challenges` | Челленджи, запись команд, отчёты |
| `reports` | `/reports` | Отчёты команд с файлами |
| `events` | `/events` | События, приглашения, участники |
| `checkins` | `/checkins` | Еженедельные check-in'ы |
| `help` | `/help` | «Спасения» — заявки на помощь между командами |
| `rating` | `/rating` | Индивидуальный и командный рейтинг, лиги |
| `voting` | `/voting` | Внутрикомандное голосование |

### Основные сущности

- **Student / User** — данные из вуза + аккаунт с ролью
- **Team, TeamMember, TeamInviteLink, TeamJoinRequest** — команды
- **UserRating, TeamRating, RatingLog, LeagueSettings** — рейтинги и лиги
- **Challenge, TeamChallenge** — челленджи
- **TeamReport, ReportFile, ReportTask** — отчёты с файлами
- **TeamEvent, EventInvitation, EventParticipant** — события
- **WeeklyCheckin, CheckinTask** — еженедельные отчёты
- **HelpRequest, HelpResponse** — взаимопомощь («спасения»)
- **VoteRound, VoteBallot** — голосование в команде
- **Activity, TeamActivityLog** — лента и история
- **UserAchievement** — достижения (каталог в `backend/app/modules/achievement/catalog.py`)

### Формула КРК

Индивидуальный рейтинг:

```
Total = (Base × 0.6) + (Unity × 0.3) + (Bonus × 0.1) + Penalty
```

На основе `total_krk` определяется лига участника. Реализация: `backend/app/modules/rating/logic.py`.

### Аутентификация

1. **POST `/auth/verify`** — проверка `student_id` по таблице `students`
2. **POST `/auth/register`** — регистрация с verification token
3. **POST `/auth/login`** — JWT access token
4. **GET `/auth/me`** — профиль и достижения (синхронизация достижений — при **логине**, `auth/logic.py`)

В `DEMO_MODE=true` (значение по умолчанию в `config.py`, если env не задан) при старте сидируются демо-пользователи. В `.env.example` рекомендуется `DEMO_MODE=false`. План SSO: [`sso-integration.md`](sso-integration.md).

### Загрузка файлов

Утилиты: `backend/app/core/uploads.py`. Файлы на диске, метаданные в БД.

| Тип | Директория | API |
|-----|------------|-----|
| Посты | `uploads/posts/` | `POST /posts/`, `GET /posts/{id}/images/{id}` |
| Отчёты | `uploads/reports/` | `POST /reports/{id}/files`, `GET /reports/{id}/files/{fid}` |
| Аватары | `uploads/avatars/` | `POST/DELETE /team/profile/avatar`, `GET /team/users/{id}/avatar` |
| События | `uploads/events/` | `POST/DELETE/GET /events/{id}/image` |

Volume `uploads-pilot` — только в pilot compose. Dev/test: файлы **эфемерны** при пересоздании контейнера.

Внешние URL (`avatar_url`, `image_url`) остаются запасным вариантом; приоритет у загруженного файла.

### Backend без UI во фронтенде

- `/auth/verify`, `/auth/register` — нет экранов регистрации
- `/team/{id}/join-request`, `/team/{id}/requests` — заявки на вступление не подключены к React

## Frontend: экраны

| Маршрут | Страница | Описание |
|---------|----------|----------|
| `/login` | `LoginPage` | Вход |
| `/` | `DashboardPage` | Новости, биржа знаний, лента активностей |
| `/profile` | `ProfilePage` | Свой профиль, достижения, КРК |
| `/users/:userId` | `UserProfilePage` | Профиль другого участника |
| `/team` | `TeamPage` | Моя команда |
| `/teams`, `/teams/:teamId` | `TeamsListPage`, `TeamDetailPage` | Каталог команд |
| `/rating` | `RatingPage` | Рейтинги команд и участников |
| `/challenges` | `ChallengesPage` | Челленджи |
| `/events` | `EventsPage` | Календарь событий |
| `/tools` | `ToolsPage` | Check-in, спасения, голосование |
| `/admin` | `AdminPage` | Панель организатора (только `organizer`) |

Навигация — боковое меню (`frontend/src/components/layout/Sidebar.tsx`). Защищённые маршруты — через `ProtectedRoute` с JWT.

### Режимы API

- **Mock** (по умолчанию в dev) — данные из `frontend/src/api/mock/`
- **Real API** — `VITE_FORCE_REAL_API=true`, `VITE_BACKEND_URL`, `VITE_API_BASE=/api`

## Окружения

| Окружение | Compose | Назначение |
|-----------|---------|------------|
| **dev** | `infra/docker-compose.dev.yml` | Локальная разработка, HTTP, открытые порты |
| **test** | `infra/docker-compose.test.yml` | CI/CD, self-signed TLS |
| **pilot** | `infra/docker-compose.pilot.yml` | Продакшен на teamzachet.ru, Let's Encrypt |

**Pilot-сервер:** IP `77.91.93.156`, путь `/opt/teamzachet`, домен `teamzachet.ru`.

## CI/CD и безопасность

**CI** (`.github/workflows/ci.yml`) на push/PR в `master`:

- сборка Docker-образов
- подъём test compose + healthchecks
- **pytest** (в CI job — SQLite; в test compose — PostgreSQL)
- **pip-audit** по зависимостям Python
- автодеплой pilot при push в `master`

**Secret scan** — gitleaks на каждый push.

Чеклист безопасности: [`security-checklist.md`](security-checklist.md).

## Тесты

Backend-тесты (`backend/tests/`):

- `test_auth.py`, `test_team.py`, `test_challenges.py`
- `test_rating.py`, `test_achievements.py`, `test_voting.py`
- `test_help.py`, `test_posts.py`, `test_uploads.py`

Запуск:

```bash
cd backend
python -m pytest
```

## Быстрый старт

### Dev через Docker

```bash
cp .env.example .env
# заполнить POSTGRES_*, DATABASE_URL, SECRET_KEY, DEMO_MODE

docker compose -f infra/docker-compose.dev.yml --env-file .env up -d --build
# API: http://localhost/api/...
```

### Frontend локально

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### Pilot локально (self-signed TLS)

```bash
cp .env.pilot.example .env.pilot
bash infra/ssl/generate-self-signed.sh pilot
docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot up -d --build
curl -k https://localhost/api/
```

### Seed данных на pilot

При `DEMO_MODE=false` демо-сид при старте не выполняется. Данные можно загрузить вручную:

```bash
python scripts/seed_all.py
```

Логин организатора после seed: `teacher_ip` / `teacher123`.

## Связанная документация

| Файл | Содержание |
|------|------------|
| [`deployment-schema.md`](deployment-schema.md) | Архитектура, окружения, CI/CD |
| [`sso-integration.md`](sso-integration.md) | План SSO УрФУ |
| [`security-checklist.md`](security-checklist.md) | Безопасность |
| [`pilot-server-bootstrap.md`](pilot-server-bootstrap.md) | Первичная настройка сервера |
| [`pilot-github-setup.md`](pilot-github-setup.md) | GitHub Secrets, branch protection |
| [`ux-ui-mvp.md`](ux-ui-mvp.md) | UX/UI-концепция MVP |
| [`mvp-coverage.md`](mvp-coverage.md) | Покрытие ТЗ |
| [`project-roadmap.md`](project-roadmap.md) | Дорожная карта проекта |
| [`diagnostics-testandfix.md`](diagnostics-testandfix.md) | Диагностика ветки TestAndFix |
| [`../frontend/README.md`](../frontend/README.md) | Запуск фронтенда |
| [`../frontend/docs/api-contract.md`](../frontend/docs/api-contract.md) | API-контракт |
| [`../frontend/docs/backend-integration-checklist.md`](../frontend/docs/backend-integration-checklist.md) | Интеграция фронта с API |
| [`../README.md`](../README.md) | Быстрый старт в корне репозитория |
