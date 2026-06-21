"""
================================================================================
  МЕГА-СКРИПТ НАПОЛНЕНИЯ САЙТА — ВСЕ МОДУЛИ
================================================================================

Наполняет ВСЕ таблицы проекта реалистичными тестовыми данными:
  • 12 пользователей (студенты + админ + преподаватель)
  • 3 команды с участниками, рейтингом
  • 15 постов (новости, события, отчёты, запросы помощи)
  • 6 событий (прошедшие и предстоящие)
  • 4 челленджа + записи команд
  • 4 заявки на помощь + отклики
  • 3 отчёта команд с задачами
  • 6 check-ins с задачами
  • Рейтинги пользователей и команд + логи
  • Лиги + архивы
  • Активности + логи команд
  • Заявки на вступление + пригласительные ссылки

Запуск: python seed_mega.py
================================================================================
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
import secrets

# Делаем пакет `app` импортируемым независимо от того, откуда запущен скрипт:
#   • из корня репозитория (рядом лежит ./backend/app)
#   • из каталога scripts/ (../backend/app)
#   • внутри backend-контейнера, где код лежит прямо в /app/app
_here = Path(__file__).resolve().parent
for _candidate in (_here / "backend", _here.parent / "backend", _here, _here.parent):
    if (_candidate / "app").is_dir():
        sys.path.insert(0, str(_candidate))
        break


def _utcnow() -> datetime:
    """Наивный UTC-таймстемп.

    Колонки в моделях объявлены как ``DateTime`` без ``timezone=True``
    (в Postgres это ``TIMESTAMP WITHOUT TIME ZONE``). asyncpg отвергает
    timezone-aware значения для таких колонок, поэтому работаем с наивным UTC.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

from sqlalchemy import select, func
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import Student, User, UserRole
from app.models.team import Team, TeamMember, TeamInviteLink, TeamJoinRequest
from app.models.post import Post, PostImage
from app.models.activity import Activity, Challenge, TeamChallenge, TeamActivityLog
from app.models.rating import (
    UserRating, RatingLog, TeamRating, TeamRatingLog,
    LeagueSettings, RatingPeriodArchive
)
from app.models.reports import (
    TeamReport, ReportTask,
    TeamEvent, EventInvitation, EventParticipant,
    WeeklyCheckin, CheckinTask,
    HelpRequest, HelpResponse
)

USERS_DATA = [
    {"student_id": 201, "surname": "Смирнов", "name": "Алексей", "patronymic": "Петрович",
     "username": "smirnov_ap", "password": "pass201", "role": UserRole.CAPTAIN.value, "team": "Альфа"},
    {"student_id": 202, "surname": "Кузнецов", "name": "Дмитрий", "patronymic": "Сергеевич",
     "username": "kuznetsov_ds", "password": "pass202", "role": UserRole.STUDENT.value, "team": "Альфа"},
    {"student_id": 203, "surname": "Волков", "name": "Артём", "patronymic": "Николаевич",
     "username": "volkov_an", "password": "pass203", "role": UserRole.STUDENT.value, "team": "Альфа"},
    {"student_id": 204, "surname": "Попов", "name": "Максим", "patronymic": "Андреевич",
     "username": "popov_ma", "password": "pass204", "role": UserRole.CAPTAIN.value, "team": "Бета"},
    {"student_id": 205, "surname": "Васильев", "name": "Николай", "patronymic": "Игоревич",
     "username": "vasiliev_ni", "password": "pass205", "role": UserRole.STUDENT.value, "team": "Бета"},
    {"student_id": 206, "surname": "Соколов", "name": "Илья", "patronymic": "Дмитриевич",
     "username": "sokolov_id", "password": "pass206", "role": UserRole.STUDENT.value, "team": "Бета"},
    {"student_id": 207, "surname": "Новиков", "name": "Андрей", "patronymic": "Владимирович",
     "username": "novikov_av", "password": "pass207", "role": UserRole.CAPTAIN.value, "team": "Гамма"},
    {"student_id": 208, "surname": "Морозов", "name": "Павел", "patronymic": "Сергеевич",
     "username": "morozov_ps", "password": "pass208", "role": UserRole.STUDENT.value, "team": "Гамма"},
    {"student_id": 209, "surname": "Петров", "name": "Сергей", "patronymic": "Владимирович",
     "username": "petrov_sv", "password": "pass209", "role": UserRole.STUDENT.value, "team": None},
    {"student_id": 210, "surname": "Лебедев", "name": "Константин", "patronymic": "Алексеевич",
     "username": "lebedev_ka", "password": "pass210", "role": UserRole.STUDENT.value, "team": None},
    {"student_id": 301, "surname": "Администратор", "name": "Системный", "patronymic": "",
     "username": "admin", "password": "admin123", "role": UserRole.ADMIN.value, "team": None},
    {"student_id": 302, "surname": "Преподаватель", "name": "Иван", "patronymic": "Петрович",
     "username": "teacher_ip", "password": "teacher123", "role": UserRole.TEACHER.value, "team": None},
]

TEAMS_DATA = [
    {"name": "Альфа", "description": "Команда веб-разработчиков. Стек: React, FastAPI, PostgreSQL.",
     "captain_index": 0, "member_indices": [0, 1, 2], "rating": 1250.0},
    {"name": "Бета", "description": "DevOps и инфраструктура. Docker, Kubernetes, CI/CD.",
     "captain_index": 3, "member_indices": [3, 4, 5], "rating": 1180.0},
    {"name": "Гамма", "description": "Data Science и ML. Python, PyTorch, pandas.",
     "captain_index": 6, "member_indices": [6, 7], "rating": 980.0},
]

