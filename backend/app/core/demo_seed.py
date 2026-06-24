"""Демо-данные для DEMO_MODE: пользователи, команды, рейтинги, достижения,
события, челленджи, биржа знаний и check-in'ы.

Цель — связный набор данных «как в проде», чтобы фронт работал на реальной БД,
а не на мок-данных. Время у событий/достижений/активностей РАЗНОЕ.
"""
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.models.team import Team, TeamMember
from app.models.user import Student, User, UserRole
from app.models.rating import UserRating, LeagueSettings
from app.models.achievement import UserAchievement
from app.models.activity import Activity, Challenge
from app.models.reports import TeamEvent, WeeklyCheckin, HelpRequest
from app.modules.rating.team_logic import TeamRatingService

# Опорная точка отсчёта времени для демо (фиксируем "сейчас")
NOW = datetime.utcnow()


def _league_for(krk: float) -> str:
    """Новичок < 60, Профи 60-85, Легенда >= 85."""
    if krk >= 85:
        return "legend"
    if krk >= 60:
        return "pro"
    return "newbie"


LEAGUE_SETTINGS = [
    {"tier": "newbie", "min_score": 0.0, "max_score": 60.0},
    {"tier": "pro", "min_score": 60.0, "max_score": 85.0},
    {"tier": "legend", "min_score": 85.0, "max_score": None},
]

LEGACY_DEMO_USERS = [
    {
        "student_id": 124,
        "surname": "Петров",
        "name": "Пётр",
        "patronymic": "Петрович",
        "username": None,
        "password": None,
        "role": None,
    },
]

# КРК подобран так, чтобы Альфа = (88.4 + 83.0) / 2 = 85.7 -> Легенда
USERS_DATA = [
    {
        "student_id": 201, "surname": "Смирнов", "name": "Алексей", "patronymic": "Петрович",
        "username": "smirnov_ap", "password": "pass201", "role": UserRole.CAPTAIN.value,
        "email": "smirnov.ap@urfu.me", "phone": "+7 912 345-67-01", "krk": 88.4,
    },
    {
        "student_id": 202, "surname": "Кузнецов", "name": "Дмитрий", "patronymic": "Сергеевич",
        "username": "kuznetsov_ds", "password": "pass202", "role": UserRole.STUDENT.value,
        "email": "kuznetsov.ds@urfu.me", "phone": "+7 912 345-67-02", "krk": 83.0,
    },
    {
        "student_id": 203, "surname": "Попов", "name": "Максим", "patronymic": "Андреевич",
        "username": "popov_ma", "password": "pass203", "role": UserRole.CAPTAIN.value,
        "email": "popov.ma@urfu.me", "phone": "+7 912 345-67-03", "krk": 72.5,
    },
    {
        "student_id": 204, "surname": "Васильев", "name": "Николай", "patronymic": "Игоревич",
        "username": "vasiliev_ni", "password": "pass204", "role": UserRole.STUDENT.value,
        "email": "vasiliev.ni@urfu.me", "phone": "+7 912 345-67-04", "krk": 67.5,
    },
    {
        "student_id": 205, "surname": "Петров", "name": "Сергей", "patronymic": "Владимирович",
        "username": "petrov_sv", "password": "pass205", "role": UserRole.CAPTAIN.value,
        "email": "petrov.sv@urfu.me", "phone": "+7 912 345-67-05", "krk": 45.0,
    },
    {
        "student_id": 206, "surname": "Соколова", "name": "Анна", "patronymic": "Дмитриевна",
        "username": "sokolova_ad", "password": "pass206", "role": UserRole.STUDENT.value,
        "email": "sokolova.ad@urfu.me", "phone": "+7 912 345-67-06", "krk": 39.0,
    },
    {
        "student_id": 207, "surname": "Орлова", "name": "Мария", "patronymic": "Викторовна",
        "username": "orlova_mv", "password": "pass207", "role": UserRole.TEACHER.value,
        "email": "orlova.mv@urfu.me", "phone": "+7 912 345-67-07", "krk": 0.0,
    },
]

