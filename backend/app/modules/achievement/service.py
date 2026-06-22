from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.achievement import UserAchievement
from app.models.activity import Activity
from app.models.team import TeamMember
from app.modules.achievement.catalog import get_achievement, ACHIEVEMENT_CATALOG


class AchievementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_achievements(self, user_id: int) -> list[dict]:
        result = await self.db.execute(
            select(UserAchievement)
            .where(UserAchievement.user_id == user_id)
            .order_by(UserAchievement.unlocked_at.asc())
        )
        rows = result.scalars().all()
        items = []
        for row in rows:
            definition = get_achievement(row.achievement_id)
            if not definition:
                continue
            items.append({
                "id": definition.id,
                "title": definition.title,
                "description": definition.description,
                "icon": definition.icon,
                "unlocked_at": row.unlocked_at,
            })
        return items

    async def unlock_if_new(self, user_id: int, achievement_id: str) -> bool:
        definition = get_achievement(achievement_id)
        if not definition:
            return False

        existing = await self.db.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_id == achievement_id,
            )
        )
        if existing.scalar_one_or_none():
            return False

        record = UserAchievement(user_id=user_id, achievement_id=achievement_id)
        self.db.add(record)
        await self.db.flush()

        membership_result = await self.db.execute(
            select(TeamMember).where(TeamMember.user_id == user_id)
        )
        membership = membership_result.scalar_one_or_none()
        if membership:
            self.db.add(Activity(
                team_id=membership.team_id,
                user_id=user_id,
                event_type="achievement_unlocked",
                title=f"Достижение: {definition.title}",
                description=definition.description,
                event_metadata={"achievement_id": achievement_id},
            ))

        return True

    async def unlock_for_team_members(self, team_id: int, achievement_id: str) -> None:
        members_result = await self.db.execute(
            select(TeamMember).where(TeamMember.team_id == team_id)
        )
        for member in members_result.scalars().all():
            await self.unlock_if_new(member.user_id, achievement_id)
