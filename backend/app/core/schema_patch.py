from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def apply_schema_patches(conn: AsyncConnection) -> None:
    """Правки схемы и данных для уже существующих БД (create_all не делает ALTER)."""
    if conn.dialect.name != "postgresql":
        return

    await conn.execute(text(
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION NOT NULL DEFAULT 3.0"
    ))
    await conn.execute(text(
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"
    ))
    await conn.execute(text(
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT"
    ))

    await conn.execute(text(
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"
    ))
    await conn.execute(text(
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"
    ))
    await conn.execute(text(
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS team_id INTEGER"
    ))

    await conn.execute(text(
        "ALTER TABLE report_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW()"
    ))

    # Профиль: контакты и аватар на аккаунте
    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR"))
    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR"))
    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT"))

    # События: картинка
    await conn.execute(text("ALTER TABLE team_events ADD COLUMN IF NOT EXISTS image_url TEXT"))

    # Check-in: достижения и блокеры
    await conn.execute(text("ALTER TABLE weekly_checkins ADD COLUMN IF NOT EXISTS achievements TEXT"))
    await conn.execute(text("ALTER TABLE weekly_checkins ADD COLUMN IF NOT EXISTS blockers TEXT"))

    # Удалить «висячие» записи участников без команды
    await conn.execute(text("""
        DELETE FROM team_members tm
        WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = tm.team_id)
    """))

    # Капитан без строки в team_members (после сбойных create)
    await conn.execute(text("""
        INSERT INTO team_members (user_id, team_id, joined_at)
        SELECT t.captain_id, t.id, COALESCE(t.created_at, NOW())
        FROM teams t
        WHERE t.captain_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM team_members tm WHERE tm.user_id = t.captain_id
          )
    """))