TEAMS_DATA = [
    {
        "name": "Альфа",
        "description": "Команда Альфа — разработка веб-приложений",
        "captain_index": 0,
        "member_indices": [0, 1],
    },
    {
        "name": "Бета",
        "description": "Команда Бета — DevOps и инфраструктура",
        "captain_index": 2,
        "member_indices": [2, 3],
    },
    {
        "name": "Гамма",
        "description": "Команда Гамма — аналитика данных",
        "captain_index": 4,
        "member_indices": [4, 5],
    },
]

# Достижения с РАЗНЫМИ датами: ключ — student_id, значение — список (achievement_id, дельта времени назад)
ACHIEVEMENTS_BY_STUDENT = {
    201: [
        ("ach_x1", timedelta(days=21, hours=3)),
        ("ach_notes", timedelta(days=14, hours=6)),
        ("ach_workshop", timedelta(days=5, hours=2)),
    ],
    202: [
        ("ach_x1", timedelta(days=20, hours=1)),
        ("ach_first_aid", timedelta(days=9, hours=4)),
    ],
    203: [
        ("ach_x1", timedelta(days=18, hours=2)),
        ("ach_checklist", timedelta(days=8, hours=7)),
        ("ach_team_player", timedelta(days=2, hours=5)),
    ],
    204: [
        ("ach_streak", timedelta(days=6, hours=3)),
    ],
    205: [
        ("ach_x1", timedelta(days=12, hours=8)),
        ("ach_x3", timedelta(days=4, hours=1)),
    ],
    206: [
        ("ach_notes", timedelta(days=3, hours=6)),
    ],
}

# Командные достижения (одна запись в ленту на команду): имя команды -> [(achievement_id, delta)]
TEAM_ACHIEVEMENTS = {
    "Альфа": [("ach_x2", timedelta(days=7, hours=2))],
    "Бета": [("ach_first_aid", timedelta(days=10, hours=5))],
}

ACHIEVEMENT_META = {
    "ach_x1": ("Первый check-in", "Отправлен первый еженедельный отчёт", "✅"),
    "ach_x2": ("Спаситель", "Помогли другой команде в спасении", "🆘"),
    "ach_x3": ("Знаток биржи", "Разместили предложение на бирже знаний", "💡"),
    "ach_notes": ("Создание лучших конспектов", "Конспекты признаны лучшими в потоке", "📝"),
    "ach_first_aid": ("Первая помощь", "Первыми откликнулись на запрос о помощи", "🚑"),
    "ach_workshop": ("Мастер воркшопов", "Провели совместный воркшоп", "🎤"),
    "ach_checklist": ("Чек-лист мастер", "Создали полезный чек-лист по теме", "✔️"),
    "ach_streak": ("На волне", "Три еженедельных check-in подряд", "🔥"),
    "ach_team_player": ("Командный игрок", "Активное участие в жизни команды", "🤝"),
}

