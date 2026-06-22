from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin_or_teacher
from app.models.user import User
from app.models.voting import VoteBallot
from app.modules.voting.logic import VotingService
from app.modules.voting.schemas import (
    VoteRoundResponse,
    SubmitBallotsRequest,
    OpenRoundRequest,
    CloseRoundResponse,
)

router = APIRouter(prefix="/voting", tags=["Voting"])


@router.get("/active", response_model=VoteRoundResponse | None)
async def get_active_round(
    teamId: int = Query(..., alias="teamId"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = VotingService(db)
    if current_user.role not in ("admin", "teacher"):
        await service._ensure_team_member(current_user.id, teamId)
    round_obj = await service.get_active_round(teamId)
    if not round_obj:
        return None

    voted_result = await db.execute(
        select(func.count()).select_from(VoteBallot).where(
            VoteBallot.round_id == round_obj.id,
            VoteBallot.voter_user_id == current_user.id,
        )
    )
    has_voted = voted_result.scalar_one() > 0

    return VoteRoundResponse(
        id=round_obj.id,
        team_id=round_obj.team_id,
        cycle_label=round_obj.cycle_label,
        is_open=round_obj.is_open,
        closes_at=round_obj.closes_at,
        has_voted=has_voted,
    )


@router.post("/ballots", status_code=204)
async def submit_ballots(
    data: SubmitBallotsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = VotingService(db)
    await service.submit_ballots(
        data.round_id,
        current_user.id,
        [{"target_user_id": b.target_user_id, "score": b.score} for b in data.ballots],
    )


@router.post("/rounds", response_model=VoteRoundResponse)
async def open_round(
    data: OpenRoundRequest,
    current_user: User = Depends(get_current_admin_or_teacher),
    db: AsyncSession = Depends(get_db),
):
    service = VotingService(db)
    round_obj = await service.open_round(data.team_id, data.cycle_label, data.closes_at)
    return VoteRoundResponse(
        id=round_obj.id,
        team_id=round_obj.team_id,
        cycle_label=round_obj.cycle_label,
        is_open=round_obj.is_open,
        closes_at=round_obj.closes_at,
        has_voted=False,
    )


@router.post("/rounds/{round_id}/close", response_model=CloseRoundResponse)
async def close_round(
    round_id: int,
    current_user: User = Depends(get_current_admin_or_teacher),
    db: AsyncSession = Depends(get_db),
):
    service = VotingService(db)
    updated = await service.close_round(round_id)
    return CloseRoundResponse(
        round_id=round_id,
        updated_users=updated,
        message=f"Раунд закрыт, обновлено рейтингов: {updated}",
    )
