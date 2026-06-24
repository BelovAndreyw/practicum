from datetime import datetime, timezone
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException
from app.models.voting import VoteRound, VoteBallot
from app.models.team import TeamMember
from app.modules.rating.logic import RatingService


def to_naive_utc(value: datetime) -> datetime:
    """Приводит datetime к naive UTC для TIMESTAMP WITHOUT TIME ZONE в PostgreSQL."""
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


class VotingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _ensure_team_member(self, user_id: int, team_id: int) -> None:
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.user_id == user_id,
                TeamMember.team_id == team_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Вы не состоите в этой команде")

    async def get_active_round(self, team_id: int, user_id: int | None = None) -> VoteRound | None:
        result = await self.db.execute(
            select(VoteRound).where(
                VoteRound.team_id == team_id,
                VoteRound.is_open == True,
            ).order_by(VoteRound.created_at.desc()).limit(1)
        )
        return result.scalars().first()

    async def voter_has_submitted(self, round_id: int, voter_user_id: int) -> bool:
        result = await self.db.execute(
            select(func.count()).select_from(VoteBallot).where(
                VoteBallot.round_id == round_id,
                VoteBallot.voter_user_id == voter_user_id,
            )
        )
        return result.scalar_one() > 0

    async def open_round(
        self,
        team_id: int,
        cycle_label: str,
        closes_at: datetime,
    ) -> VoteRound:
        existing = await self.get_active_round(team_id)
        if existing:
            raise HTTPException(status_code=400, detail="У команды уже есть активный раунд голосования")

        round_obj = VoteRound(
            team_id=team_id,
            cycle_label=cycle_label,
            is_open=True,
            closes_at=to_naive_utc(closes_at),
        )
        self.db.add(round_obj)
        await self.db.commit()
        await self.db.refresh(round_obj)
        return round_obj

    async def submit_ballots(
        self,
        round_id: int,
        voter_user_id: int,
        ballots: list[dict],
    ) -> None:
        round_obj = await self.db.get(VoteRound, round_id)
        if not round_obj or not round_obj.is_open:
            raise HTTPException(status_code=404, detail="Раунд не найден или закрыт")
        if datetime.utcnow() > round_obj.closes_at:
            raise HTTPException(status_code=400, detail="Срок голосования истёк")

        await self._ensure_team_member(voter_user_id, round_obj.team_id)

        if await self.voter_has_submitted(round_id, voter_user_id):
            raise HTTPException(status_code=409, detail="Вы уже отправили оценки в этом раунде")

        members_result = await self.db.execute(
            select(TeamMember.user_id).where(TeamMember.team_id == round_obj.team_id)
        )
        member_ids = {row[0] for row in members_result.all()}

        for item in ballots:
            target_id = item["target_user_id"]
            score = item["score"]
            if target_id == voter_user_id:
                raise HTTPException(status_code=400, detail="Нельзя голосовать за себя")
            if target_id not in member_ids:
                raise HTTPException(status_code=400, detail="Цель голосования не из вашей команды")
            self.db.add(VoteBallot(
                round_id=round_id,
                voter_user_id=voter_user_id,
                target_user_id=target_id,
                score=score,
            ))

        await self.db.commit()

    async def close_round(self, round_id: int) -> int:
        round_obj = await self.db.get(VoteRound, round_id)
        if not round_obj:
            raise HTTPException(status_code=404, detail="Раунд не найден")
        if not round_obj.is_open:
            raise HTTPException(status_code=400, detail="Раунд уже закрыт")

        ballots_result = await self.db.execute(
            select(VoteBallot).where(VoteBallot.round_id == round_id)
        )
        ballots = ballots_result.scalars().all()

        scores_by_target: dict[int, list[int]] = defaultdict(list)
        for ballot in ballots:
            scores_by_target[ballot.target_user_id].append(ballot.score)

        rating_service = RatingService(self.db)
        updated = 0
        for target_id, scores in scores_by_target.items():
            avg_score = sum(scores) / len(scores)
            unity_score = round((avg_score / 5) * 100, 2)
            await rating_service.update_user_rating(
                user_id=target_id,
                unity=unity_score,
                event_type="peer_vote",
                description=f"Анонимное голосование: {round_obj.cycle_label}",
                team_id=round_obj.team_id,
            )
            updated += 1

        round_obj.is_open = False
        round_obj.closed_at = datetime.utcnow()
        await self.db.commit()
        return updated
