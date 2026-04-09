# Схема развёртывания — Командный зачёт

## Архитектура

```
┌─────────────────────┐
│   Пользователь      │
│   (Браузер / PWA)   │
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
│ (web)    │ │ (API)    │
└──────────┘ └──┬──┬──┬─┘
                │  │  │
         ┌──────┘  │  └──────┐
         ▼         ▼         ▼
   ┌──────────┐ ┌──────┐ ┌──────┐
   │PostgreSQL│ │Redis │ │MinIO │
   │  (БД)    │ │(кэш) │ │ (S3) │
   └──────────┘ └──────┘ └──────┘
```

## Матрица окружений

| Окружение | Назначение | Compose-файл | Доступ | HTTPS |
|-----------|-----------|--------------|--------|-------|
| **dev** | Локальная разработка | `infra/docker-compose.dev.yml` | Разработчики (localhost) | Нет (HTTP) |
| **test** | CI/CD, QA | `infra/docker-compose.test.yml` | DevSecOps, тестировщики | Да (self-signed) |
| **pilot** | Реальные пользователи | TBD (Этап 4) | Студенты, организаторы | Да (Let's Encrypt) |

## Сервисы и порты

### Dev-окружение (все порты открыты)

| Сервис | Порт | Назначение |
|--------|------|-----------|
| Nginx | 80 | Reverse proxy |
| Backend | 8000 | API (прямой доступ для отладки) |
| Frontend | 3000 | Web UI (прямой доступ для отладки) |
| PostgreSQL | 5432 | БД (прямой доступ для отладки) |
| Redis | 6379 | Кэш (прямой доступ для отладки) |
| MinIO API | 9000 | S3 API (прямой доступ для отладки) |
| MinIO Console | 9001 | Веб-консоль MinIO |

### Test-окружение (минимальная поверхность атаки)

| Сервис | Порт | Назначение |
|--------|------|-----------|
| Nginx | 80, 443 | Единственная точка входа |
| Остальные | — | Только внутренняя Docker-сеть |

## CI/CD Flow

```
Push в master ──► GitHub Actions (ci.yml)
                    │
                    ├─ Build Docker images
                    ├─ Start services + health check
                    └─ Deploy на test сервер (TODO)

Push в DevOps ──► GitHub Actions (infra-deploy.yml)
                    │
                    ├─ Validate compose configs
                    ├─ Check nginx syntax
                    └─ Deploy инфры на test (TODO)

Push в любую ветку ──► GitHub Actions (secret-scan.yml)
                         │
                         └─ Gitleaks сканирование
```

## Управление секретами

| Секрет | Где хранится | Кто имеет доступ |
|--------|-------------|-----------------|
| DB пароль | GitHub Actions Secrets + .env на сервере | DevSecOps |
| Backend secret key | GitHub Actions Secrets + .env на сервере | DevSecOps |
| MinIO пароль | GitHub Actions Secrets + .env на сервере | DevSecOps |
| SSH ключ сервера | GitHub Actions Secrets | DevSecOps |
| SSO credentials | GitHub Actions Secrets + .env на сервере | DevSecOps |

**Правила:**
- `.env` файлы **никогда** не коммитятся (в `.gitignore`)
- `.env.example` — шаблон без реальных значений
- На сервере `.env` создаётся CI из GitHub Secrets

## Быстрый старт (dev)

```bash
# 1. Копируем и заполняем env
cp .env.example .env
# Отредактировать .env: заменить CHANGE_ME на реальные значения

# 2. Запускаем
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d

# 3. Проверяем
curl http://localhost/api/health
# {"status": "ok", "service": "backend-stub"}

# 4. Останавливаем
docker compose -f infra/docker-compose.dev.yml --env-file .env down
```

## Требования к серверу (test/pilot)

- ОС: Ubuntu 22.04 LTS
- CPU: 2 vCPU минимум
- RAM: 4 GB минимум
- Диск: 20 GB SSD
- Docker Engine 24+ и Docker Compose v2
- Открытые порты: 80, 443 (SSH — только для DevSecOps)
