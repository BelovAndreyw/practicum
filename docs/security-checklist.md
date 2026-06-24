# Чеклист безопасности — Командный зачёт

## Секреты и доступ

- [ ] Все пароли/ключи хранятся в GitHub Actions Secrets
- [ ] `.env` файлы в `.gitignore`, не коммитятся
- [ ] `.env.example` содержит только placeholder-значения (CHANGE_ME)
- [ ] Gitleaks сканирует каждый push (`.github/workflows/secret-scan.yml`)
- [ ] На сервере `.env.pilot` создаётся при bootstrap вручную (см. `pilot-server-bootstrap.md`), не коммитится в репо

## RBAC окружений

| Ресурс | Кто имеет доступ | Как |
|--------|-----------------|-----|
| GitHub repo (push master) | Через PR review | Branch protection rules |
| GitHub repo (push DevOps) | DevSecOps | Прямой push |
| Test сервер (SSH) | DevSecOps | SSH key |
| PostgreSQL (superuser) | Только init | docker-entrypoint-initdb |
| PostgreSQL (app_user) | Backend | Ограниченные права (SELECT/INSERT/UPDATE/DELETE) |

## Сеть и TLS

- [ ] Test-окружение: HTTPS (self-signed сертификат)
- [ ] Test-окружение: HTTP -> HTTPS redirect
- [ ] Test-окружение: открыты только порты 80 и 443 (nginx)
- [ ] Все остальные сервисы — только внутренняя Docker-сеть
- [ ] Pilot (teamzachet.ru): TLS через Let's Encrypt

## Заголовки безопасности (Nginx)

- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: SAMEORIGIN`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Strict-Transport-Security` (только test/prod с TLS)
- [x] `Content-Security-Policy` (базовая политика)

## CORS

Настройка через переменную окружения `BACKEND_CORS_ORIGINS`:
- **Dev:** `http://localhost:3000,http://localhost`
- **Test:** `https://test.teamzachet.local`
- **Pilot/Prod:** `https://teamzachet.ru`

**Backend-разработчику:** использовать CORS middleware с `allow_origins` из env.
Никогда не ставить `allow_origins=*` в test/prod.

> **Статус:** переменная `BACKEND_CORS_ORIGINS` описана в шаблонах env, CORS middleware в backend **ещё не реализован** — задача на доработку.

## Файловое хранилище

Реализация: `backend/app/core/uploads.py` — валидация `image/*`, лимит 5 MB; файлы в `uploads/{posts,reports,avatars,events}/`.

| Проверка | Статус |
|----------|--------|
| Volume в pilot (`uploads-pilot`) — файлы не теряются при redeploy | [x] pilot compose |
| Volume в dev/test | [ ] файлы эфемерны при recreate контейнера |
| Доступ к файлам через backend API (не прямой static из nginx) | [x] `GET /posts/.../images/...`, `/team/users/{id}/avatar`, `/events/{id}/image`, `/reports/.../files/...` |
| Валидация типа и размера на backend | [x] `uploads.py` |
| Публичные GET без auth для медиа постов/аватаров/событий | [!] осознанно для отображения в `<img>`; при ужесточении — signed URLs или cookie-auth |

Внешние URL (`avatar_url`, `image_url`) остаются запасным вариантом; приоритет у загруженного файла.

## Персональные данные

- [ ] Минимизация данных: хранить только необходимое (student_id, email, имя)
- [ ] Анонимное оценивание: изоляция таблиц голосований от профилей
- [ ] Аудит-лог для доступа к персданным (только admin)
- [ ] Шифрование чувствительных полей в БД (при необходимости)
