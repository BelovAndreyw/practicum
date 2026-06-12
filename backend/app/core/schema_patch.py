from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def apply_schema_patches(conn: AsyncConnection) -> None:
    """Добавляет колонки/правки схемы для уже существующих БД (create_all не делает ALTER)."""
    if conn.dialect.name != "postgresql":
        return

    await conn.execute(text(
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION NOT NULL DEFAULT 3.0"
    ))
