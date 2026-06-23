# Документация «Командный зачёт»

Оглавление каталога `docs/`. Быстрый старт dev/pilot — в [корневом README](../README.md).

## С чего начать

| Документ | Для кого | О чём |
|----------|----------|-------|
| [**project-overview.md**](project-overview.md) | Все | Полный обзор: стек, модули API, экраны, окружения |
| [**deployment-schema.md**](deployment-schema.md) | DevSecOps | Архитектура, compose, CI/CD, секреты |
| [**../README.md**](../README.md) | Разработчики | Быстрый старт: `docker compose` dev/pilot |

## Разработка и продукт

| Документ | О чём |
|----------|-------|
| [ux-ui-mvp.md](ux-ui-mvp.md) | UX/UI-концепция MVP, роли, сценарии |
| [mvp-coverage.md](mvp-coverage.md) | Соответствие требованиям ТЗ и реализации |
| [project-roadmap.md](project-roadmap.md) | Дорожная карта и этапы проекта |
| [sso-integration.md](sso-integration.md) | План интеграции SSO УрФУ |

## Инфраструктура и безопасность

| Документ | О чём |
|----------|-------|
| [pilot-server-bootstrap.md](pilot-server-bootstrap.md) | Первичная настройка pilot-сервера |
| [pilot-github-setup.md](pilot-github-setup.md) | GitHub Secrets, branch protection |
| [security-checklist.md](security-checklist.md) | Чеклист безопасности |
| [diagnostics-testandfix.md](diagnostics-testandfix.md) | Диагностика и ручной деплой ветки TestAndFix |

## Шаблоны окружения

| Файл | Назначение |
|------|------------|
| [`.env.example`](../.env.example) | dev/test compose |
| [`.env.pilot.example`](../.env.pilot.example) | pilot |
| [`frontend/.env.example`](../frontend/.env.example) | переменные Vite |
| [`.env.example` в docs](.env.example) | расширенный справочник (в т.ч. планируемый SSO) |

## Скрипты (вне docs)

- [`infra/scripts/bootstrap-pilot-server.sh`](../infra/scripts/bootstrap-pilot-server.sh) — bootstrap сервера
- [`infra/scripts/deploy-pilot-manual.sh`](../infra/scripts/deploy-pilot-manual.sh) — ручной деплой pilot
