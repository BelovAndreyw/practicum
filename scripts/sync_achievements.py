"""Синхронизирует достижения для всех пользователей (retroactive unlock)."""
import asyncio
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

_here = Path(__file__).resolve().parent
_repo_root = _here.parent
for _candidate in (_here / "backend", _repo_root / "backend", _here, _repo_root):
    if (_candidate / "app").is_dir():
        sys.path.insert(0, str(_candidate))
        break


def _load_env_file() -> None:
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
    import os
    from urllib.parse import urlparse, urlunparse

    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    if os.path.exists("/.dockerenv"):
        return url
    parsed = urlparse(url)
    if parsed.hostname == "postgres":
        host = os.environ.get("SEED_POSTGRES_HOST", "127.0.0.1")
        port = int(os.environ.get("SEED_POSTGRES_PORT", os.environ.get("POSTGRES_PORT", "5432")))
        netloc = f"{parsed.username}:{parsed.password}@{host}:{port}"
        url = urlunparse(parsed._replace(netloc=netloc))
    return url


_load_env_file()
url = _database_url_for_host()
if url:
    import os
    os.environ["DATABASE_URL"] = url

# Регистрация всех ORM-моделей (как в seed_all.py)
from app.models.user import User  # noqa: E402
from app.models.team import Team  # noqa: E402
from app.models.rating import TeamRating, UserRating  # noqa: E402
from app.models.reports import WeeklyCheckin, HelpRequest  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.modules.achievement.service import AchievementService  # noqa: E402


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await AchievementService(session).sync_all_users()
        await session.commit()
    print("Achievement sync complete")


if __name__ == "__main__":
    asyncio.run(main())