# Картинки (Unsplash) для красивых карточек событий
EVENTS_DATA = [
    {
        "team": "Альфа", "creator_index": 0,
        "title": "Воркшоп: чистый код на практике",
        "description": (
            "Большой практический воркшоп по чистому коду. Разберём принципы SOLID на живых примерах, "
            "проведём ревью реального кода участников и соберём чек-лист хороших практик.\n\n"
            "В программе: рефакторинг легаси-модуля, парное программирование, "
            "разбор типичных ошибок и Q&A с менторами. Возьмите ноутбук — будем кодить вместе!"
        ),
        "image_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
        "format": "offline", "location": "Аудитория ГУК-301",
        "starts_in": timedelta(days=2, hours=4), "duration_h": 3,
    },
    {
        "team": "Альфа", "creator_index": 0,
        "title": "Онлайн-митап: React и производительность",
        "description": (
            "Говорим о реальной оптимизации React-приложений: мемоизация, виртуализация списков, "
            "ленивые загрузки и профилирование. Покажем до/после на метриках и ответим на вопросы.\n\n"
            "Будет запись, но живое участие даст возможность задать свой вопрос спикеру."
        ),
        "image_url": "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&q=80",
        "format": "online", "location": "https://meet.urfu.me/react-perf",
        "starts_in": timedelta(days=5, hours=2), "duration_h": 2,
    },
    {
        "team": "Бета", "creator_index": 2,
        "title": "DevOps-интенсив: CI/CD с нуля",
        "description": (
            "Интенсив по построению пайплайна: от Dockerfile до автодеплоя. Настроим GitHub Actions, "
            "healthcheck'и и секреты, разберём типичные провалы сборки.\n\n"
            "Практика на учебном репозитории — к концу встречи у каждого будет рабочий пайплайн."
        ),
        "image_url": "https://images.unsplash.com/photo-1605379399642-870262d3d051?w=1200&q=80",
        "format": "offline", "location": "Коворкинг ИРИТ-РТФ",
        "starts_in": timedelta(days=3, hours=6), "duration_h": 4,
    },
    {
        "team": "Бета", "creator_index": 3,
        "title": "Воркшоп по инфраструктуре как код",
        "description": (
            "Разбираем Terraform и идемпотентность инфраструктуры. Поднимем окружение, "
            "сломаем и восстановим его, обсудим best practices хранения состояния.\n\n"
            "Уровень — средний, желательно базовое знание Docker."
        ),
        "image_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80",
        "format": "online", "location": "https://meet.urfu.me/iac",
        "starts_in": timedelta(days=8, hours=1), "duration_h": 2,
    },
    {
        "team": "Гамма", "creator_index": 4,
        "title": "Дата-сторителлинг: как показывать цифры",
        "description": (
            "Учимся превращать таблицы в понятные истории. Принципы визуализации, выбор графиков, "
            "ошибки восприятия и как их избегать.\n\n"
            "Принесите свой датасет — соберём по нему дашборд вместе."
        ),
        "image_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
        "format": "offline", "location": "Аудитория ГУК-415",
        "starts_in": timedelta(days=6, hours=5), "duration_h": 3,
    },
    {
        "team": "Гамма", "creator_index": 5,
        "title": "Python для анализа данных: pandas hands-on",
        "description": (
            "Практика по pandas: загрузка, очистка, агрегации и джойны. Решаем реальные кейсы "
            "по шагам, обсуждаем производительность на больших данных.\n\n"
            "Формат — повторяй за спикером, все ноутбуки выдаём заранее."
        ),
        "image_url": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=1200&q=80",
        "format": "online", "location": "https://meet.urfu.me/pandas",
        "starts_in": timedelta(days=9, hours=3), "duration_h": 2,
    },
    {
        "team": "Альфа", "creator_index": 6,
        "title": "Большая встреча потока: демо-день команд",
        "description": (
            "Главное событие месяца! Каждая команда показывает результаты, обменивается опытом и "
            "получает обратную связь от организаторов и других команд.\n\n"
            "После демо — нетворкинг и награждение лучших команд потока. Приходите болеть за своих!"
        ),
        "image_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80",
        "format": "offline", "location": "Актовый зал УрФУ",
        "starts_in": timedelta(days=12, hours=2), "duration_h": 5,
    },
]

CHALLENGES_DATA = [
    {
        "title": "Провести совместный воркшоп",
        "description": "Организуйте и проведите воркшоп для участников другой команды. Поделитесь экспертизой!",
        "reward_points": 150,
        "deadline_in": timedelta(days=14),
    },
    {
        "title": "Создать чек-лист по теме",
        "description": "Соберите практический чек-лист по своей теме и опубликуйте его для потока.",
        "reward_points": 90,
        "deadline_in": timedelta(days=10),
    },
    {
        "title": "Помочь другой команде",
        "description": "Откликнитесь на запрос о помощи на бирже знаний и доведите задачу до результата.",
        "reward_points": 120,
        "deadline_in": timedelta(days=21),
    },
]

