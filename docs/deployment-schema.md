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
   ┌──────────┐
   │PostgreSQL│
   │  (БД)    │
   └──────────┘
```

## Матрица окружений

| Окружение | Назначение | Compose-файл | Доступ | HTTPS |
|-----------|-----------|--------------|--------|-------|
| **dev** | Локальная разработка | `infra/docker-compose.dev.yml` | Разработчики (localhost) | Нет (HTTP) |
| **test** | CI/CD, QA | `infra/docker-compose.test.yml` | DevSecOps, тестировщики | Да (self-signed) |
| **pilot** | Реальные пользователи | `infra/docker-compose.pilot.yml` | Студенты, организаторы | `https://teamzachet.ru` (Let's Encrypt) |

## Сервисы и порты

### Dev-окружение (все порты открыты)

| Сервис | Порт | Назначение |
|--------|------|-----------|
| Nginx | 80 | Reverse proxy |
| Backend | 8000 | API (прямой доступ для отладки) |
| Frontend | 3000 | Web UI (прямой доступ для отладки) |
| PostgreSQL | 5432 | БД (прямой доступ для отладки) |

### Test-окружение (минимальная поверхность атаки)

| Сервис | Порт | Назначение |
|--------|------|-----------|
| Nginx | 80, 443 | Единственная точка входа |
| Остальные | — | Только внутренняя Docker-сеть |

### Pilot-окружение

Структура портов та же, что в test (только nginx 80/443 наружу). Дополнительно:

- `restart: unless-stopped` на всех сервисах — автоподъём после падения/перезагрузки
- ротация логов: `json-file` driver, `max-size=10m`, `max-file=3`
- nginx: HSTS, `server_tokens off`, gzip, rate-limit на `/api/auth/`, http2
- отдельные volume `pgdata-pilot` и сеть `teamzachet-pilot` — не пересекаются с dev/test
- `.well-known/acme-challenge/` в http-блоке nginx уже зарезервирован под Let's Encrypt

Локально pilot запускается так же, как на сервере, отличается только источник cert-а
(self-signed vs Let's Encrypt) и источник `.env.pilot` (рука vs GitHub Secrets).

## CI/CD Flow

```
Push в master ──► GitHub Actions (ci.yml)
                    │
                    ├─ Build Docker images (test compose)
                    ├─ pytest + pip-audit
                    └─ Deploy pilot на teamzachet.ru (SSH)

Push в DevOps ──► GitHub Actions (infra-deploy.yml)
                    │
                    ├─ Validate compose configs
                    ├─ Check nginx syntax
                    └─ Validate compose + nginx (deploy — в ci.yml)

Push в любую ветку ──► GitHub Actions (secret-scan.yml)
                         │
                         └─ Gitleaks сканирование
```

## Управление секретами

| Секрет | Где хранится | Кто имеет доступ |
|--------|-------------|-----------------|
| DB пароль | GitHub Actions Secrets + .env на сервере | DevSecOps |
| Backend secret key | GitHub Actions Secrets + .env на сервере | DevSecOps |
| SSH ключ сервера | GitHub Actions Secrets | DevSecOps |
| SSO credentials | GitHub Actions Secrets + .env на сервере | DevSecOps |

**Правила:**
- `.env` файлы **никогда** не коммитятся (в `.gitignore`)
- `.env.example` — шаблон без реальных значений
- На сервере `.env.pilot` создаётся вручную при bootstrap (см. `.env.pilot.example`)

## Pilot-сервер (teamzachet.ru)

- **IP:** `77.91.93.156`
- **Домены:** `teamzachet.ru` (canonical), `www.teamzachet.ru` → redirect
- **Путь:** `/opt/teamzachet`
- **Compose:** `infra/docker-compose.pilot.yml --env-file .env.pilot`
- **TLS:** Let's Encrypt, обновление — `infra/ssl/renew-letsencrypt.sh`

См. [`docs/pilot-server-bootstrap.md`](docs/pilot-server-bootstrap.md) и [`docs/pilot-github-setup.md`](docs/pilot-github-setup.md).

## Быстрый старт (dev)

```bash
# 1. Копируем и заполняем env
cp .env.example .env
# Отредактировать .env: заменить CHANGE_ME на реальные значения

# 2. Запускаем
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d

# 3. Проверяем
# Через Nginx (порт 80): / — фронтенд; API бэкенда — под префиксом /api/
curl -s http://localhost/api/auth/verify -H "Content-Type: application/json" -d '{"student_id":123,"surname":"Иванов","name":"Иван","patronymic":"Иванович"}'
# Прямой доступ к бэкенду (порт 8000, как в compose dev): корень — health, не API
curl -s http://localhost:8000/
# {"message": "Сервер работает. REST: префикс /api ...", ...}

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