POSTS_DATA = [
    {"title": "🏁 Старт командного зачёта 2026!",
     "content": "Дорогие студенты! Объявляем о начале ежегодного командного зачёта.\n\nТема: «Умный университет: цифровые решения для кампуса».\n\nКлючевые даты:\n• Регистрация: до 15 марта\n• Первый этап: 20 марта — 5 апреля\n• Второй этап: 10 — 25 апреля\n• Финальная защита: 5 мая\n\nПризы: 🥇 50 000 ₽, 🥈 30 000 ₽, 🥉 15 000 ₽",
     "author_index": 0, "created_days_ago": 21},
    {"title": "📢 Воркшоп по Docker и CI/CD",
     "content": "Команда «Бета» проводит открытый воркшоп.\n\nПрограмма:\n• 14:00 — Docker\n• 15:30 — Docker Compose\n• 17:00 — GitHub Actions\n\nМесто: ауд. 305. Регистрация: @popov_ma",
     "author_index": 3, "created_days_ago": 14},
    {"title": "🎉 Команда «Альфа» победила в хакатоне CodeFest!",
     "content": "1-е место на городском хакатоне!\n\nПроект: мобильное приложение для библиотеки с QR-пропусками.\nЖюри отметило чистый код, UX и рабочий MVP.",
     "author_index": 1, "created_days_ago": 10},
    {"title": "⚠️ Нужен backend-разработчик в «Гамму»",
     "content": "Ищем backend-разработчика!\n\nПроект: прогнозирование загруженности столовой.\n\nТребования:\n• Python (FastAPI/Flask/Django)\n• SQL/PostgreSQL\n• 5–7 часов в неделю\n\nПишите @novikov_av!",
     "author_index": 6, "created_days_ago": 5},
    {"title": "📊 Результаты первого КРК",
     "content": "Итоги КРК-1:\n\n🥇 «Альфа» — 1250 очков\n🥈 «Бета» — 1180 очков\n🥉 «Гамма» — 980 очков\n\nСледующий КРК — 15 апреля.",
     "author_index": 0, "created_days_ago": 8},
    {"title": "🔧 Ищу ментора по React и TypeScript",
     "content": "Застрял на архитектуре состояний.\n\nВопросы:\n• Context API vs Zustand?\n• Кэширование запросов?\n• SSR с Next.js?\n\nМогу угостить кофе ☕ @kuznetsov_ds",
     "author_index": 1, "created_days_ago": 3},
    {"title": "🗓️ Менторские сессии на апрель",
     "content": "Расписание:\n\n• 3 апреля — Архитектура микросервисов\n• 8 апреля — UI/UX для разработчиков\n• 12 апреля — Тестирование: unit → E2E\n• 18 апреля — Деплой в облако\n• 25 апреля — Подготовка к защите\n\nВсе сессии в Discord.",
     "author_index": 4, "created_days_ago": 2},
    {"title": "💡 Идея: умная парковка на кампусе",
     "content": "Проблема: 15+ минут на поиск места.\n\nРешение:\n• Датчики на местах\n• Приложение с картой\n• Push-уведомления\n• Интеграция с пропускной системой\n\nГотов помочь с аналитикой!",
     "author_index": 7, "created_days_ago": 2},
    {"title": "🐛 Исправлен баг в системе оценивания",
     "content": "Баллы за документацию удваивались при повторной отправке.\n\nИсправлено, рейтинги пересчитаны. «Гамма» +40 очков.\n\nЗаметили что-то ещё — пишите @vasiliev_ni.",
     "author_index": 4, "created_days_ago": 6},
    {"title": "🏗️ Инфраструктура «Альфы» на Kubernetes",
     "content": "Отчёт команды «Бета»:\n\n✅ CI/CD (GitHub Actions → Docker Hub → VPS)\n✅ PostgreSQL + Redis в Docker Compose\n✅ Nginx с SSL и rate limiting\n✅ Healthchecks и rollback\n✅ Loki + Grafana\n\nДеплой: 30 мин → 3 мин.",
     "author_index": 3, "created_days_ago": 9},
    {"title": "📚 Материалы для подготовки к КРК-2",
     "content": "Полезные ресурсы:\n\n📖 Книги:\n• «Чистая архитектура» Р. Мартин\n• «Designing Data-Intensive Applications» М. Клеппман\n\n🎥 Курсы:\n• FastAPI на Stepik\n• React + TypeScript (Ulbi TV)\n• Docker — официальная документация\n\nУдачи! 🍀",
     "author_index": 2, "created_days_ago": 3},
    {"title": "🚨 Дедлайн заявок на финал — через 3 дня!",
     "content": "Заявка до 2 мая 23:59.\n\nПриложить:\n• Рабочий деплой\n• Презентация (до 15 слайдов)\n• Видео-демо (до 3 мин)\n• Исходный код\n• Документация API\n\nКритерии: работоспособность (30%), код (25%), защита (25%), доки (20%)",
     "author_index": 5, "created_days_ago": 0},
    {"title": "🎓 Результаты весеннего хакатона",
     "content": "Полные результаты:\n\n1. «Альфа» — 92/100\n2. «CodeRunners» — 87/100\n3. «Бета» — 85/100\n4. «Гамма» — 78/100\n\nВсе проекты в открытом доступе.",
     "author_index": 0, "created_days_ago": 12},
    {"title": "🔥 Новый сервер для тестовых стендов",
     "content": "Университет выделил VPS:\n\n• 4 vCPU, 8 GB RAM, 100 GB SSD\n• Ubuntu 24.04 LTS\n• Docker + Docker Compose\n• Доступ по SSH-ключам\n\nЗапросить доступ: капитан → @admin",
     "author_index": 10, "created_days_ago": 7},
    {"title": "✅ Проверка check-ins за неделю 20–26 мая",
     "content": "Все 3 команды сдали check-ins вовремя.\n\n«Альфа» — 100% задач, отличная документация.\n«Бета» — хороший прогресс, нужно ускорить тесты.\n«Гамма» — отличные ML-результаты, задержка с frontend.",
     "author_index": 11, "created_days_ago": 1},
]

