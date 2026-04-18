# Чеклист безопасности — Командный зачёт

## Секреты и доступ

- [ ] Все пароли/ключи хранятся в GitHub Actions Secrets
- [ ] `.env` файлы в `.gitignore`, не коммитятся
- [ ] `.env.example` содержит только placeholder-значения (CHANGE_ME)
- [ ] Gitleaks сканирует каждый push (`.github/workflows/secret-scan.yml`)
- [ ] На сервере `.env` создаётся CI из secrets, а не хранится в репо

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
- [ ] Production (будущее): TLS через Let's Encrypt

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
- **Prod:** `https://teamzachet.urfu.ru` (или фактический домен)

**Backend-разработчику:** использовать CORS middleware с `allow_origins` из env.
Никогда не ставить `allow_origins=*` в test/prod.

## Файловое хранилище

- [ ] Файлы не должны пропадать при пересоздании контейнера (volume или внешнее хранилище)
- [ ] Доступ к файлам только через backend API endpoints
- [ ] Валидация типа и размера файлов на backend

## Персональные данные

- [ ] Минимизация данных: хранить только необходимое (student_id, email, имя)
- [ ] Анонимное оценивание: изоляция таблиц голосований от профилей
- [ ] Аудит-лог для доступа к персданным (только admin)
- [ ] Шифрование чувствительных полей в БД (при необходимости)
