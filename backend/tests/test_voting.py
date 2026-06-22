import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from datetime import datetime, timedelta, timezone

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User, Student, UserRole
from app.models.team import Team, TeamMember
from app.models.rating import UserRating
from app.models.voting import VoteBallot, VoteRound
from app.modules.voting.logic import VotingService


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
    session.add(UserRating(user_id=user.id, base_score=50.0, unity_score=30.0, bonus_score=10.0, total_krk=50.0))
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
async def test_open_round_accepts_timezone_aware_closes_at(db_session):
    captain = await _create_user(db_session, "cap_tz")
    team = await _create_team(db_session, "TzTeam", captain, [])

    service = VotingService(db_session)
    aware = datetime.now(timezone.utc) + timedelta(days=7)
    round_obj = await service.open_round(team.id, "Цикл TZ", aware)

    assert round_obj.closes_at.tzinfo is None
    assert round_obj.is_open is True


@pytest.mark.asyncio
async def test_voting_updates_unity_score(db_session):
    captain = await _create_user(db_session, "cap")
    member = await _create_user(db_session, "mem")
    team = await _create_team(db_session, "Voters", captain, [member])

    service = VotingService(db_session)
    closes_at = datetime.utcnow() + timedelta(days=7)
    round_obj = await service.open_round(team.id, "Цикл 1", closes_at)

    await service.submit_ballots(
        round_obj.id,
        captain.id,
        [
            {"target_user_id": member.id, "score": 5},
        ],
    )

    updated = await service.close_round(round_obj.id)
    assert updated == 1

    result = await db_session.execute(
        select(UserRating).where(UserRating.user_id == member.id)
    )
    rating = result.scalar_one()
    assert rating.unity_score == 100.0


@pytest.mark.asyncio
async def test_ballots_do_not_expose_voter_in_model(db_session):
    captain = await _create_user(db_session, "cap2")
    member = await _create_user(db_session, "mem2")
    team = await _create_team(db_session, "Voters2", captain, [member])

    service = VotingService(db_session)
    round_obj = await service.open_round(
        team.id, "Цикл 2", datetime.utcnow() + timedelta(days=3),
    )
    await service.submit_ballots(
        round_obj.id,
        captain.id,
        [{"target_user_id": member.id, "score": 4}],
    )

    ballots = (await db_session.execute(select(VoteBallot))).scalars().all()
    assert len(ballots) == 1
    assert ballots[0].voter_user_id == captain.id
    assert ballots[0].target_user_id == member.id


@pytest.mark.asyncio
async def test_duplicate_submit_rejected(db_session):
    captain = await _create_user(db_session, "cap3")
    member = await _create_user(db_session, "mem3")
    team = await _create_team(db_session, "Voters3", captain, [member])

    service = VotingService(db_session)
    round_obj = await service.open_round(
        team.id, "Цикл 3", datetime.utcnow() + timedelta(days=3),
    )
    ballots = [{"target_user_id": member.id, "score": 3}]
    await service.submit_ballots(round_obj.id, captain.id, ballots)

    with pytest.raises(Exception):
        await service.submit_ballots(round_obj.id, captain.id, ballots)


@pytest_asyncio.fixture
async def voting_client():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session = AsyncSession(engine, expire_on_commit=False)

    student = Student(surname="Teach", name="Er", patronymic="T")
    session.add(student)
    await session.flush()

    teacher = User(
        username="teacher_test",
        student_id=student.id,
        password_hash=get_password_hash("teacher123"),
        role=UserRole.TEACHER.value,
    )
    session.add(teacher)

    cap_student = Student(surname="Cap", name="Tain", patronymic="T")
    session.add(cap_student)
    await session.flush()

    captain = User(
        username="team_cap",
        student_id=cap_student.id,
        password_hash=get_password_hash("pass123"),
        role=UserRole.CAPTAIN.value,
    )
    session.add(captain)
    await session.flush()

    team = Team(name="VotersTeam", captain_id=captain.id)
    session.add(team)
    await session.flush()
    session.add(TeamMember(user_id=captain.id, team_id=team.id))
    session.add(UserRating(user_id=captain.id, total_krk=50.0, unity_score=30.0, bonus_score=10.0))

    closes_at = datetime.utcnow() + timedelta(days=7)
    session.add(VoteRound(
        team_id=team.id,
        cycle_label="Цикл 1",
        is_open=True,
        closes_at=closes_at,
    ))
    await session.commit()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, team

    app.dependency_overrides.clear()
    await session.close()
    await engine.dispose()


@pytest.mark.asyncio
async def test_teacher_can_get_active_round_without_membership(voting_client):
    client, team = voting_client

    login = await client.post("/auth/login", json={
        "username": "teacher_test",
        "password": "teacher123",
    })
    assert login.status_code == 200
    token = login.json()["access_token"]

    response = await client.get(
        f"/voting/active?teamId={team.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["team_id"] == team.id
    assert data["cycle_label"] == "Цикл 1"
    assert data["is_open"] is True