EVENTS_DATA = [
    {"title": "Открытие командного зачёта 2026", "description": "Торжественное открытие, правила, мерч.",
     "event_type": "ceremony", "format": "offline", "location": "Актовый зал, корпус «Главный»",
     "starts_at": -20, "ends_at": -20, "max_participants": 200, "is_public": True, "created_by_index": 10},
    {"title": "Воркшоп: Docker и CI/CD", "description": "Практический воркшоп от «Беты». Принесите ноутбуки!",
     "event_type": "workshop", "format": "offline", "location": "Ауд. 305, корпус «ИТ»",
     "starts_at": -5, "ends_at": -5, "max_participants": 30, "is_public": True, "created_by_index": 3},
    {"title": "Хакатон «CodeFest 2026»", "description": "48-часовой хакатон. Тема: «Умный город».",
     "event_type": "hackathon", "format": "offline", "location": "Коворкинг «Точка кипения»",
     "starts_at": -10, "ends_at": -8, "max_participants": 50, "is_public": True, "created_by_index": 10},
    {"title": "Менторская сессия: Архитектура микросервисов", "description": "Лекция от senior-разработчика Яндекса.",
     "event_type": "lecture", "format": "online", "location": "Discord — ссылка в ЛК",
     "starts_at": 3, "ends_at": 3, "max_participants": 100, "is_public": True, "created_by_index": 11},
    {"title": "Демо-день: промежуточные результаты", "description": "Каждая команда показывает прогресс. Обратная связь от жюри.",
     "event_type": "demo", "format": "offline", "location": "Ауд. 401, корпус «ИТ»",
     "starts_at": 7, "ends_at": 7, "max_participants": 60, "is_public": False, "created_by_index": 11},
    {"title": "Финальная защита проектов", "description": "Защита, награждение, фуршет.",
     "event_type": "ceremony", "format": "offline", "location": "Актовый зал, корпус «Главный»",
     "starts_at": 14, "ends_at": 14, "max_participants": 300, "is_public": True, "created_by_index": 10},
]

CHALLENGES_DATA = [
    {"title": "Оптимизация SQL-запросов", "description": "Ускорьте запросы в БД. Цель: <50мс.",
     "reward_points": 150, "deadline_days": -3, "is_active": False},
    {"title": "Написать unit-тесты для API", "description": "Покрытие кода минимум 80%. pytest + httpx.",
     "reward_points": 100, "deadline_days": 5, "is_active": True},
    {"title": "Создать Telegram-бота для команды", "description": "Бот для уведомлений о дедлайнах и задачах.",
     "reward_points": 200, "deadline_days": 10, "is_active": True},
    {"title": "Документация API в Swagger", "description": "Полная документация всех эндпоинтов.",
     "reward_points": 120, "deadline_days": 2, "is_active": True},
]

TEAM_CHALLENGES_DATA = [
    {"team_index": 0, "challenge_index": 0, "status": "completed", "enrolled_days_ago": 25, "completed_days_ago": 5},
    {"team_index": 1, "challenge_index": 0, "status": "completed", "enrolled_days_ago": 25, "completed_days_ago": 6},
    {"team_index": 0, "challenge_index": 1, "status": "active", "enrolled_days_ago": 3, "completed_days_ago": None},
    {"team_index": 1, "challenge_index": 1, "status": "active", "enrolled_days_ago": 3, "completed_days_ago": None},
    {"team_index": 2, "challenge_index": 2, "status": "active", "enrolled_days_ago": 1, "completed_days_ago": None},
    {"team_index": 0, "challenge_index": 3, "status": "active", "enrolled_days_ago": 5, "completed_days_ago": None},
]

HELP_REQUESTS_DATA = [
    {"team_index": 2, "title": "Нужна помощь с Docker-контейнеризацией",
     "description": "Ошибка при установке PyTorch в образе.",
     "help_type": "receiving", "format": "online", "effort_hours": 3,
     "status": "open", "created_days_ago": 2, "fulfilled_by": None},
    {"team_index": 0, "title": "Помощь с дизайном мобильного приложения",
     "description": "Нужны макеты в Figma. 5-7 экранов.",
     "help_type": "receiving", "format": "both", "effort_hours": 5,
     "status": "in_progress", "created_days_ago": 5, "fulfilled_by": 1},
    {"team_index": 1, "title": "Консультация по Kubernetes",
     "description": "Нужен совет по ingress-контроллеру.",
     "help_type": "receiving", "format": "online", "effort_hours": 2,
     "status": "fulfilled", "created_days_ago": 10, "fulfilled_by": 0},
    {"team_index": 2, "title": "Помощь с математикой для ML",
     "description": "Объяснение градиентного спуска.",
     "help_type": "receiving", "format": "offline", "effort_hours": 2,
     "status": "open", "created_days_ago": 1, "fulfilled_by": None},
]

HELP_RESPONSES_DATA = [
    {"request_index": 1, "team_index": 1, "message": "Можем помочь с Figma! Свяжитесь через @popov_ma", "status": "accepted", "days_ago": 4},
    {"request_index": 2, "team_index": 0, "message": "Настраивали ingress. Можем созвониться.", "status": "accepted", "days_ago": 9},
    {"request_index": 0, "team_index": 1, "message": "Проверьте версию CUDA. PyTorch 2.0+ требует CUDA 11.8+", "status": "pending", "days_ago": 1},
]

REPORTS_DATA = [
    {"team_index": 0, "challenge_index": 0,
     "title": "Отчёт: оптимизация SQL-запросов",
     "description": "Анализ запросов, индексы, рефакторинг JOIN'ов.",
     "created_by_index": 0, "is_approved": True, "created_days_ago": 5,
     "tasks": [
         {"user_index": 0, "description": "Профилирование с pg_stat_statements", "completed": True},
         {"user_index": 1, "description": "Добавление composite индексов", "completed": True},
         {"user_index": 2, "description": "Рефакторинг ORM-запросов", "completed": True},
     ]},
    {"team_index": 1, "challenge_index": 0,
     "title": "Отчёт: оптимизация SQL в «Бете»",
     "description": "12 запросов оптимизированы. Среднее время: 340мс → 28мс.",
     "created_by_index": 3, "is_approved": True, "created_days_ago": 6,
     "tasks": [
         {"user_index": 3, "description": "Аудит эндпоинтов", "completed": True},
         {"user_index": 4, "description": "Настройка Redis-кэша", "completed": True},
         {"user_index": 5, "description": "Нагрузочное тестирование", "completed": True},
     ]},
    {"team_index": 0, "challenge_index": None,
     "title": "Еженедельный отчёт «Альфы» (неделя 3)",
     "description": "Прототип frontend'а готов. Начата интеграция с backend.",
     "created_by_index": 0, "is_approved": False, "created_days_ago": 2,
     "tasks": [
         {"user_index": 0, "description": "Роутинг и авторизация", "completed": True},
         {"user_index": 1, "description": "Вёрстка главной страницы", "completed": True},
         {"user_index": 2, "description": "Интеграция API постов", "completed": False},
     ]},
]

