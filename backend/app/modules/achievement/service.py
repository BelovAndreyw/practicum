from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.achievement import UserAchievement
from app.models.activity import Activity
from app.models.team import TeamMember
from app.models.reports import WeeklyCheckin, HelpRequest
from app.models.user import User
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

    async def sync_for_user(self, user_id: int) -> None:
        """Выдаёт достижения по уже совершённым действиям (seed, старые данные)."""
        checkin = await self.db.execute(
            select(WeeklyCheckin.id)
            .where(WeeklyCheckin.created_by == user_id)
            .limit(1)
        )
        if checkin.scalar_one_or_none():
            await self.unlock_if_new(user_id, "ach_x1")

        team_ids = [
            row[0]
            for row in (
                await self.db.execute(
                    select(TeamMember.team_id).where(TeamMember.user_id == user_id)
                )
            ).all()
        ]
        if not team_ids:
            return

        fulfilled = await self.db.execute(
            select(HelpRequest.id)
            .where(
                HelpRequest.fulfilled_by_team_id.in_(team_ids),
                HelpRequest.status == "fulfilled",
            )
            .limit(1)
        )
        if fulfilled.scalar_one_or_none():
            await self.unlock_if_new(user_id, "ach_x2")

        offering = await self.db.execute(
            select(HelpRequest.id)
            .where(
                HelpRequest.requesting_team_id.in_(team_ids),
                HelpRequest.help_type == "offering",
            )
            .limit(1)
        )
        if offering.scalar_one_or_none():
            await self.unlock_if_new(user_id, "ach_x3")

    async def sync_all_users(self) -> None:
        """Синхронизирует достижения для всех пользователей (после seed)."""
        result = await self.db.execute(select(User.id))
        for (user_id,) in result.all():
            await self.sync_for_user(user_id)
