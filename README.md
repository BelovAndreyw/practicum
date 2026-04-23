# Командный зачёт

Учебный сервис с ролями (студент/капитан/организатор) и API.

## Стек (MVP)

- **Backend**: Python 3.12, **FastAPI**, Uvicorn
- **DB/ORM**: PostgreSQL 16 (dev/test через Docker), SQLAlchemy 2 (async), asyncpg; для локальных/CI тестов — SQLite (aiosqlite)
- **Auth**: JWT (`python-jose`), пароли — `bcrypt`
- **Reverse proxy**: **Nginx** (маршрутизация `/api` → backend, `/` → frontend)
- **Frontend**: пока статическая заглушка (HTML/CSS/JS) под Nginx
- **Infra**: Docker + Docker Compose
- **CI/DevSecOps**: GitHub Actions (build/healthchecks/pytest/`pip-audit`), secret-scan `gitleaks`

## Структура репозитория

- `backend/` — FastAPI приложение (`app/main.py`, модули `auth/team/posts`)
- `frontend/` — статический прототип (stub) для проверки инфраструктуры
- `infra/` — compose, nginx конфиги, ssl-скрипты
- `.github/workflows/` — CI пайплайны
- `docs/` — документация

## Быстрый старт (dev)

Нужны Docker Engine + Docker Compose v2.

```bash
# 1) Создать .env (не коммитить)
# Минимум: POSTGRES_*, DATABASE_URL, SECRET_KEY, DEMO_MODE

# 2) Запуск dev стенда
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d --build

# 3) Проверка
curl -s http://localhost:8000/

# API доступно через nginx под /api:
# http://localhost/api/...

# 4) Остановка
docker compose -f infra/docker-compose.dev.yml --env-file .env down
```

## CI: что проверяется (DevOps часть)

На push/PR в `master` workflow `.github/workflows/ci.yml`:

- сборка всех Docker образов тестового стенда
- подъём `infra/docker-compose.test.yml`
- healthchecks (Postgres / Backend / Nginx)
- smoke-check backend (HTTP запрос на `/` внутри контейнера)
- запуск `pytest` (в CI — SQLite)
- `pip-audit` по Python зависимостям

Плюс отдельный workflow `.github/workflows/secret-scan.yml` сканирует историю коммитов через `gitleaks`.

## Документация

- Схема развёртывания: `docs/deployment-schema.md`
