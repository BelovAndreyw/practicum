"""Проверки доступа к данным команды."""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import TeamMember
from app.models.user import User


def is_staff(user: User) -> bool:
    return user.role in ("admin", "teacher")


async def user_has_team_access(user: User, team_id: int, db: AsyncSession) -> bool:
    if is_staff(user):
        return True
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == team_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def require_team_access(user: User, team_id: int, db: AsyncSession) -> None:
    if not await user_has_team_access(user, team_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к данным этой команды",
        )
