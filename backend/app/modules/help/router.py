from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin_or_teacher
from app.models.user import User
from app.models.team import TeamMember
from app.modules.help.logic import (
    create_help_request_logic,
    respond_to_help_logic,
    accept_help_logic,
    cancel_help_request_logic,
    get_help_requests_logic,
    get_help_request_detail_logic,
    serialize_help_request,
    serialize_help_request_list,
    RESCUE_BONUS_POINTS,
)
from app.modules.challenges.logic import CHALLENGE_KRK_DIVISOR
from app.modules.help.schemas import (
    HelpRequestCreate,
    HelpResponseCreate,
    HelpRequestResponse,
    HelpResponseResponse,
    HelpRequestDetailResponse
)
from sqlalchemy import select

router = APIRouter(prefix="/help", tags=["Help"])


@router.get("")
async def list_help_requests(
    status: str = Query(None),
    help_type: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Список заявок на помощь"""
    requests, total = await get_help_requests_logic(status, help_type, db)
    serialized = await serialize_help_request_list(requests, db)
    return {
        "requests": [HelpRequestResponse(**item) for item in serialized],
        "total": total,
    }


@router.post("")
async def create_help_request(
    data: HelpRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать заявку на помощь"""
    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="Вы не состоите в команде")

    request = await create_help_request_logic(
        membership.team_id, current_user.id,
        data.title, data.description, data.help_type,
        data.format, data.estimated_effort_hours, db
    )
    return HelpRequestResponse(**await serialize_help_request(request, db))


@router.get("/{request_id}")
async def get_help_request(
    request_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Детали заявки"""
    request = await get_help_request_detail_logic(request_id, db)
    data = await serialize_help_request(request, db)
    return HelpRequestDetailResponse(
        **data,
        responses=[
            HelpResponseResponse(
                id=resp.id,
                help_request_id=resp.help_request_id,
                responding_team_id=resp.responding_team_id,
                message=resp.message,
                status=resp.status,
                responded_at=resp.responded_at,
            )
            for resp in request.responses
        ],
    )


@router.post("/{request_id}/respond")
async def respond_to_help(
    request_id: int,
    data: HelpResponseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Откликнуться на заявку"""
    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="Вы не состоите в команде")

    response = await respond_to_help_logic(request_id, membership.team_id, data.message, db)
    return {"message": "Отклик отправлен", "response_id": response.id}


@router.post("/{request_id}/accept/{response_id}")
async def accept_help(
    request_id: int,
    response_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Принять помощь — начислить баллы"""
    request = await accept_help_logic(request_id, response_id, current_user.id, db)
    krk_gain = round(RESCUE_BONUS_POINTS / CHALLENGE_KRK_DIVISOR, 2)
    return {
        "message": (
            f"Помощь принята: +{krk_gain} КРК каждому участнику "
            f"обеих команд (бонус {RESCUE_BONUS_POINTS} очков)"
        ),
    }


@router.post("/{request_id}/cancel")
async def cancel_help_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отменить заявку"""
    request = await cancel_help_request_logic(request_id, current_user.id, db)
    return {"message": "Заявка отменена"}
