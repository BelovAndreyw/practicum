import io

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.main import app
from app.core.database import Base, get_db
from app.models.user import Student, User, UserRole
from app.models.team import Team, TeamMember
from app.core.security import get_password_hash

TEST_DB = "sqlite+aiosqlite:///:memory:"

MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest_asyncio.fixture(scope="function")
async def client(tmp_path, monkeypatch):
  """Тестовый клиент с изолированной директорией загрузок."""
  monkeypatch.chdir(tmp_path)

  engine = create_async_engine(TEST_DB, echo=False)

  async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)

  test_session = AsyncSession(engine, expire_on_commit=False)

  await test_session.execute(text("DELETE FROM event_participants"))
  await test_session.execute(text("DELETE FROM event_invitations"))
  await test_session.execute(text("DELETE FROM team_events"))
  await test_session.execute(text("DELETE FROM team_members"))
  await test_session.execute(text("DELETE FROM teams"))
  await test_session.execute(text("DELETE FROM users"))
  await test_session.execute(text("DELETE FROM students"))
  await test_session.commit()

  student = Student(id=123, surname="Иванов", name="Иван", patronymic="Иванович")
  test_session.add(student)
  user = User(
    student_id=123,
    username="ivanov_captain",
    password_hash=get_password_hash("CaptainPass123!"),
    role=UserRole.CAPTAIN.value,
    avatar_url="https://example.com/old-avatar.png",
  )
  test_session.add(user)
  await test_session.flush()

  team = Team(name="Upload Team", captain_id=user.id)
  test_session.add(team)
  await test_session.flush()
  test_session.add(TeamMember(user_id=user.id, team_id=team.id))
  await test_session.commit()

  async def override_get_db():
    yield test_session

  app.dependency_overrides[get_db] = override_get_db

  transport = ASGITransport(app=app)
  async with AsyncClient(transport=transport, base_url="http://test") as ac:
    yield ac, user.id, team.id

  app.dependency_overrides.clear()
  await test_session.close()
  await engine.dispose()


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
  login = await client.post("/auth/login", json={
    "username": "ivanov_captain",
    "password": "CaptainPass123!",
  })
  assert login.status_code == 200
  token = login.json()["access_token"]
  return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_upload_avatar_returns_api_url(client):
  ac, user_id, _team_id = client
  headers = await _auth_headers(ac)

  upload = await ac.post(
    "/team/profile/avatar",
    files={"file": ("avatar.png", io.BytesIO(MINI_PNG), "image/png")},
    headers=headers,
  )
  assert upload.status_code == 200
  assert upload.json()["avatar_url"] == f"/team/users/{user_id}/avatar"

  image = await ac.get(f"/team/users/{user_id}/avatar")
  assert image.status_code == 200
  assert image.headers["content-type"].startswith("image/")


@pytest.mark.asyncio
async def test_uploaded_avatar_has_priority_over_external_url(client):
  ac, user_id, _team_id = client
  headers = await _auth_headers(ac)

  upload = await ac.post(
    "/team/profile/avatar",
    files={"file": ("avatar.png", io.BytesIO(MINI_PNG), "image/png")},
    headers=headers,
  )
  assert upload.status_code == 200
  assert upload.json()["avatar_url"] == f"/team/users/{user_id}/avatar"
  assert upload.json()["avatar_url"] != "https://example.com/old-avatar.png"


@pytest.mark.asyncio
async def test_delete_avatar(client):
  ac, user_id, _team_id = client
  headers = await _auth_headers(ac)

  await ac.post(
    "/team/profile/avatar",
    files={"file": ("avatar.png", io.BytesIO(MINI_PNG), "image/png")},
    headers=headers,
  )

  delete = await ac.delete("/team/profile/avatar", headers=headers)
  assert delete.status_code == 200
  assert delete.json()["avatar_url"] == "https://example.com/old-avatar.png"

  image = await ac.get(f"/team/users/{user_id}/avatar")
  assert image.status_code == 404


@pytest.mark.asyncio
async def test_reject_non_image_avatar(client):
  ac, _user_id, _team_id = client
  headers = await _auth_headers(ac)

  upload = await ac.post(
    "/team/profile/avatar",
    files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    headers=headers,
  )
  assert upload.status_code == 400


@pytest.mark.asyncio
async def test_upload_event_image(client):
  ac, user_id, team_id = client
  headers = await _auth_headers(ac)

  create = await ac.post("/events", json={
    "title": "Workshop",
    "description": "Test",
    "image_url": "https://example.com/cover.jpg",
    "format": "online",
    "location": "https://meet.example.com",
    "starts_at": "2026-12-01T10:00:00",
    "event_type": "workshop",
    "is_public": True,
  }, headers=headers)
  assert create.status_code == 200
  event_id = create.json()["id"]

  upload = await ac.post(
    f"/events/{event_id}/image",
    files={"file": ("cover.png", io.BytesIO(MINI_PNG), "image/png")},
    headers=headers,
  )
  assert upload.status_code == 200
  assert upload.json()["image_url"] == f"/events/{event_id}/image"

  image = await ac.get(f"/events/{event_id}/image")
  assert image.status_code == 200
  assert image.headers["content-type"].startswith("image/")


@pytest.mark.asyncio
async def test_delete_event_image(client):
  ac, _user_id, _team_id = client
  headers = await _auth_headers(ac)

  create = await ac.post("/events", json={
    "title": "Workshop",
    "format": "online",
    "location": "https://meet.example.com",
    "starts_at": "2026-12-01T10:00:00",
    "event_type": "workshop",
    "is_public": True,
    "image_url": "https://example.com/cover.jpg",
  }, headers=headers)
  event_id = create.json()["id"]

  await ac.post(
    f"/events/{event_id}/image",
    files={"file": ("cover.png", io.BytesIO(MINI_PNG), "image/png")},
    headers=headers,
  )

  delete = await ac.delete(f"/events/{event_id}/image", headers=headers)
  assert delete.status_code == 200
  assert delete.json()["image_url"] == "https://example.com/cover.jpg"

  image = await ac.get(f"/events/{event_id}/image")
  assert image.status_code == 404
