"""Демо-данные: пользователи и команды для DEMO_MODE."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.models.team import Team, TeamMember
from app.models.user import Student, User, UserRole

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

USERS_DATA = [
    {
        "student_id": 201,
        "surname": "Смирнов",
        "name": "Алексей",
        "patronymic": "Петрович",
        "username": "smirnov_ap",
        "password": "pass201",
        "role": UserRole.CAPTAIN.value,
    },
    {
        "student_id": 202,
        "surname": "Кузнецов",
        "name": "Дмитрий",
        "patronymic": "Сергеевич",
        "username": "kuznetsov_ds",
        "password": "pass202",
        "role": UserRole.STUDENT.value,
    },
    {
        "student_id": 203,
        "surname": "Попов",
        "name": "Максим",
        "patronymic": "Андреевич",
        "username": "popov_ma",
        "password": "pass203",
        "role": UserRole.CAPTAIN.value,
    },
    {
        "student_id": 204,
        "surname": "Васильев",
        "name": "Николай",
        "patronymic": "Игоревич",
        "username": "vasiliev_ni",
        "password": "pass204",
        "role": UserRole.STUDENT.value,
    },
    {
        "student_id": 205,
        "surname": "Петров",
        "name": "Сергей",
        "patronymic": "Владимирович",
        "username": "petrov_sv",
        "password": "pass205",
        "role": UserRole.STUDENT.value,
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
        return user

    await _ensure_student(session, data)
    user = User(
        student_id=data["student_id"],
        username=data["username"],
        password_hash=get_password_hash(data["password"]),
        role=data["role"],
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


async def _create_teams(session: AsyncSession, users: list[User]) -> None:
    for team_data in TEAMS_DATA:
        result = await session.execute(select(Team).where(Team.name == team_data["name"]))
        if result.scalar_one_or_none():
            continue

        captain = users[team_data["captain_index"]]
        team = Team(
            name=team_data["name"],
            description=team_data["description"],
            captain_id=captain.id,
        )
        session.add(team)
        await session.flush()
        print(f"Демо-команда создана: {team.name} (капитан: @{captain.username})")

        for idx in team_data["member_indices"]:
            member_user = users[idx]
            result = await session.execute(
                select(TeamMember).where(TeamMember.user_id == member_user.id)
            )
            if result.scalar_one_or_none():
                continue

            session.add(TeamMember(user_id=member_user.id, team_id=team.id))


async def seed_demo_data(session: AsyncSession) -> None:
    """Создаёт демо-пользователей и команды, если их ещё нет."""
    for data in LEGACY_DEMO_USERS:
        student = await _ensure_student(session, data)
        if data.get("username"):
            await _ensure_user(session, data)
        elif student:
            print(f"Демо-студент без аккаунта: id={data['student_id']} ({data['surname']} {data['name']})")

    extra_users = await _create_users(session, USERS_DATA)
    if extra_users:
        await _create_teams(session, extra_users)
