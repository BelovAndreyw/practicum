# Покрытие ТЗ с точки зрения UX/UI

Реализация — React SPA в `frontend/src/`. UX-концепция описана в [`ux-ui-mvp.md`](ux-ui-mvp.md).

**Легенда:** «UI» — есть экран/действие во фронтенде; «API only» — backend готов, отдельного UI нет или сценарий упрощён.

| Требование из ТЗ | Статус | UX/UI-решение | Где отражено |
| --- | --- | --- | --- |
| Регистрация и авторизация через учётную запись вуза | API only | Экран входа по логину/паролю; SSO/verify — в плане | `LoginPage.tsx`, API `/auth/login`; `/auth/verify`, `/auth/register` без UI |
| Личный кабинет, редактирование профиля, достижения, личный рейтинг | UI | Профиль с КРК, ачивками, историей; загрузка аватара (файл или URL) | `ProfilePage.tsx`, `UserProfilePage.tsx`, `POST /team/profile/avatar` |
| Создание команды капитаном | UI | Captain-actions: создание, приглашение, состав | `TeamPage.tsx` |
| Генерация пригласительных кодов и ссылок | UI | Карточка приглашения, инвайт-код | `TeamPage.tsx`, API `/team/invite` |
| Вступление в команду и поиск команд | UI (частично) | Поиск команд, вступление по коду; заявки на вступление — API only | `TeamsListPage.tsx`, `TeamDetailPage.tsx`; `/team/{id}/join-request` без UI |
| Страница команды с составом, историей и КРК | UI | Team hub: участники, КРК, активность | `TeamPage.tsx`, `TeamDetailPage.tsx` |
| Автоматический расчёт КРК | UI + backend | Разложение 60/30/10 в UI | `ProfilePage.tsx`, `backend/app/modules/rating/logic.py` |
| Таблицы лидеров команд и личные рейтинги | UI | Лидерборд с табами «Команды / Участники» | `RatingPage.tsx` |
| Распределение по лигам | UI | League-chip и статусы уровня | `RatingPage.tsx`, `ProfilePage.tsx` |
| Лента активностей | UI | Блок последних действий на главной | `DashboardPage.tsx`, API `/feed` |
| Челленджи с возможностью загрузки отчётов | UI | Карточки челленджей, отправка отчёта с файлами | `ChallengesPage.tsx`, API `/challenges`, `/reports` |
| Создание собственных событий командами | UI | Создание встреч/воркшопов; обложка — файл или URL | `EventsPage.tsx`, `POST/GET /events/{id}/image` |
| Новостная лента | UI | News cards на главной | `DashboardPage.tsx`, API `/posts` |
| Биржа знаний | UI | Заявки «нужно / предлагаю», статусы | `DashboardPage.tsx` |
| Календарь событий | UI | Список ближайших активностей | `EventsPage.tsx` |
| Weekly check-in капитанов | UI | Форма check-in с полями недели | `ToolsPage.tsx` (вкладка Check-in), API `/checkins` |
| Механизм «Спасение» | UI | Flow со статусами и подтверждением | `ToolsPage.tsx` (вкладка Спасения), API `/help` |
| Анонимное внутрикомандное голосование | UI | Peer review 1–5 звёзд | `ToolsPage.tsx` (вкладка Голосование), API `/voting` |
| Административная панель для организаторов | UI | Модерация, челленджи, новости, голосование | `AdminPage.tsx` (роль `organizer`) |
| Загрузка изображений (аватар, обложка события, посты, отчёты) | UI + backend | File input + preview; внешний URL как fallback | `ProfilePage.tsx`, `EventsPage.tsx`, `uploads.py`, `test_uploads.py` |
| Время отклика до 2 секунд | цель UX | Карточный интерфейс без перегруженного первого экрана | `ux-ui-mvp.md`, `DashboardPage.tsx` |
| Безопасность и ролевая модель | UI + backend | Разделение по ролям, `ProtectedRoute` | `ProtectedRoute.tsx`, JWT + RBAC в API |
| Масштабируемость | архитектура | Модульная навигация и компонентный подход | `Sidebar.tsx`, `components/ui/` |