CHECKINS_DATA = [
    {"team_index": 0, "week_start": -21, "content": "Неделя 1: формирование команды, выбор темы.",
     "created_by_index": 0, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 19,
     "tasks": [
         {"user_index": 0, "description": "Создание репозитория и CI", "completed": True},
         {"user_index": 1, "description": "Исследование похожих проектов", "completed": True},
         {"user_index": 2, "description": "Составление ТЗ", "completed": True},
     ]},
    {"team_index": 0, "week_start": -14, "content": "Неделя 2: проектирование архитектуры.",
     "created_by_index": 0, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 12,
     "tasks": [
         {"user_index": 0, "description": "Диаграмма компонентов", "completed": True},
         {"user_index": 1, "description": "Выбор UI-kit", "completed": True},
         {"user_index": 2, "description": "Проектирование схемы БД", "completed": True},
     ]},
    {"team_index": 0, "week_start": -7, "content": "Неделя 3: разработка MVP frontend'а.",
     "created_by_index": 0, "status": "pending", "reviewed_by": None, "reviewed_days_ago": None,
     "tasks": [
         {"user_index": 0, "description": "Авторизация через JWT", "completed": True},
         {"user_index": 1, "description": "Главная страница и навигация", "completed": True},
         {"user_index": 2, "description": "Страница профиля команды", "completed": False},
     ]},
    {"team_index": 1, "week_start": -21, "content": "Неделя 1: настройка инфраструктуры.",
     "created_by_index": 3, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 19,
     "tasks": [
         {"user_index": 3, "description": "Docker Compose для dev", "completed": True},
         {"user_index": 4, "description": "Nginx reverse proxy", "completed": True},
         {"user_index": 5, "description": "SSL Let's Encrypt", "completed": True},
     ]},
    {"team_index": 1, "week_start": -7, "content": "Неделя 3: CI/CD и мониторинг.",
     "created_by_index": 3, "status": "pending", "reviewed_by": None, "reviewed_days_ago": None,
     "tasks": [
         {"user_index": 3, "description": "GitHub Actions pipeline", "completed": True},
         {"user_index": 4, "description": "Grafana dashboards", "completed": False},
         {"user_index": 5, "description": "Alerting через Telegram", "completed": False},
     ]},
    {"team_index": 2, "week_start": -14, "content": "Неделя 2: сбор и очистка данных.",
     "created_by_index": 6, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 12,
     "tasks": [
         {"user_index": 6, "description": "Парсинг данных столовой", "completed": True},
         {"user_index": 7, "description": "Очистка и нормализация", "completed": True},
     ]},
]

USER_RATINGS_DATA = [
    {"user_index": 0, "base": 45.0, "unity": 12.0, "bonus": 8.0, "penalty": 0.0, "rank": 1, "league": "legend", "change": 0},
    {"user_index": 1, "base": 42.0, "unity": 12.0, "bonus": 6.0, "penalty": 0.0, "rank": 2, "league": "legend", "change": 1},
    {"user_index": 2, "base": 40.0, "unity": 12.0, "bonus": 5.0, "penalty": 0.0, "rank": 3, "league": "legend", "change": 1},
    {"user_index": 3, "base": 38.0, "unity": 11.0, "bonus": 7.0, "penalty": 0.0, "rank": 4, "league": "pro", "change": 0},
    {"user_index": 4, "base": 36.0, "unity": 11.0, "bonus": 4.0, "penalty": 0.0, "rank": 5, "league": "pro", "change": -1},
    {"user_index": 5, "base": 35.0, "unity": 11.0, "bonus": 3.0, "penalty": 0.0, "rank": 6, "league": "pro", "change": 0},
    {"user_index": 6, "base": 32.0, "unity": 8.0, "bonus": 5.0, "penalty": 0.0, "rank": 7, "league": "pro", "change": 2},
    {"user_index": 7, "base": 30.0, "unity": 8.0, "bonus": 3.0, "penalty": 0.0, "rank": 8, "league": "pro", "change": 0},
    {"user_index": 8, "base": 15.0, "unity": 0.0, "bonus": 2.0, "penalty": 0.0, "rank": 9, "league": "newbie", "change": 0},
    {"user_index": 9, "base": 12.0, "unity": 0.0, "bonus": 1.0, "penalty": 0.0, "rank": 10, "league": "newbie", "change": 0},
]

RATING_LOGS_DATA = [
    {"user_index": 0, "old_total": 60.0, "new_total": 65.0, "event": "challenge", "desc": "Завершён челлендж «Оптимизация SQL»", "days_ago": 5},
    {"user_index": 1, "old_total": 55.0, "new_total": 60.0, "event": "challenge", "desc": "Завершён челлендж «Оптимизация SQL»", "days_ago": 5},
    {"user_index": 3, "old_total": 52.0, "new_total": 56.0, "event": "challenge", "desc": "Завершён челлендж «Оптимизация SQL»", "days_ago": 6},
    {"user_index": 0, "old_total": 65.0, "new_total": 63.0, "event": "penalty", "desc": "Опоздание с check-in на 2 дня", "days_ago": 8},
    {"user_index": 6, "old_total": 40.0, "new_total": 45.0, "event": "activity", "desc": "Помощь команде «Бета» с Figma", "days_ago": 4},
]

TEAM_RATINGS_DATA = [
    {"team_index": 0, "average_krk": 65.0, "member_count": 3, "rank": 1, "change": 0},
    {"team_index": 1, "average_krk": 56.0, "member_count": 3, "rank": 2, "change": 0},
    {"team_index": 2, "average_krk": 45.0, "member_count": 2, "rank": 3, "change": 1},
]

TEAM_RATING_LOGS_DATA = [
    {"team_index": 0, "old": 62.0, "new": 65.0, "event": "member_rating_changed", "desc": "Обновление после КРК-1", "days_ago": 8},
    {"team_index": 1, "old": 54.0, "new": 56.0, "event": "member_rating_changed", "desc": "Обновление после КРК-1", "days_ago": 8},
    {"team_index": 2, "old": 40.0, "new": 45.0, "event": "member_rating_changed", "desc": "Помощь другой команде + бонус", "days_ago": 4},
]

