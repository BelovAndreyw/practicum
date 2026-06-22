import pytest
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.main import app
from app.core.database import get_db, Base
from app.core.security import get_password_hash
from app.models.user import User, Student, UserRole
from app.models.team import Team, TeamMember
from app.models.activity import Challenge, TeamChallenge
from app.models.reports import TeamReport, ReportFile
from app.models.rating import UserRating, TeamRating
from app.modules.challenges.logic import (
    create_challenge_logic,
    complete_challenge_logic,
    get_completed_team_ids_by_challenge,
)
from app.modules.reports.logic import create_report_logic, approve_report_logic

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


@pytest.fixture
async def team_setup(db_session):
    student = Student(surname="Test", name="User", patronymic="T")
    db_session.add(student)
    await db_session.flush()

    captain = User(
        username="captain1",
        student_id=student.id,
        password_hash=get_password_hash("captain123"),
        role=UserRole.CAPTAIN.value,
    )
    member_student = Student(surname="Mem", name="Ber", patronymic="M")
    db_session.add(member_student)
    await db_session.flush()

    member = User(
        username="member1",
        student_id=member_student.id,
        password_hash=get_password_hash("member123"),
        role=UserRole.STUDENT.value,
    )
    db_session.add_all([captain, member])
    await db_session.flush()

    team = Team(name="Alpha", captain_id=captain.id)
    db_session.add(team)
    await db_session.flush()

    db_session.add_all([
        TeamMember(user_id=captain.id, team_id=team.id),
        TeamMember(user_id=member.id, team_id=team.id),
    ])
    await db_session.commit()
    return {"team": team, "captain": captain, "member": member}


@pytest.mark.asyncio
async def test_report_submit_auto_enrolls(db_session, team_setup):
    challenge = await create_challenge_logic(
        title="SQL challenge",
        description="desc",
        reward_points=150,
        deadline=None,
        db=db_session,
    )
    team = team_setup["team"]
    captain = team_setup["captain"]

    report = await create_report_logic(
        team.id, captain.id, "Report", "Done", challenge.id, db_session
    )

    enrollment = (await db_session.execute(
        select(TeamChallenge).where(
            TeamChallenge.challenge_id == challenge.id,
            TeamChallenge.team_id == team.id,
        )
    )).scalar_one()
    assert enrollment.status == "active"
    assert report.challenge_id == challenge.id


@pytest.mark.asyncio
async def test_approve_report_completes_challenge_and_updates_krk(db_session, team_setup):
    challenge = await create_challenge_logic(
        title="API tests",
        description="desc",
        reward_points=150,
        deadline=None,
        db=db_session,
    )
    team = team_setup["team"]
    captain = team_setup["captain"]
    member = team_setup["member"]

    report = await create_report_logic(
        team.id, captain.id, "Report", "Done", challenge.id, db_session
    )
    db_session.add(ReportFile(
        report_id=report.id,
        filename="proof.png",
        file_path="/tmp/proof.png",
        file_size=100,
        content_type="image/png",
    ))
    await db_session.commit()

    approved = await approve_report_logic(report.id, db_session)
    assert approved.is_approved is True

    enrollment = (await db_session.execute(
        select(TeamChallenge).where(
            TeamChallenge.challenge_id == challenge.id,
            TeamChallenge.team_id == team.id,
        )
    )).scalar_one()
    assert enrollment.status == "completed"
    assert enrollment.completed_at is not None

    captain_rating = (await db_session.execute(
        select(UserRating).where(UserRating.user_id == captain.id)
    )).scalar_one()
    member_rating = (await db_session.execute(
        select(UserRating).where(UserRating.user_id == member.id)
    )).scalar_one()
    assert captain_rating.total_krk == pytest.approx(5.0)
    assert member_rating.total_krk == pytest.approx(5.0)

    completed_map = await get_completed_team_ids_by_challenge([challenge.id], db_session)
    assert completed_map[challenge.id] == [team.id]


@pytest.mark.asyncio
async def test_challenge_reward_increases_existing_total(db_session, team_setup):
    """Бонус за челлендж прибавляется к текущему КРК, а не пересчитывает его вниз."""
    captain = team_setup["captain"]
    team = team_setup["team"]

    for user in (team_setup["captain"], team_setup["member"]):
        db_session.add(UserRating(
            user_id=user.id,
            base_score=45.0,
            unity_score=12.0,
            bonus_score=8.0,
            penalty_score=0.0,
            total_krk=65.0,
        ))
    await db_session.commit()

    challenge = await create_challenge_logic(
        title="Bonus test",
        description=None,
        reward_points=150,
        deadline=None,
        db=db_session,
    )

    report = await create_report_logic(
        team.id, captain.id, "Report", "Done", challenge.id, db_session
    )
    db_session.add(ReportFile(
        report_id=report.id,
        filename="proof.png",
        file_path="/tmp/proof.png",
        file_size=100,
        content_type="image/png",
    ))
    await db_session.commit()

    await approve_report_logic(report.id, db_session)

    captain_rating = (await db_session.execute(
        select(UserRating).where(UserRating.user_id == captain.id)
    )).scalar_one()
    assert captain_rating.total_krk == pytest.approx(70.0)

    team_rating = (await db_session.execute(
        select(TeamRating).where(TeamRating.team_id == team.id)
    )).scalar_one()
    assert team_rating.average_krk == pytest.approx(70.0)


