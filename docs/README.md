# Документация «Командный зачёт»

## С чего начать

| Документ | Для кого | О чём |
|----------|----------|-------|
| [**project-overview.md**](project-overview.md) | Все | Полный обзор проекта: стек, модули, экраны, окружения |
| [**deployment-schema.md**](deployment-schema.md) | DevSecOps, backend | Архитектура, compose-окружения, CI/CD |
| [**../README.md**](../README.md) | Разработчики | Быстрый старт dev/pilot |

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

- Корневой [`.env.example`](../.env.example) — для dev/test compose
- [`.env.pilot.example`](../.env.pilot.example) — для pilot
- [`frontend/.env.example`](../frontend/.env.example) — переменные Vite

Файл [`docs/.env.example`](.env.example) — расширенный справочник (в т.ч. планируемые переменные SSO).