ACTIVITIES_DATA = [
    {"team_index": 0, "user_index": 0, "event_type": "team_created", "title": "Команда «Альфа» зарегистрирована", "desc": "Капитан: Смирнов А.П.", "days_ago": 25},
    {"team_index": 1, "user_index": 3, "event_type": "team_created", "title": "Команда «Бета» зарегистрирована", "desc": "Капитан: Попов М.А.", "days_ago": 25},
    {"team_index": 2, "user_index": 6, "event_type": "team_created", "title": "Команда «Гамма» зарегистрирована", "desc": "Капитан: Новиков А.В.", "days_ago": 20},
    {"team_index": 0, "user_index": 2, "event_type": "member_joined", "title": "Волков А.Н. присоединился к «Альфе»", "desc": "По пригласительной ссылке", "days_ago": 22},
    {"team_index": 0, "user_index": 0, "event_type": "challenge_completed", "title": "«Альфа» завершила челлендж", "desc": "Оптимизация SQL — 150 очков", "days_ago": 5},
    {"team_index": 1, "user_index": 3, "event_type": "challenge_completed", "title": "«Бета» завершила челлендж", "desc": "Оптимизация SQL — 150 очков", "days_ago": 6},
    {"team_index": 0, "user_index": 0, "event_type": "rating_updated", "title": "Рейтинг «Альфы» обновлён", "desc": "Новый рейтинг: 1250 (+30)", "days_ago": 8},
    {"team_index": 1, "user_index": 3, "event_type": "rating_updated", "title": "Рейтинг «Беты» обновлён", "desc": "Новый рейтинг: 1180 (+20)", "days_ago": 8},
]

TEAM_ACTIVITY_LOGS_DATA = [
    {"team_index": 0, "event": "rating_change", "old": 1220.0, "new": 1250.0, "desc": "КРК-1: отличная документация", "days_ago": 8},
    {"team_index": 1, "event": "rating_change", "old": 1160.0, "new": 1180.0, "desc": "КРК-1: сильная инфраструктура", "days_ago": 8},
    {"team_index": 2, "event": "rating_change", "old": 940.0, "new": 980.0, "desc": "КРК-1: интересная идея + бонус", "days_ago": 8},
    {"team_index": 0, "event": "member_joined", "old": 1220.0, "new": 1220.0, "desc": "Волков А.Н. присоединился", "days_ago": 22},
]

JOIN_REQUESTS_DATA = [
    {"user_index": 8, "team_index": 0, "status": "pending", "days_ago": 2},
    {"user_index": 9, "team_index": 1, "status": "pending", "days_ago": 4},
    {"user_index": 8, "team_index": 1, "status": "rejected", "days_ago": 12},
    {"user_index": 9, "team_index": 2, "status": "approved", "days_ago": 15},
]

INVITE_LINKS_DATA = [
    {"team_index": 0, "expires_hours": 72, "max_uses": 5, "uses_count": 3, "is_active": True},
    {"team_index": 1, "expires_hours": 168, "max_uses": None, "uses_count": 2, "is_active": True},
    {"team_index": 2, "expires_hours": -24, "max_uses": 3, "uses_count": 3, "is_active": False},
    {"team_index": 0, "expires_hours": 24, "max_uses": 1, "uses_count": 1, "is_active": False},
]

LEAGUE_SETTINGS_DATA = [
    {"tier": "newbie", "min_score": 0.0, "max_score": 49.99, "is_active": True},
    {"tier": "pro", "min_score": 50.0, "max_score": 99.99, "is_active": True},
    {"tier": "legend", "min_score": 100.0, "max_score": None, "is_active": True},
]

ARCHIVES_DATA = [
    {"year": 2026, "month": 3, "user_index": 0, "team_index": 0, "krk": 60.0, "rank": 2, "league": "pro"},
    {"year": 2026, "month": 3, "user_index": 1, "team_index": 0, "krk": 55.0, "rank": 3, "league": "pro"},
    {"year": 2026, "month": 3, "user_index": 3, "team_index": 1, "krk": 52.0, "rank": 4, "league": "pro"},
    {"year": 2026, "month": 4, "user_index": 0, "team_index": 0, "krk": 65.0, "rank": 1, "league": "legend"},
    {"year": 2026, "month": 4, "user_index": 1, "team_index": 0, "krk": 60.0, "rank": 2, "league": "legend"},
]

async def create_users(session):
    created = []
    for data in USERS_DATA:
        result = await session.execute(select(Student).where(Student.id == data["student_id"]))
        if result.scalar_one_or_none():
            result = await session.execute(select(User).where(User.student_id == data["student_id"]))
            created.append(result.scalar_one())
            continue
        student = Student(id=data["student_id"], surname=data["surname"], name=data["name"], patronymic=data["patronymic"])
        session.add(student); await session.flush()
        user = User(student_id=student.id, username=data["username"],
                    password_hash=get_password_hash(data["password"]), role=data["role"])
        session.add(user); await session.flush()
        created.append(user)
    return created


async def create_teams(session, users):
    created = []
    for td in TEAMS_DATA:
        result = await session.execute(select(Team).where(Team.name == td["name"]))
        if result.scalar_one_or_none():
            team = (await session.execute(select(Team).where(Team.name == td["name"]))).scalar_one()
            created.append(team)
            continue
        captain = users[td["captain_index"]]
        team = Team(name=td["name"], description=td["description"], captain_id=captain.id, rating=td["rating"])
        session.add(team); await session.flush()
        created.append(team)
        for idx in td["member_indices"]:
            mu = users[idx]
            existing = await session.execute(select(TeamMember).where(TeamMember.user_id == mu.id))
            if existing.scalar_one_or_none():
                continue
            session.add(TeamMember(user_id=mu.id, team_id=team.id))
    return created