# Биржа знаний / помощь: help_type "offering" — предложения, "receiving" — запросы
HELP_DATA = [
    {
        "team": "Альфа", "title": "Поможем с настройкой ESLint и Prettier",
        "description": "Готовы помочь настроить линтеры и форматирование в вашем фронтенд-проекте.",
        "help_type": "offering", "created_in": timedelta(days=2, hours=3),
    },
    {
        "team": "Бета", "title": "Расскажем про Docker Compose",
        "description": "Делимся опытом по контейнеризации: сети, тома, healthcheck'и.",
        "help_type": "offering", "created_in": timedelta(days=1, hours=8),
    },
    {
        "team": "Гамма", "title": "Нужна помощь с SQL-оптимизацией",
        "description": "Запросы к отчётам тормозят. Нужен совет по индексам и планам выполнения.",
        "help_type": "receiving", "created_in": timedelta(days=1, hours=2),
    },
    {
        "team": "Гамма", "title": "Ищем ревьюера для дашборда",
        "description": "Хотим свежий взгляд на визуализацию метрик перед демо-днём.",
        "help_type": "receiving", "created_in": timedelta(hours=20),
    },
]

CHECKINS_DATA = [
    {
        "team": "Альфа", "creator_index": 0,
        "content": "Закрыли спринт по аутентификации, провели код-ревью.",
        "achievements": "Завершили челлендж по чистому коду, оформили лучшие конспекты.",
        "blockers": "Нужен доступ к стейджингу.",
        "created_in": timedelta(days=14, hours=2),
    },
    {
        "team": "Альфа", "creator_index": 1,
        "content": "Подготовили воркшоп, собрали материалы.",
        "achievements": "Помогли команде Бета с фронтендом.",
        "blockers": "",
        "created_in": timedelta(days=7, hours=5),
    },
    {
        "team": "Бета", "creator_index": 2,
        "content": "Настроили CI/CD пайплайн, добавили healthcheck'и.",
        "achievements": "Первая помощь другой команде по Docker.",
        "blockers": "Флаки-тесты в пайплайне.",
        "created_in": timedelta(days=9, hours=4),
    },
    {
        "team": "Гамма", "creator_index": 4,
        "content": "Собрали первый дашборд по продажам.",
        "achievements": "Создали чек-лист по визуализации.",
        "blockers": "Медленные SQL-запросы.",
        "created_in": timedelta(days=3, hours=6),
    },
]


async def _ensure_student(session: AsyncSession, data: dict) -> Student:
    result = await session.execute(select(Student).where(Student.id == data["student_id"]))
    student = result.scalar_one_or_none()
    if student:
        return student

    student = Student(
        id=data["student_id"],
        surname=data["surname"],
        name=data["name"],
        patronymic=data["patronymic"],
    )
    session.add(student)
    await session.flush()
    return student


async def _ensure_user(session: AsyncSession, data: dict) -> User | None:
    if not data.get("username"):
        return None

    result = await session.execute(
        select(User)
        .where(User.student_id == data["student_id"])
        .options(selectinload(User.student))
    )
    user = result.scalar_one_or_none()
    if user:
        if data.get("email"):
            user.email = data["email"]
        if data.get("phone"):
            user.phone = data["phone"]
        return user

    await _ensure_student(session, data)
    user = User(
        student_id=data["student_id"],
        username=data["username"],
        password_hash=get_password_hash(data["password"]),
        role=data["role"],
        email=data.get("email"),
        phone=data.get("phone"),
    )
    session.add(user)
    await session.flush()
    await session.refresh(user, ["student"])
    print(
        f"Демо-пользователь создан: @{data['username']} "
        f"({data['surname']} {data['name']}), пароль: {data['password']}"
    )
    return user


async def _create_users(session: AsyncSession, users_data: list[dict]) -> list[User]:
    users: list[User] = []
    for data in users_data:
        user = await _ensure_user(session, data)
        if user:
            users.append(user)
    return users


async def _ensure_user_rating(session: AsyncSession, user_id: int, krk: float) -> None:
    existing = await session.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        return
    rating = UserRating(
        user_id=user_id,
        base_score=krk,
        unity_score=krk,
        bonus_score=krk,
        penalty_score=0.0,
        total_krk=krk,
        league=_league_for(krk),
    )
    session.add(rating)
    await session.flush()


