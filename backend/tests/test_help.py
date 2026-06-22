import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.database import Base
from app.core.security import get_password_hash
from app.models.user import User, Student, UserRole
from app.models.team import Team, TeamMember
from app.models.reports import HelpRequest
from app.models.rating import UserRating, TeamRating
from app.modules.help.logic import (
    create_help_request_logic,
    respond_to_help_logic,
    accept_help_logic,
    serialize_help_request_list,
    RESCUE_BONUS_POINTS,
)
from app.modules.challenges.logic import CHALLENGE_KRK_DIVISOR


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
async def test_accept_help_awards_krk_to_both_teams(db_session):
    requester_captain = await _create_user(db_session, "req_cap")
    requester_member = await _create_user(db_session, "req_mem")
    helper_captain = await _create_user(db_session, "help_cap")
    helper_member = await _create_user(db_session, "help_mem")

    team_a = await _create_team(db_session, "Alpha", requester_captain, [requester_member])
    team_b = await _create_team(db_session, "Beta", helper_captain, [helper_member])

    for user in (requester_captain, requester_member, helper_captain, helper_member):
        db_session.add(UserRating(user_id=user.id, total_krk=50.0, bonus_score=10.0))
    await db_session.commit()

    request = await create_help_request_logic(
        team_a.id,
        requester_captain.id,
        "Java generics",
        "Need help",
        "receiving",
        "both",
        None,
        db_session,
    )
    response = await respond_to_help_logic(request.id, team_b.id, "Ready", db_session)

    await accept_help_logic(request.id, response.id, requester_captain.id, db_session)

    expected_gain = round(RESCUE_BONUS_POINTS / CHALLENGE_KRK_DIVISOR, 2)

    for user in (requester_captain, requester_member, helper_captain, helper_member):
        result = await db_session.execute(
            select(UserRating).where(UserRating.user_id == user.id)
        )
        rating = result.scalar_one()
        assert rating.total_krk == pytest.approx(50.0 + expected_gain)
        assert rating.bonus_score > 10.0

    for team_id in (team_a.id, team_b.id):
        result = await db_session.execute(
            select(TeamRating).where(TeamRating.team_id == team_id)
        )
        team_rating = result.scalar_one()
        assert team_rating.average_krk == pytest.approx(50.0 + expected_gain)

    refreshed = await db_session.get(HelpRequest, request.id)
    assert refreshed.status == "fulfilled"


@pytest.mark.asyncio
async def test_help_list_includes_helper_team_name(db_session):
    requester_captain = await _create_user(db_session, "list_req")
    helper_captain = await _create_user(db_session, "list_help")

    team_a = await _create_team(db_session, "Alpha", requester_captain, [])
    team_b = await _create_team(db_session, "Beta", helper_captain, [])

    request = await create_help_request_logic(
        team_a.id,
        requester_captain.id,
        "Docker help",
        "Container issue",
        "receiving",
        "both",
        None,
        db_session,
    )
    await respond_to_help_logic(request.id, team_b.id, "Ready to help", db_session)

    from app.modules.help.logic import get_help_requests_logic

    requests, _ = await get_help_requests_logic(help_type="receiving", db=db_session)
    serialized = await serialize_help_request_list(requests, db_session)

    target = next(item for item in serialized if item["id"] == request.id)
    assert target["requesting_team_name"] == "Alpha"
    assert target["helper_team_id"] == team_b.id
    assert target["helper_team_name"] == "Beta"