async def create_posts(session, users, teams):
    for pd in POSTS_DATA:
        author = users[pd["author_index"]]
        author_team = None
        for td in TEAMS_DATA:
            if pd["author_index"] in td["member_indices"]:
                author_team = next((t for t in teams if t.name == td["name"]), None)
                break
        created_at = _utcnow() - timedelta(days=pd["created_days_ago"])
        created_at = created_at.replace(hour=(pd["author_index"] * 3) % 24, minute=(pd["author_index"] * 7) % 60)
        post = Post(title=pd["title"], content=pd["content"], author_id=author.id,
                    team_id=author_team.id if author_team else None, created_at=created_at, updated_at=created_at)
        session.add(post)
    await session.flush()


async def create_events(session, users, teams):
    for ed in EVENTS_DATA:
        creator = users[ed["created_by_index"]]
        team = teams[0] if ed["created_by_index"] in [0, 1, 2] else (teams[1] if ed["created_by_index"] in [3, 4, 5] else teams[2])
        starts = _utcnow() + timedelta(days=ed["starts_at"])
        ends = _utcnow() + timedelta(days=ed["ends_at"]) if ed["ends_at"] else None
        event = TeamEvent(team_id=team.id, title=ed["title"], description=ed["description"],
                          event_type=ed["event_type"], format=ed["format"], location=ed["location"],
                          starts_at=starts, ends_at=ends, max_participants=ed["max_participants"],
                          is_public=ed["is_public"], created_by=creator.id)
        session.add(event)
    await session.flush()


async def create_challenges(session):
    created = []
    for cd in CHALLENGES_DATA:
        result = await session.execute(select(Challenge).where(Challenge.title == cd["title"]))
        if result.scalar_one_or_none():
            ch = (await session.execute(select(Challenge).where(Challenge.title == cd["title"]))).scalar_one()
            created.append(ch)
            continue
        deadline = _utcnow() + timedelta(days=cd["deadline_days"]) if cd["deadline_days"] else None
        ch = Challenge(title=cd["title"], description=cd["description"], reward_points=cd["reward_points"],
                       deadline=deadline, is_active=cd["is_active"])
        session.add(ch); await session.flush()
        created.append(ch)
    return created


async def create_team_challenges(session, teams, challenges):
    for tcd in TEAM_CHALLENGES_DATA:
        enrolled = _utcnow() - timedelta(days=tcd["enrolled_days_ago"])
        completed = _utcnow() - timedelta(days=tcd["completed_days_ago"]) if tcd["completed_days_ago"] else None
        tc = TeamChallenge(team_id=teams[tcd["team_index"]].id, challenge_id=challenges[tcd["challenge_index"]].id,
                           status=tcd["status"], enrolled_at=enrolled, completed_at=completed)
        session.add(tc)
    await session.flush()


async def create_help_requests(session, users, teams):
    created = []
    for hd in HELP_REQUESTS_DATA:
        created_at = _utcnow() - timedelta(days=hd["created_days_ago"])
        fulfilled_at = _utcnow() - timedelta(days=hd["created_days_ago"] - 1) if hd["fulfilled_by"] is not None else None
        hr = HelpRequest(requesting_team_id=teams[hd["team_index"]].id, title=hd["title"], description=hd["description"],
                         help_type=hd["help_type"], format=hd["format"], estimated_effort_hours=hd["effort_hours"],
                         status=hd["status"], created_at=created_at,
                         fulfilled_by_team_id=teams[hd["fulfilled_by"]].id if hd["fulfilled_by"] is not None else None,
                         fulfilled_at=fulfilled_at)
        session.add(hr); await session.flush()
        created.append(hr)
    return created


async def create_help_responses(session, teams, help_requests):
    for hrd in HELP_RESPONSES_DATA:
        responded = _utcnow() - timedelta(days=hrd["days_ago"])
        hr = HelpResponse(help_request_id=help_requests[hrd["request_index"]].id,
                          responding_team_id=teams[hrd["team_index"]].id,
                          message=hrd["message"], status=hrd["status"], responded_at=responded)
        session.add(hr)
    await session.flush()


async def create_reports(session, users, teams, challenges):
    for rd in REPORTS_DATA:
        created_at = _utcnow() - timedelta(days=rd["created_days_ago"])
        report = TeamReport(team_id=teams[rd["team_index"]].id,
                            challenge_id=challenges[rd["challenge_index"]].id if rd["challenge_index"] is not None else None,
                            title=rd["title"], description=rd["description"],
                            created_by=users[rd["created_by_index"]].id, created_at=created_at, is_approved=rd["is_approved"])
        session.add(report); await session.flush()
        for task in rd["tasks"]:
            rt = ReportTask(report_id=report.id, user_id=users[task["user_index"]].id,
                            description=task["description"], completed=task["completed"],
                            completed_at=created_at if task["completed"] else None)
            session.add(rt)
    await session.flush()


async def create_checkins(session, users, teams):
    for cd in CHECKINS_DATA:
        week_start = _utcnow() - timedelta(days=abs(cd["week_start"]))
        reviewed_at = _utcnow() - timedelta(days=cd["reviewed_days_ago"]) if cd["reviewed_days_ago"] else None
        checkin = WeeklyCheckin(team_id=teams[cd["team_index"]].id, week_start_date=week_start,
                                content=cd["content"], created_by=users[cd["created_by_index"]].id,
                                status=cd["status"], reviewed_by=users[cd["reviewed_by"]].id if cd["reviewed_by"] else None,
                                reviewed_at=reviewed_at)
        session.add(checkin); await session.flush()
        for task in cd["tasks"]:
            ct = CheckinTask(checkin_id=checkin.id, user_id=users[task["user_index"]].id,
                             description=task["description"], completed=task["completed"],
                             completed_at=week_start if task["completed"] else None)
            session.add(ct)
    await session.flush()


async def create_user_ratings(session, users):
    created = []
    for rd in USER_RATINGS_DATA:
        user = users[rd["user_index"]]
        total = rd["base"] + rd["unity"] + rd["bonus"] - rd["penalty"]
        ur = UserRating(user_id=user.id, base_score=rd["base"], unity_score=rd["unity"],
                        bonus_score=rd["bonus"], penalty_score=rd["penalty"], total_krk=total,
                        global_rank=rd["rank"], league=rd["league"], rank_change=rd["change"])
        session.add(ur); await session.flush()
        created.append(ur)
    return created