async def _create_teams(session: AsyncSession, users: list[User]) -> dict[str, Team]:
    teams_by_name: dict[str, Team] = {}
    for team_data in TEAMS_DATA:
        result = await session.execute(select(Team).where(Team.name == team_data["name"]))
        existing = result.scalar_one_or_none()
        if existing:
            teams_by_name[team_data["name"]] = existing
            continue

        captain = users[team_data["captain_index"]]
        team = Team(
            name=team_data["name"],
            description=team_data["description"],
            captain_id=captain.id,
        )
        session.add(team)
        await session.flush()
        teams_by_name[team.name] = team
        print(f"Демо-команда создана: {team.name} (капитан: @{captain.username})")

        for idx in team_data["member_indices"]:
            member_user = users[idx]
            result = await session.execute(
                select(TeamMember).where(TeamMember.user_id == member_user.id)
            )
            if result.scalar_one_or_none():
                continue
            session.add(TeamMember(user_id=member_user.id, team_id=team.id))
        await session.flush()

    return teams_by_name


async def _seed_league_settings(session: AsyncSession) -> None:
    for cfg in LEAGUE_SETTINGS:
        result = await session.execute(
            select(LeagueSettings).where(LeagueSettings.tier == cfg["tier"])
        )
        found = result.scalar_one_or_none()
        if found:
            found.min_score = cfg["min_score"]
            found.max_score = cfg["max_score"]
            found.is_active = True
            continue
        session.add(LeagueSettings(
            tier=cfg["tier"],
            min_score=cfg["min_score"],
            max_score=cfg["max_score"],
            is_active=True,
        ))
    await session.flush()


async def _seed_achievements(session: AsyncSession, users_by_student: dict[int, User]) -> None:
    existing = await session.execute(select(func.count()).select_from(UserAchievement))
    if (existing.scalar() or 0) > 0:
        return

    for student_id, items in ACHIEVEMENTS_BY_STUDENT.items():
        user = users_by_student.get(student_id)
        if not user:
            continue
        membership = await session.execute(
            select(TeamMember).where(TeamMember.user_id == user.id)
        )
        membership = membership.scalar_one_or_none()
        for achievement_id, delta in items:
            unlocked_at = NOW - delta
            session.add(UserAchievement(
                user_id=user.id,
                achievement_id=achievement_id,
                unlocked_at=unlocked_at,
            ))
            meta = ACHIEVEMENT_META.get(achievement_id)
            if membership and meta:
                title, description, _icon = meta
                session.add(Activity(
                    team_id=membership.team_id,
                    user_id=user.id,
                    event_type="achievement_unlocked",
                    title=f"Достижение: {title}",
                    description=description,
                    event_metadata={"achievement_id": achievement_id},
                    created_at=unlocked_at,
                ))
    await session.flush()


async def _seed_team_achievements(session: AsyncSession, teams_by_name: dict[str, Team]) -> None:
    for team_name, items in TEAM_ACHIEVEMENTS.items():
        team = teams_by_name.get(team_name)
        if not team:
            continue
        members = await session.execute(
            select(TeamMember).where(TeamMember.team_id == team.id)
        )
        members = members.scalars().all()
        for achievement_id, delta in items:
            unlocked_at = NOW - delta
            for m in members:
                dup = await session.execute(
                    select(UserAchievement).where(
                        UserAchievement.user_id == m.user_id,
                        UserAchievement.achievement_id == achievement_id,
                    )
                )
                if dup.scalar_one_or_none():
                    continue
                session.add(UserAchievement(
                    user_id=m.user_id,
                    achievement_id=achievement_id,
                    unlocked_at=unlocked_at,
                ))
            meta = ACHIEVEMENT_META.get(achievement_id)
            if meta:
                title, description, _icon = meta
                dup_activity = await session.execute(
                    select(Activity).where(
                        Activity.team_id == team.id,
                        Activity.event_type == "achievement_unlocked",
                        Activity.title == f"Достижение: {title}",
                    )
                )
                if dup_activity.scalar_one_or_none():
                    continue
                # ОДНА запись в ленту на команду (без дублей вида «Спаситель ×5»)
                session.add(Activity(
                    team_id=team.id,
                    user_id=None,
                    event_type="achievement_unlocked",
                    title=f"Достижение: {title}",
                    description=description,
                    event_metadata={"achievement_id": achievement_id, "team_wide": True},
                    created_at=unlocked_at,
                ))
    await session.flush()


