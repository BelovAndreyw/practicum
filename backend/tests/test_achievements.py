import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from datetime import date

from app.core.database import Base
from app.core.security import get_password_hash
from app.models.user import User, Student, UserRole
from app.models.team import Team, TeamMember
from app.models.achievement import UserAchievement
from app.models.activity import Activity
from app.models.reports import WeeklyCheckin
from app.modules.checkin.logic import create_checkin_logic
from app.modules.help.logic import (
    create_help_request_logic,
    respond_to_help_logic,
    accept_help_logic,
)
from app.modules.achievement.service import AchievementService


DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_session():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


async def _create_user(session: AsyncSession, username: str) -> User:
    student = Student(surname="Test", name=username, patronymic="T")
    session.add(student)
    await session.flush()
    user = User(
        username=username,
        student_id=student.id,
        password_hash=get_password_hash("pass123"),
        role=UserRole.STUDENT.value,
    )
    session.add(user)
    await session.flush()
    return user


async def _create_team(session: AsyncSession, name: str, captain: User, members: list[User]) -> Team:
    team = Team(name=name, captain_id=captain.id)
    session.add(team)
    await session.flush()
    session.add(TeamMember(user_id=captain.id, team_id=team.id))
    for member in members:
        session.add(TeamMember(user_id=member.id, team_id=team.id))
    await session.commit()
    return team


@pytest.mark.asyncio
async def test_first_checkin_unlocks_achievement(db_session):
    user = await _create_user(db_session, "student1")
    team = await _create_team(db_session, "Team", user, [])

    await create_checkin_logic(team.id, user.id, date.today(), "Week 1 report", db_session)

    result = await db_session.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user.id,
            UserAchievement.achievement_id == "ach_x1",
        )
    )
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_checkin_achievement_is_idempotent(db_session):
    user = await _create_user(db_session, "student2")
    team = await _create_team(db_session, "Team2", user, [])

    await create_checkin_logic(team.id, user.id, date.today(), "Week 1", db_session)
    await create_checkin_logic(team.id, user.id, date.today(), "Week 2", db_session)

    result = await db_session.execute(
        select(UserAchievement).where(UserAchievement.user_id == user.id)
    )
    achievements = result.scalars().all()
    assert len(achievements) == 1


@pytest.mark.asyncio
async def test_checkin_unlocks_achievement_even_with_prior_checkins(db_session):
    """Пользователь с уже существующими check-in (например, из seed) всё равно получает достижение."""
    user = await _create_user(db_session, "captain1")
    team = await _create_team(db_session, "TeamSeed", user, [])

    for week in range(3):
        checkin = WeeklyCheckin(
            team_id=team.id,
            week_start_date=date.today(),
            content=f"Week {week}",
            created_by=user.id,
            status="reviewed",
        )
        db_session.add(checkin)
    await db_session.commit()

    await create_checkin_logic(team.id, user.id, date.today(), "Week 4", db_session)

    result = await db_session.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user.id,
            UserAchievement.achievement_id == "ach_x1",
        )
    )
    assert result.scalar_one_or_none() is not None

@pytest.mark.asyncio
async def test_offering_unlocks_knowledge_achievement(db_session):
    user = await _create_user(db_session, "student3")
    team = await _create_team(db_session, "Team3", user, [])

    await create_help_request_logic(
        team.id, user.id, "Java tips", "Sharing notes",
        "offering", "both", None, db_session,
    )

    items = await AchievementService(db_session).get_user_achievements(user.id)
    assert any(a["id"] == "ach_x3" for a in items)


@pytest.mark.asyncio
async def test_rescue_unlocks_helper_achievement(db_session):
    requester = await _create_user(db_session, "req")
    helper = await _create_user(db_session, "help")
    team_a = await _create_team(db_session, "A", requester, [])
    team_b = await _create_team(db_session, "B", helper, [])

    request = await create_help_request_logic(
        team_a.id, requester.id, "Help", "Need", "receiving", "both", None, db_session,
    )
    response = await respond_to_help_logic(request.id, team_b.id, "OK", db_session)
    await accept_help_logic(request.id, response.id, requester.id, db_session)

    result = await db_session.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == helper.id,
            UserAchievement.achievement_id == "ach_x2",
        )
    )
    assert result.scalar_one_or_none() is not None

    activity_result = await db_session.execute(
        select(Activity).where(Activity.event_type == "achievement_unlocked")
    )
    assert activity_result.scalars().first() is not None