async def create_rating_logs(session, user_ratings):
    for rl in RATING_LOGS_DATA:
        ur = user_ratings[rl["user_index"]]
        created_at = _utcnow() - timedelta(days=rl["days_ago"])
        log = RatingLog(user_id=ur.id, old_total=rl["old_total"], new_total=rl["new_total"],
                        event_type=rl["event"], description=rl["desc"], created_at=created_at)
        session.add(log)
    await session.flush()


async def create_team_ratings(session, teams):
    created = []
    for trd in TEAM_RATINGS_DATA:
        team = teams[trd["team_index"]]
        now = _utcnow()
        tr = TeamRating(team_id=team.id, average_krk=trd["average_krk"], member_count=trd["member_count"],
                        global_rank=trd["rank"], rank_change=trd["change"],
                        created_at=now, updated_at=now)
        session.add(tr); await session.flush()
        created.append(tr)
    return created


async def create_team_rating_logs(session, team_ratings, teams):
    for trl in TEAM_RATING_LOGS_DATA:
        tr = team_ratings[trl["team_index"]]
        created_at = _utcnow() - timedelta(days=trl["days_ago"])
        log = TeamRatingLog(team_rating_id=tr.id, team_id=teams[trl["team_index"]].id,
                            old_average=trl["old"], new_average=trl["new"],
                            event_type=trl["event"], description=trl["desc"], created_at=created_at)
        session.add(log)
    await session.flush()


async def create_activities(session, users, teams):
    for ad in ACTIVITIES_DATA:
        created_at = _utcnow() - timedelta(days=ad["days_ago"])
        act = Activity(team_id=teams[ad["team_index"]].id, user_id=users[ad["user_index"]].id,
                       event_type=ad["event_type"], title=ad["title"], description=ad["desc"],
                       created_at=created_at)
        session.add(act)
    await session.flush()


async def create_team_activity_logs(session, teams):
    for tal in TEAM_ACTIVITY_LOGS_DATA:
        created_at = _utcnow() - timedelta(days=tal["days_ago"])
        log = TeamActivityLog(team_id=teams[tal["team_index"]].id, event_type=tal["event"],
                              old_rating=tal["old"], new_rating=tal["new"], description=tal["desc"],
                              created_at=created_at)
        session.add(log)
    await session.flush()


async def create_join_requests(session, users, teams):
    for jr in JOIN_REQUESTS_DATA:
        created_at = _utcnow() - timedelta(days=jr["days_ago"])
        req = TeamJoinRequest(user_id=users[jr["user_index"]].id, team_id=teams[jr["team_index"]].id,
                              status=jr["status"], created_at=created_at)
        session.add(req)
    await session.flush()


async def create_invite_links(session, teams):
    for il in INVITE_LINKS_DATA:
        expires = _utcnow() + timedelta(hours=il["expires_hours"])
        token = secrets.token_urlsafe(32)
        link = TeamInviteLink(team_id=teams[il["team_index"]].id, token=token, expires_at=expires,
                              max_uses=il["max_uses"], uses_count=il["uses_count"], is_active=il["is_active"])
        session.add(link)
    await session.flush()


async def create_league_settings(session):
    for ls in LEAGUE_SETTINGS_DATA:
        result = await session.execute(select(LeagueSettings).where(LeagueSettings.tier == ls["tier"]))
        if result.scalar_one_or_none():
            continue
        setting = LeagueSettings(tier=ls["tier"], min_score=ls["min_score"],
                                max_score=ls["max_score"], is_active=ls["is_active"],
                                updated_at=_utcnow())
        session.add(setting)
    await session.flush()


async def create_archives(session, users, teams):
    for ar in ARCHIVES_DATA:
        archive = RatingPeriodArchive(period_year=ar["year"], period_month=ar["month"],
                                       user_id=users[ar["user_index"]].id,
                                       team_id=teams[ar["team_index"]].id if ar["team_index"] is not None else None,
                                       final_krk=ar["krk"], final_rank=ar["rank"], league=ar["league"],
                                       created_at=_utcnow())
        session.add(archive)
    await session.flush()


