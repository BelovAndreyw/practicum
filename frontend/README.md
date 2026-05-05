# Командный зачёт — Frontend

Фронтенд игры «Командный зачёт» на React + TypeScript + Vite.

## Быстрый запуск (каждый у себя локально, независимо)

Этот сценарий **не зависит от чужого компьютера/сервера**.
Каждый разработчик поднимает свой локальный экземпляр.

1. Клонировать репозиторий и перейти в ветку `frontend`:
```bash
git clone https://github.com/BelovAndreyw/practicum.git
cd practicum
git checkout frontend
```

2. Перейти во фронтенд и установить зависимости:
```bash
cd frontend
npm install
```

3. Запустить локальный dev-сервер:
```bash
npm run dev
```

4. Открыть в браузере:
- `http://localhost:5173`

## Локальный вход в демо-режиме

По умолчанию для локальной разработки используется mock-режим:
- даже без `.env` (и без `.env.development`) в `dev`-режиме mock включен автоматически
- вход работает с любым логином/паролем (для демонстрации интерфейса)

Это не мешает дальнейшей интеграции с backend.

## Как включить реальный backend

1. Поднять backend (локально/на стенде).
2. В `frontend/.env.development` указать:
```env
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE=/api
VITE_USE_MOCK=false
VITE_FORCE_REAL_API=true
```
3. Перезапустить фронт:
```bash
npm run dev
```

## Production-сборка

```bash
npm run build
npm run preview
```

## Переменные окружения

- `VITE_BACKEND_URL` — адрес backend
- `VITE_API_BASE` — префикс API (обычно `/api`)
- `VITE_USE_MOCK` — `true` для mock, `false` для реального backend
- `VITE_FORCE_REAL_API` — в `dev` принудительно отключает mock и включает реальный backend

## Частые проблемы

1. `localhost:5173` не открывается:
- проверьте, что в терминале запущен `npm run dev`
- проверьте, что порт 5173 не занят

2. Ошибка при `npm install`:
- проверьте версию Node.js (`node -v`), рекомендуется Node 20+

3. Белая страница:
- откройте DevTools (F12) и проверьте ошибки в Console
- выполните `Ctrl+F5`
