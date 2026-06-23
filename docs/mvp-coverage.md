# Покрытие ТЗ с точки зрения UX/UI

Реализация — React SPA в `frontend/src/`. UX-концепция описана в [`ux-ui-mvp.md`](ux-ui-mvp.md).

| Требование из ТЗ | UX/UI-решение | Где отражено |
| --- | --- | --- |
| Регистрация и авторизация через учётную запись вуза | Экран входа, верификация по student_id | `frontend/src/features/auth/LoginPage.tsx`, API `/auth/verify` |
| Личный кабинет, редактирование профиля, достижения, личный рейтинг | Профиль с КРК, ачивками, историей | `frontend/src/pages/ProfilePage.tsx`, `UserProfilePage.tsx` |
| Создание команды капитаном | Captain-actions: создание, приглашение, состав | `frontend/src/pages/TeamPage.tsx` |
| Генерация пригласительных кодов и ссылок | Карточка приглашения, инвайт-код | `TeamPage.tsx`, API `/team/invite` |
| Вступление в команду и поиск команд | Поиск команд, заявки, вступление по коду | `TeamsListPage.tsx`, `TeamDetailPage.tsx` |
| Страница команды с составом, историей и КРК | Team hub: участники, КРК, активность | `TeamPage.tsx`, `TeamDetailPage.tsx` |
| Автоматический расчёт КРК | Разложение 60/30/10 в UI | `ProfilePage.tsx`, `backend/app/modules/rating/logic.py` |
| Таблицы лидеров команд и личные рейтинги | Лидерборд с табами «Команды / Участники» | `frontend/src/pages/RatingPage.tsx` |
| Распределение по лигам | League-chip и статусы уровня | `RatingPage.tsx`, `ProfilePage.tsx` |
| Лента активностей | Блок последних действий на главной | `DashboardPage.tsx`, API `/feed` |
| Челленджи с возможностью загрузки отчётов | Карточки челленджей, отправка отчёта | `ChallengesPage.tsx`, API `/challenges`, `/reports` |
| Создание собственных событий командами | Создание встреч/воркшопов капитаном | `EventsPage.tsx`, API `/events` |
| Новостная лента | News cards на главной | `DashboardPage.tsx`, API `/posts` |
| Биржа знаний | Заявки «нужно / предлагаю», статусы | `DashboardPage.tsx` |
| Календарь событий | Список ближайших активностей | `EventsPage.tsx` |
| Weekly check-in капитанов | Форма check-in с полями недели | `ToolsPage.tsx` (вкладка Check-in), API `/checkins` |
| Механизм «Спасение» | Flow со статусами и подтверждением | `ToolsPage.tsx` (вкладка Спасения), API `/help` |
| Анонимное внутрикомандное голосование | Peer review 1–5 звёзд | `ToolsPage.tsx` (вкладка Голосование), API `/voting` |
| Административная панель для организаторов | Модерация, челленджи, новости, голосование | `AdminPage.tsx` (роль `organizer`) |
| Время отклика до 2 секунд | Карточный интерфейс без перегруженного первого экрана | `ux-ui-mvp.md`, `DashboardPage.tsx` |
| Безопасность и ролевая модель | Разделение по ролям, `ProtectedRoute` | `frontend/src/features/auth/ProtectedRoute.tsx` |
| Масштабируемость | Модульная навигация и компонентный подход | `Sidebar.tsx`, `components/ui/` |