async def print_summary(session):
    counts = {
        "users": (await session.execute(select(func.count(User.id)))).scalar(),
        "teams": (await session.execute(select(func.count(Team.id)))).scalar(),
        "posts": (await session.execute(select(func.count(Post.id)))).scalar(),
        "events": (await session.execute(select(func.count(TeamEvent.id)))).scalar(),
        "challenges": (await session.execute(select(func.count(Challenge.id)))).scalar(),
        "team_challenges": (await session.execute(select(func.count(TeamChallenge.id)))).scalar(),
        "help_requests": (await session.execute(select(func.count(HelpRequest.id)))).scalar(),
        "help_responses": (await session.execute(select(func.count(HelpResponse.id)))).scalar(),
        "reports": (await session.execute(select(func.count(TeamReport.id)))).scalar(),
        "checkins": (await session.execute(select(func.count(WeeklyCheckin.id)))).scalar(),
        "user_ratings": (await session.execute(select(func.count(UserRating.id)))).scalar(),
        "team_ratings": (await session.execute(select(func.count(TeamRating.id)))).scalar(),
        "activities": (await session.execute(select(func.count(Activity.id)))).scalar(),
        "team_activity_logs": (await session.execute(select(func.count(TeamActivityLog.id)))).scalar(),
        "join_requests": (await session.execute(select(func.count(TeamJoinRequest.id)))).scalar(),
        "invite_links": (await session.execute(select(func.count(TeamInviteLink.id)))).scalar(),
        "archives": (await session.execute(select(func.count(RatingPeriodArchive.id)))).scalar(),
    }

    print("\n" + "=" * 65)
    print("  📊 СВОДКА СОЗДАННЫХ ДАННЫХ")
    print("=" * 65)
    print(f"\n  👤 Пользователи:        {counts['users']}")
    print(f"  🏆 Команды:             {counts['teams']}")
    print(f"  📝 Посты:               {counts['posts']}")
    print(f"  📅 События:             {counts['events']}")
    print(f"  🎯 Челленджи:           {counts['challenges']}")
    print(f"  🏁 Записи на челленджи: {counts['team_challenges']}")
    print(f"  🆘 Заявки на помощь:    {counts['help_requests']}")
    print(f"  💬 Отклики на помощь:   {counts['help_responses']}")
    print(f"  📋 Отчёты команд:       {counts['reports']}")
    print(f"  📊 Check-ins:           {counts['checkins']}")
    print(f"  ⭐ Рейтинги (юзеры):   {counts['user_ratings']}")
    print(f"  ⭐ Рейтинги (команды):  {counts['team_ratings']}")
    print(f"  🔥 Активности:          {counts['activities']}")
    print(f"  📈 Логи активности:    {counts['team_activity_logs']}")
    print(f"  📨 Заявки на вступление:{counts['join_requests']}")
    print(f"  🔗 Приглас. ссылки:    {counts['invite_links']}")
    print(f"  📦 Архивы рейтингов:   {counts['archives']}")

    print("\n  👥 Пользователи:")
    print("  " + "-" * 60)
    for u in USERS_DATA:
        role_emoji = "👑" if u["role"] == "captain" else ("🔧" if u["role"] == "admin" else ("📚" if u["role"] == "teacher" else "🎓"))
        team_str = f"→ {u['team']}" if u["team"] else "→ (свободен)"
        print(f"    {role_emoji} @{u['username']:12} | {u['surname']:10} {u['name']:8} | {team_str}")

    print("\n  🏆 Команды:")
    print("  " + "-" * 60)
    for i, t in enumerate(TEAMS_DATA):
        captain = USERS_DATA[t["captain_index"]]
        members = [USERS_DATA[idx]["surname"] + " " + USERS_DATA[idx]["name"] for idx in t["member_indices"]]
        print(f"    {i+1}. «{t['name']}» — рейтинг: {t['rating']}")
        print(f"       Капитан: {captain['surname']} {captain['name']}")
        print(f"       Участники: {', '.join(members)}")

    print("\n  📅 Ближайшие события:")
    print("  " + "-" * 60)
    result = await session.execute(select(TeamEvent).where(TeamEvent.starts_at > _utcnow()).order_by(TeamEvent.starts_at).limit(3))
    for e in result.scalars().all():
        date_str = e.starts_at.strftime("%d.%m.%Y %H:%M") if e.starts_at else "TBD"
        print(f"    📌 [{date_str}] {e.title}")

    print("\n  🆘 Активные заявки на помощь:")
    print("  " + "-" * 60)
    result = await session.execute(select(HelpRequest).where(HelpRequest.status == "open"))
    for hr in result.scalars().all():
        print(f"    🆘 {hr.title[:45]}{'...' if len(hr.title) > 45 else ''}")

    print("\n  📨 Ожидающие заявки на вступление:")
    print("  " + "-" * 60)
    result = await session.execute(select(TeamJoinRequest).where(TeamJoinRequest.status == "pending"))
    for req in result.scalars().all():
        user = next((u for u in USERS_DATA if u.get("student_id") == req.user_id), None)
        if user:
            print(f"    ⏳ {user['surname']} {user['name']} → команда #{req.team_id}")

    print("\n  ⭐ ТОП-5 пользователей по рейтингу:")
    print("  " + "-" * 60)
    result = await session.execute(select(UserRating).order_by(UserRating.total_krk.desc()).limit(5))
    for i, r in enumerate(result.scalars().all(), 1):
        # Берём студента отдельным запросом: ленивая подгрузка user.student
        # в async-сессии вызвала бы MissingGreenlet.
        student_result = await session.execute(
            select(Student)
            .join(User, User.student_id == Student.id)
            .where(User.id == r.user_id)
        )
        student = student_result.scalar_one_or_none()
        if student:
            print(f"    {i}. {student.surname} {student.name} — {r.total_krk} КРК ({r.league})")

    print("\n" + "=" * 65)
    print("  ✅ НАПОЛНЕНИЕ ЗАВЕРШЕНО!")
    print("=" * 65)
    print("\n  💡 Данные для входа:")
    print("     Админ:     admin / admin123")
    print("     Препод:    teacher_ip / teacher123")
    print("     Студенты:  smirnov_ap / pass201 (и другие pass202–pass210)")
    print()


async def main():
    print("=" * 65)
    print("  🚀 МЕГА-НАПОЛНЕНИЕ САЙТА")
    print("=" * 65)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("\n✅ Таблицы проверены/созданы")

    async with AsyncSessionLocal() as session:
        async with session.begin():
            print("\n👤 Пользователи..."); users = await create_users(session)
            print("🏆 Команды..."); teams = await create_teams(session, users)
            print("📝 Посты..."); await create_posts(session, users, teams)
            print("📅 События..."); await create_events(session, users, teams)
            print("🎯 Челленджи..."); challenges = await create_challenges(session)
            print("🏁 Записи на челленджи..."); await create_team_challenges(session, teams, challenges)
            print("🆘 Заявки на помощь..."); help_requests = await create_help_requests(session, users, teams)
            print("💬 Отклики на помощь..."); await create_help_responses(session, teams, help_requests)
            print("📋 Отчёты..."); await create_reports(session, users, teams, challenges)
            print("📊 Check-ins..."); await create_checkins(session, users, teams)
            print("⭐ Рейтинги пользователей..."); user_ratings = await create_user_ratings(session, users)
            print("📈 Логи рейтингов..."); await create_rating_logs(session, user_ratings)
            print("⭐ Рейтинги команд..."); team_ratings = await create_team_ratings(session, teams)
            print("📈 Логи командных рейтингов..."); await create_team_rating_logs(session, team_ratings, teams)
            print("🔥 Активности..."); await create_activities(session, users, teams)
            print("📈 Логи активности..."); await create_team_activity_logs(session, teams)
            print("📨 Заявки на вступление..."); await create_join_requests(session, users, teams)
            print("🔗 Пригласительные ссылки..."); await create_invite_links(session, teams)
            print("⚙️ Настройки лиг..."); await create_league_settings(session)
            print("📦 Архивы рейтингов..."); await create_archives(session, users, teams)

        await session.commit()
        print("\n💾 Все данные сохранены")

        await print_summary(session)


if __name__ == "__main__":
    asyncio.run(main())