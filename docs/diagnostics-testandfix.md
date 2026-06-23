# Диагностика ветки TestAndFix (2026-06-22)

## Сводка

| Проверка | Результат |
|----------|-----------|
| Backend pytest | **56 passed** |
| Frontend `npm run build` | **OK** |
| Docker pilot compose | Валиден (`infra/docker-compose.pilot.yml`) |
| CI autodeploy | Только ветка `master` — для TestAndFix нужен **ручной деплой** |

## Реализованные механики

### Голосование (voting)

- **Организатор:** открытие/закрытие раунда на команду (`AdminPage` → вкладка «Голосование»).
- **Студенты:** оценка 1–5 звёзд товарищам по команде (`ToolsPage` → «Голосование»).
- **Влияние на КРК:** только после **закрытия раунда** организатором. Обновляется компонент `unity_score` (Сплоченность, 30% формулы).
- **Формула при закрытии:** `unity = (средняя_оценка / 5) × 100` → пересчёт `total_krk`.
- **Исправления:** teacher/admin могут читать активный раунд без членства в команде; timezone-aware `closes_at` нормализуется для PostgreSQL.

### Спасения (help / rescue)

- API `/help` возвращает `requesting_team_name`, `helper_team_name` (в т.ч. при отклике до подтверждения).
- Панель организатора показывает, кто помогает.
- КРК за спасение начисляется обеим командам при подтверждении (`accept_help_logic`).

### Достижения (achievements)

- Модуль `app/modules/achievement/`, выдача в профиле через `/auth/me`.
- Разблокировка при челленджах, спасениях, бирже знаний.

### Прочее на ветке

- Интеграция фронта с реальным API (mock выключен в pilot build).
- Улучшения рейтинга, check-in, auth profile, seed `scripts/seed_all.py`.

## Известные ограничения

1. **Голосование не меняет КРК до закрытия раунда** — студенты могут не понимать, что нужен шаг организатора.
2. **Участник без голосов** при закрытии раунда не получает обновление `unity_score`.
3. **Один активный раунд на команду** — повторное открытие даёт 400, пока не закрыт предыдущий.
4. **Голоса технически хранят `voter_user_id`** в БД (анти-дубликат); в UI для студентов анонимно.
5. **`DEMO_MODE=false` на pilot** — демо-сид при старте не выполняется; данные только из PostgreSQL volume или `seed_all.py` вручную.
6. **Локальные `.db` файлы** не для деплоя (SQLite dev-артефакты).

## Ручной деплой с TestAndFix

### 1. Локально: push ветки

```powershell
cd c:\Users\Kritt\source\practicum
git push -u origin TestAndFix
```

### 2. На сервере (SSH)

```bash
cd /opt/teamzachet
GIT_BRANCH=TestAndFix bash infra/scripts/deploy-pilot-manual.sh
```

Или вручную:

```bash
cd /opt/teamzachet
sudo -u deploy git fetch origin TestAndFix
sudo -u deploy git checkout TestAndFix
sudo -u deploy git reset --hard origin/TestAndFix
docker compose -f infra/docker-compose.pilot.yml --env-file .env.pilot up -d --build --remove-orphans
```

### 3. Smoke после деплоя

```bash
curl -fsS -o /dev/null https://teamzachet.ru/
curl -fsS https://teamzachet.ru/api/
```

Логин организатора после `scripts/seed_all.py`: `teacher_ip` / `teacher123`.

### 4. Откат на master

```bash
GIT_BRANCH=master bash infra/scripts/deploy-pilot-manual.sh
```

## Чеклист перед деплоем

- [ ] Все изменения закоммичены и запушены в `origin/TestAndFix`
- [ ] `.env.pilot` на сервере не перезаписывается (секреты сохраняются)
- [ ] `DEMO_MODE=false` в `.env.pilot`
- [ ] После деплоя: спасения в админке показывают команду-помощника
- [ ] После деплоя: открытие раунда голосования → закрытие → КРК участников изменился
