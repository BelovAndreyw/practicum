"""
================================================================================
  МЕГА-СКРИПТ НАПОЛНЕНИЯ САЙТА — ВСЕ МОДУЛИ
================================================================================

Наполняет ВСЕ таблицы проекта реалистичными тестовыми данными:
  • 17 пользователей (студенты + админ + преподаватель)
  • 3 команды по 5 участников с рейтингом
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

Запуск с хоста (Postgres должен быть проброшен на localhost):
  python scripts/seed_all.py

  dev:   postgres на 127.0.0.1:5432  (infra/docker-compose.dev.yml)
  pilot: postgres на 127.0.0.1:5433  (задайте SEED_POSTGRES_PORT=5433)

  Если с Windows не подключается к порту Postgres — запускайте через Docker:
  .\\scripts\\seed_dev.ps1
  bash scripts/seed_dev.sh
================================================================================
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import secrets

# Делаем пакет `app` импортируемым независимо от того, откуда запущен скрипт:
#   • из корня репозитория (рядом лежит ./backend/app)
#   • из каталога scripts/ (../backend/app)
#   • внутри backend-контейнера, где код лежит прямо в /app/app
_here = Path(__file__).resolve().parent
_repo_root = _here.parent
for _candidate in (_here / "backend", _repo_root / "backend", _here, _repo_root):
    if (_candidate / "app").is_dir():
        sys.path.insert(0, str(_candidate))
        break


def _load_env_file() -> None:
    """Загружает .env.pilot и .env; значения из .env перекрывают pilot."""
    import os

    for name in (".env.pilot", ".env"):
        env_path = _repo_root / name
        if not env_path.exists():
            continue
        override = name == ".env"
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and (override or key not in os.environ):
                os.environ[key] = value


def _database_url_for_host() -> str | None:
    """postgres:5432 в compose-доступен только внутри сети Docker."""
    import os
    from urllib.parse import urlparse, urlunparse

    url = os.environ.get("DATABASE_URL")
    if not url:
        user = os.environ.get("POSTGRES_USER")
        password = os.environ.get("POSTGRES_PASSWORD")
        db = os.environ.get("POSTGRES_DB")
        host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
        port = os.environ.get("POSTGRES_PORT", "5432")
        if user and password and db:
            url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"

    if not url:
        return None

    if os.path.exists("/.dockerenv"):
        return url

    parsed = urlparse(url)
    if parsed.hostname == "postgres":
        host = os.environ.get("SEED_POSTGRES_HOST", "127.0.0.1")
        # dev compose: 5432; pilot compose: 127.0.0.1:5433 (см. docker-compose.pilot.yml)
        port = int(os.environ.get("SEED_POSTGRES_PORT", os.environ.get("POSTGRES_PORT", "5432")))
        netloc = f"{parsed.username}:{parsed.password}@{host}:{port}"
        url = urlunparse(parsed._replace(netloc=netloc))
        print(f"[seed] DB host from machine: postgres:5432 -> {host}:{port}")

    return url


def _apply_database_url() -> None:
    import os

    _load_env_file()
    url = _database_url_for_host()
    if url:
        os.environ["DATABASE_URL"] = url


_apply_database_url()


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
from app.models.voting import VoteRound
from app.models.achievement import UserAchievement
from app.modules.rating.team_logic import TeamRatingService
from app.modules.achievement.catalog import get_achievement

USERS_DATA = [
    {"student_id": 201, "surname": "Смирнов", "name": "Алексей", "patronymic": "Петрович",
     "username": "smirnov_ap", "password": "pass201", "role": UserRole.CAPTAIN.value, "team": "Альфа",
     "email": "smirnov_ap@urfu.me", "phone": "+7 912 345-67-01"},
    {"student_id": 202, "surname": "Кузнецов", "name": "Дмитрий", "patronymic": "Сергеевич",
     "username": "kuznetsov_ds", "password": "pass202", "role": UserRole.STUDENT.value, "team": "Альфа",
     "email": "kuznetsov_ds@urfu.me", "phone": "+7 912 345-67-02"},
    {"student_id": 203, "surname": "Волков", "name": "Артём", "patronymic": "Николаевич",
     "username": "volkov_an", "password": "pass203", "role": UserRole.STUDENT.value, "team": "Альфа",
     "email": "volkov_an@urfu.me", "phone": "+7 912 345-67-03"},
    {"student_id": 204, "surname": "Попов", "name": "Максим", "patronymic": "Андреевич",
     "username": "popov_ma", "password": "pass204", "role": UserRole.CAPTAIN.value, "team": "Бета",
     "email": "popov_ma@urfu.me", "phone": "+7 912 345-67-04"},
    {"student_id": 205, "surname": "Васильев", "name": "Николай", "patronymic": "Игоревич",
     "username": "vasiliev_ni", "password": "pass205", "role": UserRole.STUDENT.value, "team": "Бета",
     "email": "vasiliev_ni@urfu.me", "phone": "+7 912 345-67-05"},
    {"student_id": 206, "surname": "Соколов", "name": "Илья", "patronymic": "Дмитриевич",
     "username": "sokolov_id", "password": "pass206", "role": UserRole.STUDENT.value, "team": "Бета",
     "email": "sokolov_id@urfu.me", "phone": "+7 912 345-67-06"},
    {"student_id": 207, "surname": "Новиков", "name": "Андрей", "patronymic": "Владимирович",
     "username": "novikov_av", "password": "pass207", "role": UserRole.CAPTAIN.value, "team": "Гамма",
     "email": "novikov_av@urfu.me", "phone": "+7 912 345-67-07"},
    {"student_id": 208, "surname": "Морозов", "name": "Павел", "patronymic": "Сергеевич",
     "username": "morozov_ps", "password": "pass208", "role": UserRole.STUDENT.value, "team": "Гамма",
     "email": "morozov_ps@urfu.me", "phone": "+7 912 345-67-08"},
    {"student_id": 209, "surname": "Петров", "name": "Сергей", "patronymic": "Владимирович",
     "username": "petrov_sv", "password": "pass209", "role": UserRole.STUDENT.value, "team": "Альфа",
     "email": "petrov_sv@urfu.me", "phone": "+7 912 345-67-09"},
    {"student_id": 210, "surname": "Лебедев", "name": "Константин", "patronymic": "Алексеевич",
     "username": "lebedev_ka", "password": "pass210", "role": UserRole.STUDENT.value, "team": "Бета",
     "email": "lebedev_ka@urfu.me", "phone": "+7 912 345-67-10"},
    {"student_id": 301, "surname": "Администратор", "name": "Системный", "patronymic": "",
     "username": "admin", "password": "admin123", "role": UserRole.ADMIN.value, "team": None,
     "email": "admin@urfu.me", "phone": "+7 912 000-00-01"},
    {"student_id": 302, "surname": "Преподаватель", "name": "Иван", "patronymic": "Петрович",
     "username": "teacher_ip", "password": "teacher123", "role": UserRole.TEACHER.value, "team": None,
     "email": "teacher_ip@urfu.me", "phone": "+7 912 000-00-02"},
    {"student_id": 211, "surname": "Фёдоров", "name": "Игорь", "patronymic": "Олегович",
     "username": "fedorov_io", "password": "pass211", "role": UserRole.STUDENT.value, "team": "Альфа",
     "email": "fedorov_io@urfu.me", "phone": "+7 912 345-67-11"},
    {"student_id": 212, "surname": "Орлов", "name": "Роман", "patronymic": "Викторович",
     "username": "orlov_rv", "password": "pass212", "role": UserRole.STUDENT.value, "team": "Бета",
     "email": "orlov_rv@urfu.me", "phone": "+7 912 345-67-12"},
    {"student_id": 213, "surname": "Зайцев", "name": "Егор", "patronymic": "Андреевич",
     "username": "zaitsev_ea", "password": "pass213", "role": UserRole.STUDENT.value, "team": "Гамма",
     "email": "zaitsev_ea@urfu.me", "phone": "+7 912 345-67-13"},
    {"student_id": 214, "surname": "Соловьёв", "name": "Денис", "patronymic": "Михайлович",
     "username": "soloviev_dm", "password": "pass214", "role": UserRole.STUDENT.value, "team": "Гамма",
     "email": "soloviev_dm@urfu.me", "phone": "+7 912 345-67-14"},
    {"student_id": 215, "surname": "Виноградов", "name": "Артур", "patronymic": "Сергеевич",
     "username": "vinogradov_as", "password": "pass215", "role": UserRole.STUDENT.value, "team": "Гамма",
     "email": "vinogradov_as@urfu.me", "phone": "+7 912 345-67-15"},
]

TEAMS_DATA = [
    {"name": "Альфа", "description": "Команда веб-разработчиков. Стек: React, FastAPI, PostgreSQL.",
     "captain_index": 0, "member_indices": [0, 1, 2, 8, 12], "rating": 4.0},
    {"name": "Бета", "description": "DevOps и инфраструктура. Docker, Kubernetes, CI/CD.",
     "captain_index": 3, "member_indices": [3, 4, 5, 9, 13], "rating": 3.8},
    {"name": "Гамма", "description": "Data Science и ML. Python, PyTorch, pandas.",
     "captain_index": 6, "member_indices": [6, 7, 14, 15, 16], "rating": 3.5},
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
     "content": "Итоги КРК-1:\n\n🥇 «Альфа» — 82.24 КРК\n🥈 «Бета» — 79.00 КРК\n🥉 «Гамма» — 53.20 КРК\n\nСледующий КРК — 15 апреля.",
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
     "content": "Баллы за документацию удваивались при повторной отправке.\n\nИсправлено, рейтинги пересчитаны. «Гамма» +1.50 КРК.\n\nЗаметили что-то ещё — пишите @vasiliev_ni.",
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
    {
        "title": "Воркшоп: чистый код на практике",
        "description": (
            "Большой практический воркшоп по чистому коду. Разберём принципы SOLID на живых примерах, "
            "проведём ревью реального кода участников и соберём чек-лист хороших практик.\n\n"
            "В программе: рефакторинг легаси-модуля, парное программирование, "
            "разбор типичных ошибок и Q&A с менторами. Возьмите ноутбук — будем кодить вместе!"
        ),
        "image_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
        "event_type": "workshop", "format": "offline", "location": "Аудитория ГУК-301",
        "starts_days": 2, "starts_hours": 4, "duration_h": 3,
        "max_participants": 40, "is_public": True, "created_by_index": 0,
    },
    {
        "title": "Онлайн-митап: React и производительность",
        "description": (
            "Говорим о реальной оптимизации React-приложений: мемоизация, виртуализация списков, "
            "ленивые загрузки и профилирование. Покажем до/после на метриках и ответим на вопросы.\n\n"
            "Будет запись, но живое участие даст возможность задать свой вопрос спикеру."
        ),
        "image_url": "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&q=80",
        "event_type": "lecture", "format": "online", "location": "https://meet.urfu.me/react-perf",
        "starts_days": 5, "starts_hours": 2, "duration_h": 2,
        "max_participants": 100, "is_public": True, "created_by_index": 0,
    },
    {
        "title": "DevOps-интенсив: CI/CD с нуля",
        "description": (
            "Интенсив по построению пайплайна: от Dockerfile до автодеплоя. Настроим GitHub Actions, "
            "healthcheck'и и секреты, разберём типичные провалы сборки.\n\n"
            "Практика на учебном репозитории — к концу встречи у каждого будет рабочий пайплайн."
        ),
        "image_url": "https://images.unsplash.com/photo-1605379399642-870262d3d051?w=1200&q=80",
        "event_type": "workshop", "format": "offline", "location": "Коворкинг ИРИТ-РТФ",
        "starts_days": 3, "starts_hours": 6, "duration_h": 4,
        "max_participants": 30, "is_public": True, "created_by_index": 3,
    },
    {
        "title": "Воркшоп по инфраструктуре как код",
        "description": (
            "Разбираем Terraform и идемпотентность инфраструктуры. Поднимем окружение, "
            "сломаем и восстановим его, обсудим best practices хранения состояния.\n\n"
            "Уровень — средний, желательно базовое знание Docker."
        ),
        "image_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
        "event_type": "workshop", "format": "online", "location": "https://meet.urfu.me/iac",
        "starts_days": 8, "starts_hours": 1, "duration_h": 2,
        "max_participants": 50, "is_public": True, "created_by_index": 4,
    },
    {
        "title": "Дата-сторителлинг: как показывать цифры",
        "description": (
            "Учимся превращать таблицы в понятные истории. Принципы визуализации, выбор графиков, "
            "ошибки восприятия и как их избегать.\n\n"
            "Принесите свой датасет — соберём по нему дашборд вместе."
        ),
        "image_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
        "event_type": "lecture", "format": "offline", "location": "Аудитория ГУК-415",
        "starts_days": 6, "starts_hours": 5, "duration_h": 3,
        "max_participants": 35, "is_public": True, "created_by_index": 6,
    },
    {
        "title": "Python для анализа данных: pandas hands-on",
        "description": (
            "Практика по pandas: загрузка, очистка, агрегации и джойны. Решаем реальные кейсы "
            "по шагам, обсуждаем производительность на больших данных.\n\n"
            "Формат — повторяй за спикером, все ноутбуки выдаём заранее."
        ),
        "image_url": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=1200&q=80",
        "event_type": "workshop", "format": "online", "location": "https://meet.urfu.me/pandas",
        "starts_days": 9, "starts_hours": 3, "duration_h": 2,
        "max_participants": 60, "is_public": True, "created_by_index": 7,
    },
    {
        "title": "Большая встреча потока: демо-день команд",
        "description": (
            "Главное событие месяца! Каждая команда показывает результаты, обменивается опытом и "
            "получает обратную связь от организаторов и других команд.\n\n"
            "После демо — нетворкинг и награждение лучших команд потока. Приходите болеть за своих!"
        ),
        "image_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80",
        "event_type": "ceremony", "format": "offline", "location": "Актовый зал УрФУ",
        "starts_days": 12, "starts_hours": 2, "duration_h": 5,
        "max_participants": 300, "is_public": True, "created_by_index": 10,
    },
]

CHALLENGES_DATA = [
    {"title": "Провести совместный воркшоп",
     "description": "Организуйте и проведите воркшоп для участников другой команды. Поделитесь экспертизой!",
     "reward_points": 150, "deadline_days": 14, "is_active": True},
    {"title": "Создать чек-лист по теме",
     "description": "Соберите практический чек-лист по своей теме и опубликуйте его для потока.",
     "reward_points": 90, "deadline_days": 10, "is_active": True},
    {"title": "Помочь другой команде",
     "description": "Откликнитесь на запрос о помощи на бирже знаний и доведите задачу до результата.",
     "reward_points": 120, "deadline_days": 21, "is_active": True},
]

TEAM_CHALLENGES_DATA = [
    {"team_index": 0, "challenge_index": 0, "status": "completed", "enrolled_days_ago": 25, "completed_days_ago": 5},
    {"team_index": 1, "challenge_index": 0, "status": "completed", "enrolled_days_ago": 25, "completed_days_ago": 6},
    {"team_index": 0, "challenge_index": 1, "status": "active", "enrolled_days_ago": 3, "completed_days_ago": None},
    {"team_index": 1, "challenge_index": 1, "status": "active", "enrolled_days_ago": 3, "completed_days_ago": None},
    {"team_index": 2, "challenge_index": 2, "status": "active", "enrolled_days_ago": 1, "completed_days_ago": None},
    {"team_index": 0, "challenge_index": 2, "status": "active", "enrolled_days_ago": 5, "completed_days_ago": None},
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
     "title": "Отчёт: совместный воркшоп",
     "description": "Провели воркшоп по чистому коду для команды Бета. 25 участников.",
     "created_by_index": 0, "is_approved": True, "created_days_ago": 5,
     "tasks": [
         {"user_index": 0, "description": "Подготовка материалов", "completed": True},
         {"user_index": 1, "description": "Проведение воркшопа", "completed": True},
         {"user_index": 2, "description": "Сбор обратной связи", "completed": True},
     ]},
    {"team_index": 1, "challenge_index": 0,
     "title": "Отчёт: воркшоп по CI/CD",
     "description": "Провели практический воркшоп по GitHub Actions для команды Гамма.",
     "created_by_index": 3, "is_approved": True, "created_days_ago": 6,
     "tasks": [
         {"user_index": 3, "description": "Настройка demo-репозитория", "completed": True},
         {"user_index": 4, "description": "Проведение сессии", "completed": True},
         {"user_index": 5, "description": "Документация для участников", "completed": True},
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
     "achievements": "Создали репозиторий, настроили CI, составили ТЗ.",
     "blockers": "Нужно согласовать тему с куратором.",
     "created_by_index": 0, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 19,
     "tasks": [
         {"user_index": 0, "description": "Создание репозитория и CI", "completed": True},
         {"user_index": 1, "description": "Исследование похожих проектов", "completed": True},
         {"user_index": 2, "description": "Составление ТЗ", "completed": True},
     ]},
    {"team_index": 0, "week_start": -14, "content": "Неделя 2: проектирование архитектуры.",
     "achievements": "Оформили лучшие конспекты по архитектуре, провели внутренний воркшоп.",
     "blockers": "",
     "created_by_index": 0, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 12,
     "tasks": [
         {"user_index": 0, "description": "Диаграмма компонентов", "completed": True},
         {"user_index": 1, "description": "Выбор UI-kit", "completed": True},
         {"user_index": 2, "description": "Проектирование схемы БД", "completed": True},
     ]},
    {"team_index": 0, "week_start": -7, "content": "Неделя 3: разработка MVP frontend'а.",
     "achievements": "Завершили челлендж по воркшопу, помогли команде Бета с Figma.",
     "blockers": "Задержка с доступом к стейджингу.",
     "created_by_index": 0, "status": "pending", "reviewed_by": None, "reviewed_days_ago": None,
     "tasks": [
         {"user_index": 0, "description": "Авторизация через JWT", "completed": True},
         {"user_index": 1, "description": "Главная страница и навигация", "completed": True},
         {"user_index": 2, "description": "Страница профиля команды", "completed": False},
     ]},
    {"team_index": 1, "week_start": -21, "content": "Неделя 1: настройка инфраструктуры.",
     "achievements": "Подняли Docker Compose, настроили SSL и reverse proxy.",
     "blockers": "",
     "created_by_index": 3, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 19,
     "tasks": [
         {"user_index": 3, "description": "Docker Compose для dev", "completed": True},
         {"user_index": 4, "description": "Nginx reverse proxy", "completed": True},
         {"user_index": 5, "description": "SSL Let's Encrypt", "completed": True},
     ]},
    {"team_index": 1, "week_start": -7, "content": "Неделя 3: CI/CD и мониторинг.",
     "achievements": "Создали чек-лист по деплою, оказали первую помощь команде Гамма.",
     "blockers": "Флаки-тесты в пайплайне.",
     "created_by_index": 3, "status": "pending", "reviewed_by": None, "reviewed_days_ago": None,
     "tasks": [
         {"user_index": 3, "description": "GitHub Actions pipeline", "completed": True},
         {"user_index": 4, "description": "Grafana dashboards", "completed": False},
         {"user_index": 5, "description": "Alerting через Telegram", "completed": False},
     ]},
    {"team_index": 2, "week_start": -14, "content": "Неделя 2: сбор и очистка данных.",
     "achievements": "Собрали датасет, создали чек-лист по визуализации.",
     "blockers": "Медленные SQL-запросы к отчётам.",
     "created_by_index": 6, "status": "approved", "reviewed_by": 11, "reviewed_days_ago": 12,
     "tasks": [
         {"user_index": 6, "description": "Парсинг данных столовой", "completed": True},
         {"user_index": 7, "description": "Очистка и нормализация", "completed": True},
     ]},
]

# Персональные достижения. РАЗНЫЕ id и РАЗНЫЕ даты (days_ago) — чтобы в профиле
# у одного человека check-in и помощь были в разные дни, а лента не дублировалась.
ACHIEVEMENTS_DATA = [
    {"user_index": 0, "achievement_id": "ach_x1", "days_ago": 19},
    {"user_index": 0, "achievement_id": "ach_team_player", "days_ago": 12},
    {"user_index": 1, "achievement_id": "ach_notes", "days_ago": 16},
    {"user_index": 1, "achievement_id": "ach_first_aid", "days_ago": 4},
    {"user_index": 2, "achievement_id": "ach_checklist", "days_ago": 9},
    {"user_index": 8, "achievement_id": "ach_team_player", "days_ago": 10},
    {"user_index": 12, "achievement_id": "ach_streak", "days_ago": 6},
    {"user_index": 3, "achievement_id": "ach_x1", "days_ago": 18},
    {"user_index": 3, "achievement_id": "ach_workshop", "days_ago": 5},
    {"user_index": 4, "achievement_id": "ach_streak", "days_ago": 7},
    {"user_index": 5, "achievement_id": "ach_checklist", "days_ago": 11},
    {"user_index": 6, "achievement_id": "ach_x1", "days_ago": 13},
    {"user_index": 6, "achievement_id": "ach_notes", "days_ago": 8},
    {"user_index": 7, "achievement_id": "ach_first_aid", "days_ago": 3},
    {"user_index": 14, "achievement_id": "ach_team_player", "days_ago": 15},
]

# Командные достижения: в ленту пишется ОДНА запись на команду (без «Спаситель ×5»),
# но достижение получает каждый участник — со слегка разным временем.
TEAM_ACHIEVEMENTS_DATA = [
    {"team_index": 0, "achievement_id": "ach_x2", "days_ago": 4},
    {"team_index": 0, "achievement_id": "ach_workshop", "days_ago": 14},
    {"team_index": 1, "achievement_id": "ach_x3", "days_ago": 9},
    {"team_index": 2, "achievement_id": "ach_first_aid", "days_ago": 2},
]

# Компоненты: total = base×0.6 + unity×0.3 + bonus×0.1 − penalty.
# Альфа — легенда (средний КРК 85.7), Бета ~79.6 — профи, Гамма ~53.2 — новичок.
USER_RATINGS_DATA = [
    # Альфа — ЛЕГЕНДА: средний КРК 85.7, у всех total ≥ 85.
    {"user_index": 0, "base": 88.5, "unity": 84.5, "bonus": 80.5, "penalty": 0.0, "rank": 1, "league": "legend", "change": 0},
    {"user_index": 12, "base": 88.2, "unity": 84.2, "bonus": 80.2, "penalty": 0.0, "rank": 2, "league": "legend", "change": 1},
    {"user_index": 1, "base": 87.8, "unity": 83.8, "bonus": 79.8, "penalty": 0.0, "rank": 3, "league": "legend", "change": 1},
    {"user_index": 2, "base": 87.0, "unity": 83.0, "bonus": 79.0, "penalty": 0.0, "rank": 4, "league": "legend", "change": 0},
    {"user_index": 8, "base": 87.0, "unity": 83.0, "bonus": 79.0, "penalty": 0.0, "rank": 5, "league": "legend", "change": 0},
    # Бета — ПРОФИ (средний ~79.6)
    {"user_index": 3, "base": 84.0, "unity": 80.0, "bonus": 76.0, "penalty": 0.0, "rank": 6, "league": "pro", "change": 0},
    {"user_index": 13, "base": 83.0, "unity": 79.0, "bonus": 75.0, "penalty": 0.0, "rank": 7, "league": "pro", "change": 0},
    {"user_index": 4, "base": 82.0, "unity": 78.0, "bonus": 74.0, "penalty": 0.0, "rank": 8, "league": "pro", "change": -1},
    {"user_index": 5, "base": 80.0, "unity": 76.0, "bonus": 72.0, "penalty": 0.0, "rank": 9, "league": "pro", "change": 0},
    {"user_index": 9, "base": 79.0, "unity": 75.0, "bonus": 71.0, "penalty": 0.0, "rank": 10, "league": "pro", "change": 0},
    # Гамма — НОВИЧОК (средний ~53.2, все total < 60)
    {"user_index": 6, "base": 58.0, "unity": 54.0, "bonus": 50.0, "penalty": 0.0, "rank": 11, "league": "newbie", "change": -2},
    {"user_index": 7, "base": 56.0, "unity": 52.0, "bonus": 48.0, "penalty": 0.0, "rank": 12, "league": "newbie", "change": 0},
    {"user_index": 14, "base": 55.0, "unity": 51.0, "bonus": 47.0, "penalty": 0.0, "rank": 13, "league": "newbie", "change": 0},
    {"user_index": 15, "base": 54.0, "unity": 50.0, "bonus": 46.0, "penalty": 0.0, "rank": 14, "league": "newbie", "change": 0},
    {"user_index": 16, "base": 53.0, "unity": 49.0, "bonus": 45.0, "penalty": 0.0, "rank": 15, "league": "newbie", "change": 0},
]

RATING_LOGS_DATA = [
    {"user_index": 0, "old_total": 80.20, "new_total": 85.20, "event": "challenge", "desc": "Завершён челлендж «Оптимизация SQL»", "days_ago": 5},
    {"user_index": 1, "old_total": 77.60, "new_total": 82.60, "event": "challenge", "desc": "Завершён челлендж «Оптимизация SQL»", "days_ago": 5},
    {"user_index": 3, "old_total": 77.00, "new_total": 82.00, "event": "challenge", "desc": "Завершён челлендж «Оптимизация SQL»", "days_ago": 6},
    {"user_index": 0, "old_total": 85.20, "new_total": 83.20, "event": "penalty", "desc": "Опоздание с check-in на 2 дня", "days_ago": 8},
    {"user_index": 6, "old_total": 58.00, "new_total": 56.00, "event": "penalty", "desc": "Штраф за просроченный check-in", "days_ago": 4},
]

TEAM_RATINGS_DATA = [
    {"team_index": 0, "average_krk": 0.0, "member_count": 5, "rank": 1, "change": 0},
    {"team_index": 1, "average_krk": 0.0, "member_count": 5, "rank": 2, "change": 0},
    {"team_index": 2, "average_krk": 0.0, "member_count": 5, "rank": 3, "change": 1},
]

TEAM_RATING_LOGS_DATA = [
    {"team_index": 0, "old": 82.24, "new": 85.70, "event": "member_rating_changed", "desc": "Выход в лигу «Легенда» после КРК-2", "days_ago": 8},
    {"team_index": 1, "old": 77.50, "new": 79.60, "event": "member_rating_changed", "desc": "Обновление после КРК-1", "days_ago": 8},
    {"team_index": 2, "old": 58.00, "new": 53.20, "event": "member_rating_changed", "desc": "Снижение после КРК-2 — команда в лиге «Новичок»", "days_ago": 4},
]

ACTIVITIES_DATA = [
    {"team_index": 0, "user_index": 0, "event_type": "team_created", "title": "Команда «Альфа» зарегистрирована", "desc": "Капитан: Смирнов А.П.", "days_ago": 25},
    {"team_index": 1, "user_index": 3, "event_type": "team_created", "title": "Команда «Бета» зарегистрирована", "desc": "Капитан: Попов М.А.", "days_ago": 25},
    {"team_index": 2, "user_index": 6, "event_type": "team_created", "title": "Команда «Гамма» зарегистрирована", "desc": "Капитан: Новиков А.В.", "days_ago": 20},
    {"team_index": 0, "user_index": 2, "event_type": "member_joined", "title": "Волков А.Н. присоединился к «Альфе»", "desc": "По пригласительной ссылке", "days_ago": 22},
    {"team_index": 0, "user_index": 0, "event_type": "challenge_completed", "title": "«Альфа» завершила челлендж", "desc": "Совместный воркшоп — 150 очков", "days_ago": 5},
    {"team_index": 1, "user_index": 3, "event_type": "challenge_completed", "title": "«Бета» завершила челлендж", "desc": "Совместный воркшоп — 150 очков", "days_ago": 6},
    {"team_index": 0, "user_index": 0, "event_type": "rating_updated", "title": "«Альфа» вышла в лигу «Легенда»", "desc": "Средний КРК: 85.70 (+3.46)", "days_ago": 8},
    {"team_index": 1, "user_index": 3, "event_type": "rating_updated", "title": "Рейтинг «Беты» обновлён", "desc": "Средний КРК: 79.60 (+2.10)", "days_ago": 8},
]

TEAM_ACTIVITY_LOGS_DATA = [
    {"team_index": 0, "event": "rating_change", "old": 82.24, "new": 85.70, "desc": "КРК-2: выход в «Легенду»", "days_ago": 8},
    {"team_index": 1, "event": "rating_change", "old": 77.50, "new": 79.60, "desc": "КРК-1: сильная инфраструктура", "days_ago": 10},
    {"team_index": 2, "event": "rating_change", "old": 58.00, "new": 53.20, "desc": "КРК-2: переход в лигу «Новичок»", "days_ago": 13},
    {"team_index": 0, "event": "member_joined", "old": 80.00, "new": 80.00, "desc": "Волков А.Н. присоединился", "days_ago": 22},
]

JOIN_REQUESTS_DATA = [
    {"user_index": 8, "team_index": 1, "status": "rejected", "days_ago": 12},
]

INVITE_LINKS_DATA = [
    {"team_index": 0, "expires_hours": 72, "max_uses": 5, "uses_count": 3, "is_active": True},
    {"team_index": 1, "expires_hours": 168, "max_uses": None, "uses_count": 2, "is_active": True},
    {"team_index": 2, "expires_hours": -24, "max_uses": 3, "uses_count": 3, "is_active": False},
    {"team_index": 0, "expires_hours": 24, "max_uses": 1, "uses_count": 1, "is_active": False},
]

LEAGUE_SETTINGS_DATA = [
    {"tier": "newbie", "min_score": 0.0, "max_score": 60.0, "is_active": True},
    {"tier": "pro", "min_score": 60.0, "max_score": 85.0, "is_active": True},
    {"tier": "legend", "min_score": 85.0, "max_score": None, "is_active": True},
]

ARCHIVES_DATA = [
    {"year": 2026, "month": 3, "user_index": 0, "team_index": 0, "krk": 78.00, "rank": 2, "league": "pro"},
    {"year": 2026, "month": 3, "user_index": 1, "team_index": 0, "krk": 76.00, "rank": 3, "league": "pro"},
    {"year": 2026, "month": 3, "user_index": 3, "team_index": 1, "krk": 75.00, "rank": 4, "league": "pro"},
    {"year": 2026, "month": 4, "user_index": 0, "team_index": 0, "krk": 85.20, "rank": 1, "league": "legend"},
    {"year": 2026, "month": 4, "user_index": 1, "team_index": 0, "krk": 82.60, "rank": 2, "league": "pro"},
]

async def create_users(session):
    created = []
    for data in USERS_DATA:
        result = await session.execute(select(Student).where(Student.id == data["student_id"]))
        if result.scalars().first():
            result = await session.execute(select(User).where(User.student_id == data["student_id"]))
            existing_user = result.scalar_one()
            existing_user.email = data.get("email")
            existing_user.phone = data.get("phone")
            created.append(existing_user)
            continue
        student = Student(id=data["student_id"], surname=data["surname"], name=data["name"], patronymic=data["patronymic"])
        session.add(student); await session.flush()
        user = User(student_id=student.id, username=data["username"],
                    password_hash=get_password_hash(data["password"]), role=data["role"],
                    email=data.get("email"), phone=data.get("phone"))
        session.add(user); await session.flush()
        created.append(user)
    return created


async def create_teams(session, users):
    created = []
    for td in TEAMS_DATA:
        result = await session.execute(select(Team).where(Team.name == td["name"]))
        team = result.scalars().first()
        captain = users[td["captain_index"]]
        if not team:
            team = Team(name=td["name"], description=td["description"], captain_id=captain.id, rating=td["rating"])
            session.add(team)
            await session.flush()
        else:
            team.description = td["description"]
            team.captain_id = captain.id
            team.rating = td["rating"]

        created.append(team)
        expected_user_ids = {users[idx].id for idx in td["member_indices"]}

        result = await session.execute(select(TeamMember).where(TeamMember.team_id == team.id))
        current_members = result.scalars().all()
        current_user_ids = {m.user_id for m in current_members}

        for idx in td["member_indices"]:
            mu = users[idx]
            if mu.id in current_user_ids:
                continue
            other_team = await session.execute(
                select(TeamMember).where(TeamMember.user_id == mu.id, TeamMember.team_id != team.id)
            )
            for membership in other_team.scalars().all():
                await session.delete(membership)
            session.add(TeamMember(user_id=mu.id, team_id=team.id))

        for membership in current_members:
            if membership.user_id not in expected_user_ids:
                await session.delete(membership)

    await session.flush()
    return created


async def _dedupe_by_field(session, model, field_name: str, values: list) -> int:
    """Удаляет дубликаты, оставляя запись с наименьшим id."""
    removed = 0
    for value in values:
        result = await session.execute(
            select(model)
            .where(getattr(model, field_name) == value)
            .order_by(model.id)
        )
        rows = result.scalars().all()
        for duplicate in rows[1:]:
            await session.delete(duplicate)
            removed += 1
    if removed:
        await session.flush()
    return removed


async def _dedupe_checkins(session) -> int:
    """Удаляет дубликаты check-in по (team_id, content), оставляя запись с меньшим id."""
    result = await session.execute(select(WeeklyCheckin).order_by(WeeklyCheckin.id))
    seen: dict[tuple[int, str], int] = {}
    removed = 0
    for row in result.scalars().all():
        key = (row.team_id, row.content or "")
        if key in seen:
            await session.delete(row)
            removed += 1
        else:
            seen[key] = row.id
    if removed:
        await session.flush()
    return removed


async def _dedupe_help_requests(session) -> int:
    """Удаляет дубликаты заявок на помощь по (requesting_team_id, title)."""
    result = await session.execute(select(HelpRequest).order_by(HelpRequest.id))
    seen: dict[tuple[int, str], int] = {}
    removed = 0
    for row in result.scalars().all():
        key = (row.requesting_team_id, row.title)
        if key in seen:
            await session.delete(row)
            removed += 1
        else:
            seen[key] = row.id
    if removed:
        await session.flush()
    return removed


async def _dedupe_reports(session) -> int:
    """Удаляет дубликаты отчётов по (team_id, title)."""
    result = await session.execute(select(TeamReport).order_by(TeamReport.id))
    seen: dict[tuple[int, str], int] = {}
    removed = 0
    for row in result.scalars().all():
        key = (row.team_id, row.title)
        if key in seen:
            await session.delete(row)
            removed += 1
        else:
            seen[key] = row.id
    if removed:
        await session.flush()
    return removed


async def _dedupe_all_before_seed(session) -> int:
    """Очистка дубликатов от повторных прогонов seed (оставляем запись с меньшим id)."""
    removed = 0
    for dedupe_fn in (
        _dedupe_team_challenges,
        _dedupe_help_requests,
        _dedupe_reports,
        _dedupe_checkins,
    ):
        removed += await dedupe_fn(session)
    if removed:
        print(f"   ↳ удалено дубликатов в БД: {removed}")
    return removed


async def create_posts(session, users, teams):
    post_titles = [pd["title"] for pd in POSTS_DATA]
    removed = await _dedupe_by_field(session, Post, "title", post_titles)
    if removed:
        print(f"   ↳ удалено дубликатов постов: {removed}")
    for pd in POSTS_DATA:
        existing = await session.execute(select(Post).where(Post.title == pd["title"]))
        if existing.scalars().first():
            continue
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
    event_titles = [ed["title"] for ed in EVENTS_DATA]
    removed = await _dedupe_by_field(session, TeamEvent, "title", event_titles)
    if removed:
        print(f"   ↳ удалено дубликатов событий: {removed}")

    alpha_indices = {0, 1, 2, 8, 12}
    beta_indices = {3, 4, 5, 9, 13}

    for ed in EVENTS_DATA:
        existing = await session.execute(select(TeamEvent).where(TeamEvent.title == ed["title"]))
        if existing.scalars().first():
            continue
        creator = users[ed["created_by_index"]]
        idx = ed["created_by_index"]
        if idx in alpha_indices:
            team = teams[0]
        elif idx in beta_indices:
            team = teams[1]
        else:
            team = teams[2]
        starts = _utcnow() + timedelta(days=ed["starts_days"], hours=ed["starts_hours"])
        ends = starts + timedelta(hours=ed["duration_h"])
        event = TeamEvent(
            team_id=team.id, title=ed["title"], description=ed["description"],
            image_url=ed.get("image_url"), event_type=ed["event_type"], format=ed["format"],
            location=ed["location"], starts_at=starts, ends_at=ends,
            max_participants=ed["max_participants"], is_public=ed["is_public"],
            created_by=creator.id,
        )
        session.add(event)
    await session.flush()


async def create_challenges(session):
    created = []
    for cd in CHALLENGES_DATA:
        result = await session.execute(select(Challenge).where(Challenge.title == cd["title"]))
        if result.scalars().first():
            ch = (await session.execute(select(Challenge).where(Challenge.title == cd["title"]))).scalar_one()
            created.append(ch)
            continue
        deadline = _utcnow() + timedelta(days=cd["deadline_days"]) if cd["deadline_days"] else None
        ch = Challenge(title=cd["title"], description=cd["description"], reward_points=cd["reward_points"],
                       deadline=deadline, is_active=cd["is_active"])
        session.add(ch); await session.flush()
        created.append(ch)
    return created


async def _dedupe_team_challenges(session) -> int:
    """Удаляет дубликаты записей на челлендж по (team_id, challenge_id)."""
    result = await session.execute(select(TeamChallenge).order_by(TeamChallenge.id))
    seen: dict[tuple[int, int], int] = {}
    removed = 0
    for row in result.scalars().all():
        key = (row.team_id, row.challenge_id)
        if key in seen:
            await session.delete(row)
            removed += 1
        else:
            seen[key] = row.id
    if removed:
        await session.flush()
    return removed


async def create_team_challenges(session, teams, challenges):
    for tcd in TEAM_CHALLENGES_DATA:
        team_id = teams[tcd["team_index"]].id
        challenge_id = challenges[tcd["challenge_index"]].id
        existing = await session.execute(
            select(TeamChallenge).where(
                TeamChallenge.team_id == team_id,
                TeamChallenge.challenge_id == challenge_id,
            ).limit(1)
        )
        if existing.scalars().first():
            continue
        enrolled = _utcnow() - timedelta(days=tcd["enrolled_days_ago"])
        completed = _utcnow() - timedelta(days=tcd["completed_days_ago"]) if tcd["completed_days_ago"] else None
        tc = TeamChallenge(team_id=team_id, challenge_id=challenge_id,
                           status=tcd["status"], enrolled_at=enrolled, completed_at=completed)
        session.add(tc)
    await session.flush()


async def create_help_requests(session, users, teams):
    created = []
    for hd in HELP_REQUESTS_DATA:
        team_id = teams[hd["team_index"]].id
        existing = await session.execute(
            select(HelpRequest).where(
                HelpRequest.requesting_team_id == team_id,
                HelpRequest.title == hd["title"],
            )
        )
        if found := existing.scalars().first():
            created.append(found)
            continue
        created_at = _utcnow() - timedelta(days=hd["created_days_ago"])
        fulfilled_at = _utcnow() - timedelta(days=hd["created_days_ago"] - 1) if hd["fulfilled_by"] is not None else None
        hr = HelpRequest(requesting_team_id=team_id, title=hd["title"], description=hd["description"],
                         help_type=hd["help_type"], format=hd["format"], estimated_effort_hours=hd["effort_hours"],
                         status=hd["status"], created_at=created_at,
                         fulfilled_by_team_id=teams[hd["fulfilled_by"]].id if hd["fulfilled_by"] is not None else None,
                         fulfilled_at=fulfilled_at)
        session.add(hr); await session.flush()
        created.append(hr)
    return created


async def create_help_responses(session, teams, help_requests):
    for hrd in HELP_RESPONSES_DATA:
        request_id = help_requests[hrd["request_index"]].id
        team_id = teams[hrd["team_index"]].id
        existing = await session.execute(
            select(HelpResponse).where(
                HelpResponse.help_request_id == request_id,
                HelpResponse.responding_team_id == team_id,
            )
        )
        if existing.scalars().first():
            continue
        responded = _utcnow() - timedelta(days=hrd["days_ago"])
        hr = HelpResponse(help_request_id=request_id,
                          responding_team_id=team_id,
                          message=hrd["message"], status=hrd["status"], responded_at=responded)
        session.add(hr)
    await session.flush()


async def create_reports(session, users, teams, challenges):
    for rd in REPORTS_DATA:
        team_id = teams[rd["team_index"]].id
        existing = await session.execute(
            select(TeamReport).where(
                TeamReport.team_id == team_id,
                TeamReport.title == rd["title"],
            )
        )
        if existing.scalars().first():
            continue
        created_at = _utcnow() - timedelta(days=rd["created_days_ago"])
        report = TeamReport(team_id=team_id,
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
        team_id = teams[cd["team_index"]].id
        existing = await session.execute(
            select(WeeklyCheckin).where(
                WeeklyCheckin.team_id == team_id,
                WeeklyCheckin.content == cd["content"],
            )
        )
        found = existing.scalars().first()
        if found:
            found.content = cd["content"]
            found.achievements = cd.get("achievements")
            found.blockers = cd.get("blockers") or None
            checkin = found
        else:
            checkin = WeeklyCheckin(
                team_id=team_id, week_start_date=week_start,
                content=cd["content"], achievements=cd.get("achievements"),
                blockers=cd.get("blockers") or None,
                created_by=users[cd["created_by_index"]].id,
                status=cd["status"],
                reviewed_by=users[cd["reviewed_by"]].id if cd["reviewed_by"] else None,
                reviewed_at=reviewed_at,
            )
            session.add(checkin)
            await session.flush()
            for task in cd["tasks"]:
                ct = CheckinTask(
                    checkin_id=checkin.id, user_id=users[task["user_index"]].id,
                    description=task["description"], completed=task["completed"],
                    completed_at=week_start if task["completed"] else None,
                )
                session.add(ct)
    await session.flush()


async def create_achievements(session, users):
    for ad in ACHIEVEMENTS_DATA:
        user = users[ad["user_index"]]
        existing = await session.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == ad["achievement_id"],
            )
        )
        if existing.scalars().first():
            continue

        unlocked_at = _utcnow() - timedelta(days=ad["days_ago"], hours=ad.get("hours_ago", 0))
        session.add(UserAchievement(
            user_id=user.id,
            achievement_id=ad["achievement_id"],
            unlocked_at=unlocked_at,
        ))

        definition = get_achievement(ad["achievement_id"])
        if not definition:
            continue

        membership = await session.execute(
            select(TeamMember).where(TeamMember.user_id == user.id)
        )
        membership = membership.scalars().first()
        if membership:
            session.add(Activity(
                team_id=membership.team_id,
                user_id=user.id,
                event_type="achievement_unlocked",
                title=f"Достижение: {definition.title}",
                description=definition.description,
                event_metadata={"achievement_id": ad["achievement_id"]},
                created_at=unlocked_at,
            ))
    await session.flush()


async def create_team_achievements(session, teams):
    for tad in TEAM_ACHIEVEMENTS_DATA:
        team = teams[tad["team_index"]]
        definition = get_achievement(tad["achievement_id"])
        if not definition:
            continue

        unlocked_at = _utcnow() - timedelta(days=tad["days_ago"], hours=tad.get("hours_ago", 0))
        members = (
            await session.execute(select(TeamMember).where(TeamMember.team_id == team.id))
        ).scalars().all()

        unlocked_any = False
        for i, member in enumerate(members):
            dup = await session.execute(
                select(UserAchievement).where(
                    UserAchievement.user_id == member.user_id,
                    UserAchievement.achievement_id == tad["achievement_id"],
                )
            )
            if dup.scalars().first():
                continue
            session.add(UserAchievement(
                user_id=member.user_id,
                achievement_id=tad["achievement_id"],
                unlocked_at=unlocked_at - timedelta(hours=i),
            ))
            unlocked_any = True

        if not unlocked_any:
            continue

        dup_activity = await session.execute(
            select(Activity).where(
                Activity.team_id == team.id,
                Activity.event_type == "achievement_unlocked",
                Activity.title == f"Достижение: {definition.title}",
            )
        )
        if dup_activity.scalars().first():
            continue

        session.add(Activity(
            team_id=team.id,
            user_id=None,
            event_type="achievement_unlocked",
            title=f"Достижение: {definition.title}",
            description=definition.description,
            event_metadata={"achievement_id": tad["achievement_id"], "team_wide": True},
            created_at=unlocked_at,
        ))
    await session.flush()


async def create_user_ratings(session, users):
    created = []
    for rd in USER_RATINGS_DATA:
        user = users[rd["user_index"]]
        existing = await session.execute(
            select(UserRating).where(UserRating.user_id == user.id)
        )
        found = existing.scalars().first()
        total = round(
            (rd["base"] * 0.6) + (rd["unity"] * 0.3) + (rd["bonus"] * 0.1) - rd["penalty"],
            2,
        )
        if found:
            found.base_score = rd["base"]
            found.unity_score = rd["unity"]
            found.bonus_score = rd["bonus"]
            found.penalty_score = rd["penalty"]
            found.total_krk = total
            found.global_rank = rd["rank"]
            found.league = rd["league"]
            found.rank_change = rd["change"]
            created.append(found)
            continue
        ur = UserRating(user_id=user.id, base_score=rd["base"], unity_score=rd["unity"],
                        bonus_score=rd["bonus"], penalty_score=rd["penalty"], total_krk=total,
                        global_rank=rd["rank"], league=rd["league"], rank_change=rd["change"])
        session.add(ur); await session.flush()
        created.append(ur)
    return created


async def create_rating_logs(session, user_ratings):
    for rl in RATING_LOGS_DATA:
        ur = user_ratings[rl["user_index"]]
        existing = await session.execute(
            select(RatingLog).where(
                RatingLog.user_id == ur.id,
                RatingLog.event_type == rl["event"],
                RatingLog.description == rl["desc"],
            )
        )
        if existing.scalars().first():
            continue
        created_at = _utcnow() - timedelta(days=rl["days_ago"])
        log = RatingLog(user_id=ur.id, old_total=rl["old_total"], new_total=rl["new_total"],
                        event_type=rl["event"], description=rl["desc"], created_at=created_at)
        session.add(log)
    await session.flush()


async def create_team_ratings(session, teams):
    created = []
    for trd in TEAM_RATINGS_DATA:
        team = teams[trd["team_index"]]
        existing = await session.execute(
            select(TeamRating).where(TeamRating.team_id == team.id)
        )
        found = existing.scalars().first()
        if found:
            created.append(found)
            continue
        now = _utcnow()
        tr = TeamRating(team_id=team.id, average_krk=trd["average_krk"], member_count=trd["member_count"],
                        global_rank=trd["rank"], rank_change=trd["change"],
                        created_at=now, updated_at=now)
        session.add(tr); await session.flush()
        created.append(tr)
    return created


async def recalculate_all_team_ratings(session, teams):
    service = TeamRatingService(session)
    for team in teams:
        await service.recalculate_team_rating(team.id)


async def create_team_rating_logs(session, team_ratings, teams):
    for trl in TEAM_RATING_LOGS_DATA:
        tr = team_ratings[trl["team_index"]]
        team_id = teams[trl["team_index"]].id
        existing = await session.execute(
            select(TeamRatingLog).where(
                TeamRatingLog.team_id == team_id,
                TeamRatingLog.event_type == trl["event"],
                TeamRatingLog.description == trl["desc"],
            )
        )
        if existing.scalars().first():
            continue
        created_at = _utcnow() - timedelta(days=trl["days_ago"])
        log = TeamRatingLog(team_rating_id=tr.id, team_id=team_id,
                            old_average=trl["old"], new_average=trl["new"],
                            event_type=trl["event"], description=trl["desc"], created_at=created_at)
        session.add(log)
    await session.flush()


async def create_activities(session, users, teams):
    for ad in ACTIVITIES_DATA:
        team_id = teams[ad["team_index"]].id
        existing = await session.execute(
            select(Activity).where(
                Activity.team_id == team_id,
                Activity.title == ad["title"],
                Activity.event_type == ad["event_type"],
            )
        )
        if existing.scalars().first():
            continue
        created_at = _utcnow() - timedelta(days=ad["days_ago"])
        act = Activity(team_id=team_id, user_id=users[ad["user_index"]].id,
                       event_type=ad["event_type"], title=ad["title"], description=ad["desc"],
                       created_at=created_at)
        session.add(act)
    await session.flush()


async def create_team_activity_logs(session, teams):
    for tal in TEAM_ACTIVITY_LOGS_DATA:
        team_id = teams[tal["team_index"]].id
        existing = await session.execute(
            select(TeamActivityLog).where(
                TeamActivityLog.team_id == team_id,
                TeamActivityLog.event_type == tal["event"],
                TeamActivityLog.description == tal["desc"],
            )
        )
        if existing.scalars().first():
            continue
        created_at = _utcnow() - timedelta(days=tal["days_ago"])
        log = TeamActivityLog(team_id=team_id, event_type=tal["event"],
                              old_rating=tal["old"], new_rating=tal["new"], description=tal["desc"],
                              created_at=created_at)
        session.add(log)
    await session.flush()


async def create_join_requests(session, users, teams):
    for jr in JOIN_REQUESTS_DATA:
        user_id = users[jr["user_index"]].id
        team_id = teams[jr["team_index"]].id
        existing = await session.execute(
            select(TeamJoinRequest).where(
                TeamJoinRequest.user_id == user_id,
                TeamJoinRequest.team_id == team_id,
            )
        )
        if existing.scalars().first():
            continue
        created_at = _utcnow() - timedelta(days=jr["days_ago"])
        req = TeamJoinRequest(user_id=user_id, team_id=team_id,
                              status=jr["status"], created_at=created_at)
        session.add(req)
    await session.flush()


_INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


async def create_invite_links(session, teams):
    for il in INVITE_LINKS_DATA:
        team_id = teams[il["team_index"]].id
        existing = await session.execute(
            select(TeamInviteLink).where(
                TeamInviteLink.team_id == team_id,
                TeamInviteLink.max_uses == il["max_uses"],
                TeamInviteLink.is_active == il["is_active"],
            )
        )
        if existing.scalars().first():
            continue
        expires = _utcnow() + timedelta(hours=il["expires_hours"])
        token = "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(6))
        link = TeamInviteLink(team_id=team_id, token=token, expires_at=expires,
                              max_uses=il["max_uses"], uses_count=il["uses_count"], is_active=il["is_active"])
        session.add(link)
    await session.flush()


async def create_league_settings(session):
    for ls in LEAGUE_SETTINGS_DATA:
        result = await session.execute(select(LeagueSettings).where(LeagueSettings.tier == ls["tier"]))
        found = result.scalars().first()
        if found:
            found.min_score = ls["min_score"]
            found.max_score = ls["max_score"]
            found.is_active = ls["is_active"]
            found.updated_at = _utcnow()
            continue
        session.add(LeagueSettings(
            tier=ls["tier"], min_score=ls["min_score"],
            max_score=ls["max_score"], is_active=ls["is_active"],
            updated_at=_utcnow(),
        ))
    await session.flush()


async def create_archives(session, users, teams):
    for ar in ARCHIVES_DATA:
        user_id = users[ar["user_index"]].id
        existing = await session.execute(
            select(RatingPeriodArchive).where(
                RatingPeriodArchive.period_year == ar["year"],
                RatingPeriodArchive.period_month == ar["month"],
                RatingPeriodArchive.user_id == user_id,
            )
        )
        if existing.scalars().first():
            continue
        archive = RatingPeriodArchive(period_year=ar["year"], period_month=ar["month"],
                                       user_id=user_id,
                                       team_id=teams[ar["team_index"]].id if ar["team_index"] is not None else None,
                                       final_krk=ar["krk"], final_rank=ar["rank"], league=ar["league"],
                                       created_at=_utcnow())
        session.add(archive)
    await session.flush()


async def create_vote_rounds(session, teams):
    """Открытый раунд голосования для первой команды (демо)."""
    if not teams:
        return
    team = teams[0]
    existing = await session.execute(
        select(VoteRound).where(VoteRound.team_id == team.id, VoteRound.is_open.is_(True))
        .order_by(VoteRound.created_at.desc())
    )
    open_rounds = existing.scalars().all()
    if open_rounds:
        # Закрыть дубликаты от повторных прогонов seed, оставить один активный
        for duplicate in open_rounds[1:]:
            duplicate.is_open = False
        await session.flush()
        return
    session.add(VoteRound(
        team_id=team.id,
        cycle_label="Цикл 1",
        is_open=True,
        closes_at=_utcnow() + timedelta(days=14),
    ))
    await session.flush()
    return 1


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
    team_rows = await session.execute(
        select(Team, TeamRating)
        .outerjoin(TeamRating, TeamRating.team_id == Team.id)
        .order_by(Team.id)
    )
    for i, (team, tr) in enumerate(team_rows.all()):
        t = TEAMS_DATA[i]
        captain = USERS_DATA[t["captain_index"]]
        members = [USERS_DATA[idx]["surname"] + " " + USERS_DATA[idx]["name"] for idx in t["member_indices"]]
        avg_krk = f"{tr.average_krk:.2f}" if tr else "—"
        print(f"    {i+1}. «{team.name}» — средний КРК: {avg_krk}")
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
        student = student_result.scalars().first()
        if student:
            print(f"    {i}. {student.surname} {student.name} — {r.total_krk} КРК ({r.league})")

    print("\n" + "=" * 65)
    print("  ✅ НАПОЛНЕНИЕ ЗАВЕРШЕНО!")
    print("=" * 65)
    print("\n  💡 Данные для входа:")
    print("     Админ:     admin / admin123")
    print("     Препод:    teacher_ip / teacher123")
    print("     Студенты:  smirnov_ap / pass201 (и другие pass202–pass215)")
    print()


async def main():
    print("=" * 65)
    print("  🚀 МЕГА-НАПОЛНЕНИЕ САЙТА")
    print("=" * 65)

    from app.core.config import settings
    print(f"\n📡 База: {settings.database_url.split('@')[-1]}")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("\n✅ Таблицы проверены/созданы")
    except OSError as exc:
        print(
            "\n❌ Не удалось подключиться к PostgreSQL.\n"
            "   Скрипт запущен с хоста — нужен проброс порта Postgres из Docker.\n"
            "   dev:   docker compose -f infra/docker-compose.dev.yml --env-file .env up -d postgres\n"
            "          подключение: 127.0.0.1:5432 (по умолчанию)\n"
            "   pilot: SEED_POSTGRES_PORT=5433 python scripts/seed_all.py\n"
            "   Windows + Docker: надёжный вариант — запуск внутри контейнера:\n"
            "          .\\scripts\\seed_dev.ps1\n"
            "   Проверьте POSTGRES_* / DATABASE_URL в .env\n"
            f"   Ошибка: {exc}\n"
        )
        raise SystemExit(1) from exc

    async with AsyncSessionLocal() as session:
        async with session.begin():
            print("\n🧹 Дедупликация..."); await _dedupe_all_before_seed(session)
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
            print("🔄 Пересчёт командного КРК..."); await recalculate_all_team_ratings(session, teams)
            print("📈 Логи командных рейтингов..."); await create_team_rating_logs(session, team_ratings, teams)
            print("🔥 Активности..."); await create_activities(session, users, teams)
            print("📈 Логи активности..."); await create_team_activity_logs(session, teams)
            print("📨 Заявки на вступление..."); await create_join_requests(session, users, teams)
            print("🔗 Пригласительные ссылки..."); await create_invite_links(session, teams)
            print("⚙️ Настройки лиг..."); await create_league_settings(session)
            print("📦 Архивы рейтингов..."); await create_archives(session, users, teams)
            print("🗳️ Голосование..."); await create_vote_rounds(session, teams)

            print("🏅 Достижения...")
            await create_achievements(session, users)
            await create_team_achievements(session, teams)

        await session.commit()
        print("\n💾 Все данные сохранены")

        await print_summary(session)


if __name__ == "__main__":
    asyncio.run(main())