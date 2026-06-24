# Командный зачёт

Учебный сервис с ролями (студент/капитан/организатор) и API. Полный обзор — в [`docs/project-overview.md`](docs/project-overview.md).

## Стек (MVP)

- **Backend**: Python 3.12, **FastAPI**, Uvicorn
- **DB/ORM**: PostgreSQL 16 (dev/test через Docker), SQLAlchemy 2 (async), asyncpg; для локальных/CI тестов — SQLite (aiosqlite)
- **Auth**: JWT (`python-jose`), пароли — `bcrypt`
- **Reverse proxy**: **Nginx** (маршрутизация `/api` → backend, `/` → frontend)
- **Frontend**: React 18 + TypeScript + Vite (см. `frontend/README.md`)
- **Infra**: Docker + Docker Compose
- **CI/DevSecOps**: GitHub Actions (build/healthchecks/pytest/`pip-audit`), secret-scan `gitleaks`

## Структура репозитория

- `backend/` — FastAPI приложение (`app/main.py`, модули auth/team/posts/rating/…)
- `frontend/` — React SPA (`frontend/src/`, Vite)
- `infra/` — compose, nginx конфиги, ssl-скрипты
- `.github/workflows/` — CI пайплайны
- `docs/` — документация

## Быстрый старт (dev)

Нужны Docker Engine + Docker Compose v2.

```bash
# 1) Создать .env (не коммитить)
# Минимум: POSTGRES_*, DATABASE_URL, SECRET_KEY
# DEMO_MODE: в .env.example — false; если переменная не задана, в config.py по умолчанию True

# 2) Запуск dev стенда
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d --build

# 3) Проверка
curl -s http://localhost:8000/

# API доступно через nginx под /api:
# http://localhost/api/...

# 4) Остановка
docker compose -f infra/docker-compose.dev.yml --env-file .env down
```

**Загрузка файлов:** в pilot используется volume `uploads-pilot` (`infra/docker-compose.pilot.yml`). В dev/test файлы в `uploads/` внутри контейнера backend **не сохраняются** при пересоздании контейнера.

**Frontend локально (`npm run dev`):** по умолчанию включён mock-режим. Для реального API см. [`frontend/README.md`](frontend/README.md) (`VITE_FORCE_REAL_API=true`).

## Локальный прогон pilot-контура

Pilot — тот же compose, который потом поедет на сервер. Локально проверяем под self-signed TLS.

```bash
# 1) Скопировать шаблон окружения
cp .env.pilot.example .env.pilot
# Отредактировать: заменить CHANGE_ME на сильные значения

# 2) Сгенерировать self-signed cert для pilot (с SAN на localhost)
bash infra/ssl/generate-self-signed.sh pilot

# 3) Запуск
docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot up -d --build

# 4) Проверка (cert self-signed → -k)
curl -kI https://localhost/                  # 200 OK от фронтенда
curl -kI http://localhost/                   # 301 -> https
curl -k  https://localhost/api/              # ответ backend

# 5) Логи (ротация: max 10MB × 3 файла на сервис)
docker compose -f infra/docker-compose.pilot.yml logs -f nginx backend

# 6) Остановка
docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot down
```

Отличия pilot от test:
- `restart: unless-stopped` на всех сервисах
- ротация логов через `json-file` driver
- HSTS, `server_tokens off`, gzip и rate-limit на `/api/auth/` в nginx
- `http2 on` и таймауты на backend-прокси

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

Подробные материалы — в каталоге [`docs/`](docs/README.md) (обзор проекта, DevOps, UX, pilot, безопасность).