@pytest.mark.asyncio
async def test_complete_challenge_idempotent_error(db_session, team_setup):
    challenge = await create_challenge_logic(
        title="Once",
        description=None,
        reward_points=30,
        deadline=None,
        db=db_session,
    )
    team = team_setup["team"]

    await complete_challenge_logic(challenge.id, team.id, db_session)

    with pytest.raises(HTTPException) as exc:
        await complete_challenge_logic(challenge.id, team.id, db_session)
    assert exc.value.status_code == 400


@pytest.fixture
async def api_client(db_session, team_setup):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    teacher_student = Student(surname="Teach", name="Er", patronymic="A")
    db_session.add(teacher_student)
    await db_session.flush()
    teacher = User(
        username="teacher1",
        student_id=teacher_student.id,
        password_hash=get_password_hash("teacher123"),
        role=UserRole.TEACHER.value,
    )
    db_session.add(teacher)
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, team_setup, teacher

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_challenge_flow_via_api(api_client):
    client, setup, teacher = api_client
    captain = setup["captain"]

    teacher_login = await client.post("/auth/login", json={
        "username": "teacher1",
        "password": "teacher123",
    })
    assert teacher_login.status_code == 200
    teacher_token = teacher_login.json()["access_token"]

    captain_login = await client.post("/auth/login", json={
        "username": "captain1",
        "password": "captain123",
    })
    assert captain_login.status_code == 200
    captain_token = captain_login.json()["access_token"]

    create_resp = await client.post(
        "/challenges",
        json={
            "title": "E2E Challenge",
            "description": "API flow",
            "reward_points": 90,
        },
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert create_resp.status_code == 200
    challenge_id = create_resp.json()["id"]

    report_resp = await client.post(
        "/reports",
        data={
            "title": "E2E report",
            "description": "We did it",
            "challenge_id": str(challenge_id),
        },
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert report_resp.status_code == 200
    report_id = report_resp.json()["id"]

    files_resp = await client.post(
        f"/reports/{report_id}/files",
        files={"files": ("proof.txt", b"done", "text/plain")},
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert files_resp.status_code == 200

    my_resp = await client.get(
        "/challenges/my",
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert my_resp.status_code == 200
    my_item = my_resp.json()["challenges"][0]
    assert my_item["has_pending_report"] is True
    assert my_item["status"] == "active"

    pending_resp = await client.get(
        "/reports/pending",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert pending_resp.status_code == 200
    assert len(pending_resp.json()["reports"]) == 1
    file_id = pending_resp.json()["reports"][0]["files"][0]["id"]

    file_resp = await client.get(
        f"/reports/{report_id}/files/{file_id}",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert file_resp.status_code == 200
    assert file_resp.content == b"done"

    reject_resp = await client.post(
        f"/reports/{report_id}/reject",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert reject_resp.status_code == 200

    pending_after_reject = await client.get(
        "/reports/pending",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert pending_after_reject.status_code == 200
    assert len(pending_after_reject.json()["reports"]) == 0

    my_after_reject = await client.get(
        "/challenges/my",
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert my_after_reject.json()["challenges"][0]["has_pending_report"] is False

    report_resp_2 = await client.post(
        "/reports",
        data={
            "title": "E2E report retry",
            "description": "Second attempt",
            "challenge_id": str(challenge_id),
        },
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert report_resp_2.status_code == 200
    report_id_2 = report_resp_2.json()["id"]

    files_resp_2 = await client.post(
        f"/reports/{report_id_2}/files",
        files={"files": ("proof2.txt", b"done again", "text/plain")},
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert files_resp_2.status_code == 200

    approve_resp = await client.post(
        f"/reports/{report_id_2}/approve",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert approve_resp.status_code == 200

    list_resp = await client.get("/challenges")
    challenge = next(item for item in list_resp.json()["challenges"] if item["id"] == challenge_id)
    assert setup["team"].id in challenge["completed_team_ids"]

    my_after = await client.get(
        "/challenges/my",
        headers={"Authorization": f"Bearer {captain_token}"},
    )
    assert my_after.json()["challenges"][0]["status"] == "completed"