async def _seed_events(session: AsyncSession, users: list[User], teams_by_name: dict[str, Team]) -> None:
    existing = await session.execute(select(func.count()).select_from(TeamEvent))
    if (existing.scalar() or 0) > 0:
        return

    for cfg in EVENTS_DATA:
        team = teams_by_name.get(cfg["team"])
        if not team:
            continue
        creator = users[cfg["creator_index"]]
        starts_at = NOW + cfg["starts_in"]
        ends_at = starts_at + timedelta(hours=cfg["duration_h"])
        session.add(TeamEvent(
            team_id=team.id,
            title=cfg["title"],
            description=cfg["description"],
            image_url=cfg["image_url"],
            event_type="workshop",
            format=cfg["format"],
            location=cfg["location"],
            starts_at=starts_at,
            ends_at=ends_at,
            is_public=True,
            created_by=creator.id,
        ))
    await session.flush()


async def _seed_challenges(session: AsyncSession) -> None:
    existing = await session.execute(select(func.count()).select_from(Challenge))
    if (existing.scalar() or 0) > 0:
        return
    for cfg in CHALLENGES_DATA:
        session.add(Challenge(
            title=cfg["title"],
            description=cfg["description"],
            reward_points=cfg["reward_points"],
            deadline=NOW + cfg["deadline_in"],
            is_active=True,
        ))
    await session.flush()


async def _seed_help(session: AsyncSession, teams_by_name: dict[str, Team]) -> None:
    existing = await session.execute(select(func.count()).select_from(HelpRequest))
    if (existing.scalar() or 0) > 0:
        return
    for cfg in HELP_DATA:
        team = teams_by_name.get(cfg["team"])
        if not team:
            continue
        session.add(HelpRequest(
            requesting_team_id=team.id,
            title=cfg["title"],
            description=cfg["description"],
            help_type=cfg["help_type"],
            status="open",
            created_at=NOW - cfg["created_in"],
        ))
    await session.flush()


async def _seed_checkins(session: AsyncSession, users: list[User], teams_by_name: dict[str, Team]) -> None:
    existing = await session.execute(select(func.count()).select_from(WeeklyCheckin))
    if (existing.scalar() or 0) > 0:
        return
    for cfg in CHECKINS_DATA:
        team = teams_by_name.get(cfg["team"])
        if not team:
            continue
        creator = users[cfg["creator_index"]]
        created_at = NOW - cfg["created_in"]
        session.add(WeeklyCheckin(
            team_id=team.id,
            week_start_date=created_at,
            content=cfg["content"],
            achievements=cfg["achievements"] or None,
            blockers=cfg["blockers"] or None,
            created_by=creator.id,
            status="reviewed",
            created_at=created_at,
        ))
    await session.flush()


async def seed_demo_data(session: AsyncSession) -> None:
    """Создаёт связный демо-набор данных, если его ещё нет."""
    await _seed_league_settings(session)

    for data in LEGACY_DEMO_USERS:
        student = await _ensure_student(session, data)
        if data.get("username"):
            await _ensure_user(session, data)
        elif student:
            print(f"Демо-студент без аккаунта: id={data['student_id']} ({data['surname']} {data['name']})")

    users = await _create_users(session, USERS_DATA)
    if not users:
        return

    users_by_student = {u.student_id: u for u in users}

    # Рейтинги участников
    for data in USERS_DATA:
        user = users_by_student.get(data["student_id"])
        if user:
            await _ensure_user_rating(session, user.id, data["krk"])

    teams_by_name = await _create_teams(session, users)

    # Пересчёт командных рейтингов (среднее по участникам)
    team_service = TeamRatingService(session)
    for team in teams_by_name.values():
        await team_service.recalculate_team_rating(team.id)

    await _seed_achievements(session, users_by_student)
    await _seed_team_achievements(session, teams_by_name)
    await _seed_events(session, users, teams_by_name)
    await _seed_challenges(session)
    await _seed_help(session, teams_by_name)
    await _seed_checkins(session, users, teams_by_name)
