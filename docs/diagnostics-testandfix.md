# Ручной деплой ветки TestAndFix (pilot / teamzachet.ru)

## Сводка изменений ветки

| Область | Что сделано |
|---------|-------------|
| Безопасность API | Auth на ленту команды, командный календарь, приватные события, детали help |
| События | Капитан может edit/delete; admin/teacher создаёт с `team_id` |
| Auth | Синхронизация достижений при login, не при `GET /auth/me` |
| Рейтинги | Поиск по ФИО и названию команды, лиги 60/85 |
| Frontend | Раздельная загрузка рейтингов, ошибки на страницах, без flash из localStorage |
| Seed | `scripts/seed_all.py` — идемпотентность, дедупликация, emails/phones |
| Инструменты | Независимая загрузка вкладок; fix 500 при дублях vote rounds |

## Проверки перед деплоем (локально)

```powershell
cd c:\Users\Kritt\source\practicum
.\scripts\deploy-testandfix.ps1
```

Скрипт прогоняет pytest, `npm run build` и выводит команды для сервера.

## Деплой на сервер

### 1. Push ветки

```powershell
git push -u origin TestAndFix
```

### 2. SSH на сервер и деплой

```bash
cd /opt/teamzachet
GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh
```

С пересозданием демо-данных (идемпотентно, без дублей):

```bash
RUN_SEED=true GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh
```

Или seed отдельно после деплоя:

```bash
bash scripts/seed_pilot.sh
```

### 3. Smoke после деплоя

```bash
curl -fsS -o /dev/null https://teamzachet.ru/
curl -fsS https://teamzachet.ru/api/
```

Проверка в браузере: логин `smirnov_ap` / `pass201`, разделы «Инструменты», «Рейтинги», «Команда».

### 4. Откат на master

```bash
GIT_BRANCH=master bash infra/scripts/deploy-pilot-manual.sh
```

## Чеклист на сервере

- [ ] `.env.pilot` существует и **не перезаписывается** при деплое
- [ ] `SECRET_KEY` — уникальный, не дефолтный из `config.py`
- [ ] `DEMO_MODE=false` (демо-сид при старте не выполняется)
- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES=720` (сессия 12 ч)
- [ ] После первого деплоя или обновления данных: `bash scripts/seed_pilot.sh`
- [ ] TLS: `infra/ssl/renew-letsencrypt.sh` по cron (если настроен)

## Учётные записи после seed

| Роль | Логин | Пароль |
|------|-------|--------|
| Админ | `admin` | `admin123` |
| Преподаватель | `teacher_ip` | `teacher123` |
| Капитан «Альфа» | `smirnov_ap` | `pass201` |

## Известные ограничения

1. CI autodeploy только с `master` — ветка TestAndFix деплоится **вручную**.
2. Голосование меняет КРК только после **закрытия раунда** организатором.
3. Один активный раунд голосования на команду.
4. Повторный seed безопасен: дедупликация в начале `seed_all.py`.

## Диагностика проблем

```bash
docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot ps
docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot logs --tail=100 backend
```
