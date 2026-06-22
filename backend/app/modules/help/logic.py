from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from datetime import datetime
from app.models.reports import HelpRequest, HelpResponse
from app.models.team import Team, TeamMember
from app.models.activity import Activity, TeamActivityLog
from app.modules.challenges.logic import CHALLENGE_KRK_DIVISOR
from app.modules.rating.logic import RatingService
from app.modules.rating.team_logic import TeamRatingService
from app.modules.achievement.service import AchievementService


RESCUE_BONUS_POINTS = 40


async def _ensure_member_of_team(team_id: int, user_id: int, db: AsyncSession) -> None:
    """Проверяет, что пользователь состоит в указанной команде"""
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.user_id == user_id,
            TeamMember.team_id == team_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=403,
            detail="Только участник команды-инициатора может управлять заявкой",
        )


async def create_help_request_logic(
    team_id: int,
    user_id: int,
    title: str,
    description: str | None,
    help_type: str,
    format: str,
    estimated_effort_hours: int | None,
    db: AsyncSession
) -> HelpRequest:
    """Создание заявки на помощь"""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")

    request = HelpRequest(
        requesting_team_id=team_id,
        title=title,
        description=description,
        help_type=help_type,
        format=format,
        estimated_effort_hours=estimated_effort_hours,
        status="open"
    )
    db.add(request)
    await db.flush()

    if help_type == "offering":
        await AchievementService(db).unlock_if_new(user_id, "ach_x3")

    await db.commit()
    await db.refresh(request)
    return request


async def respond_to_help_logic(
    request_id: int,
    team_id: int,
    message: str | None,
    db: AsyncSession
) -> HelpResponse:
    """Отклик на заявку помощи"""
    request = await db.get(HelpRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if request.status != "open":
        raise HTTPException(status_code=400, detail="Заявка уже закрыта")
    if request.requesting_team_id == team_id:
        raise HTTPException(status_code=400, detail="Нельзя откликнуться на свою заявку")

    existing = await db.execute(
        select(HelpResponse).where(
            HelpResponse.help_request_id == request_id,
            HelpResponse.responding_team_id == team_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Вы уже откликнулись")

    response = HelpResponse(
        help_request_id=request_id,
        responding_team_id=team_id,
        message=message,
        status="pending"
    )
    db.add(response)
    await db.commit()
    await db.refresh(response)
    return response


async def _apply_rescue_krk_bonus(
    team_id: int,
    request_title: str,
    db: AsyncSession,
) -> float:
    """Начисляет бонус КРК всем участникам команды за спасение."""
    members_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id)
    )
    members = members_result.scalars().all()
    if not members:
        return 0.0

    krk_gain = round(RESCUE_BONUS_POINTS / CHALLENGE_KRK_DIVISOR, 2)
    bonus_delta = round(krk_gain / RatingService.BONUS_WEIGHT, 2)
    rating_service = RatingService(db)
    for member in members:
        await rating_service.apply_krk_delta(
            user_id=member.user_id,
            krk_delta=krk_gain,
            bonus_delta=bonus_delta,
            event_type="rescue",
            description=f'Спасение: «{request_title}» (+{RESCUE_BONUS_POINTS} очков)',
            team_id=team_id,
        )

    await TeamRatingService(db).recalculate_team_rating(team_id)
    return krk_gain


async def accept_help_logic(
    request_id: int,
    response_id: int,
    user_id: int,
    db: AsyncSession
) -> HelpRequest:
    """Принятие помощи — начисление баллов обеим командам"""
    request = await db.get(HelpRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    await _ensure_member_of_team(request.requesting_team_id, user_id, db)
    if request.status not in ("open", "in_progress"):
        raise HTTPException(status_code=400, detail="Заявка уже закрыта")

    response = await db.get(HelpResponse, response_id)
    if not response or response.help_request_id != request_id:
        raise HTTPException(status_code=404, detail="Отклик не найден")

    requesting_team = await db.get(Team, request.requesting_team_id)
    responding_team = await db.get(Team, response.responding_team_id)

    request.status = "fulfilled"
    request.fulfilled_by_team_id = responding_team.id
    request.fulfilled_at = datetime.utcnow()

    response.status = "accepted"

    team_rating_service = TeamRatingService(db)
    krk_gain = round(RESCUE_BONUS_POINTS / CHALLENGE_KRK_DIVISOR, 2)

    for team in (requesting_team, responding_team):
        team_rating = await team_rating_service.get_or_create_team_rating(team.id)
        old_average = team_rating.average_krk

        await _apply_rescue_krk_bonus(team.id, request.title, db)

        team_rating = await team_rating_service.get_or_create_team_rating(team.id)
        new_average = team_rating.average_krk

        db.add(TeamActivityLog(
            team_id=team.id,
            event_type="rescue_completed",
            old_rating=old_average,
            new_rating=new_average,
            description=f"Спасение: {request.title} (+{krk_gain} КРК участникам)",
        ))

        db.add(Activity(
            team_id=team.id,
            event_type="rescue_completed",
            title="Спасение завершено",
            description=(
                f"«{request.title}»: +{krk_gain} КРК каждому участнику, "
                f"командный КРК {old_average:.2f} → {new_average:.2f}"
            ),
            event_metadata={
                "help_request_id": request_id,
                "bonus_points": RESCUE_BONUS_POINTS,
                "krk_gain": krk_gain,
            },
        ))

    await AchievementService(db).unlock_for_team_members(
        response.responding_team_id, "ach_x2"
    )

    await db.commit()
    await db.refresh(request)
    return request


async def cancel_help_request_logic(
    request_id: int,
    user_id: int,
    db: AsyncSession
) -> HelpRequest:
    """Отмена заявки"""
    result = await db.execute(
        select(HelpRequest)
        .where(HelpRequest.id == request_id)
        .options(selectinload(HelpRequest.responses))
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    await _ensure_member_of_team(request.requesting_team_id, user_id, db)
    if request.status not in ("open", "in_progress"):
        raise HTTPException(status_code=400, detail="Заявка уже закрыта")

    for response in request.responses:
        if response.status == "pending":
            response.status = "declined"

    request.status = "cancelled"
    await db.commit()
    await db.refresh(request)
    return request


def resolve_helper_team_id(request: HelpRequest) -> int | None:
    """Определяет команду-помощника: fulfilled или первый активный отклик."""
    if request.fulfilled_by_team_id:
        return request.fulfilled_by_team_id
    for response in request.responses:
        if response.status in ("pending", "accepted"):
            return response.responding_team_id
    return None


async def load_team_names(team_ids: set[int], db: AsyncSession) -> dict[int, str]:
    if not team_ids:
        return {}
    result = await db.execute(select(Team).where(Team.id.in_(team_ids)))
    return {team.id: team.name for team in result.scalars().all()}


async def serialize_help_request(
    request: HelpRequest,
    db: AsyncSession,
    team_names: dict[int, str] | None = None,
) -> dict:
    """Сериализует заявку с именами команд."""
    if team_names is None:
        team_ids = {request.requesting_team_id}
        helper_id = resolve_helper_team_id(request)
        if helper_id:
            team_ids.add(helper_id)
        team_names = await load_team_names(team_ids, db)

    helper_id = resolve_helper_team_id(request)
    return {
        "id": request.id,
        "requesting_team_id": request.requesting_team_id,
        "requesting_team_name": team_names.get(request.requesting_team_id),
        "helper_team_id": helper_id,
        "helper_team_name": team_names.get(helper_id) if helper_id else None,
        "title": request.title,
        "description": request.description,
        "help_type": request.help_type,
        "format": request.format,
        "estimated_effort_hours": request.estimated_effort_hours,
        "status": request.status,
        "created_at": request.created_at,
        "fulfilled_by_team_id": request.fulfilled_by_team_id,
        "fulfilled_at": request.fulfilled_at,
        "responses_count": len(request.responses),
    }


async def serialize_help_request_list(
    requests: list[HelpRequest],
    db: AsyncSession,
) -> list[dict]:
    team_ids: set[int] = set()
    for request in requests:
        team_ids.add(request.requesting_team_id)
        helper_id = resolve_helper_team_id(request)
        if helper_id:
            team_ids.add(helper_id)
    team_names = await load_team_names(team_ids, db)
    return [
        await serialize_help_request(request, db, team_names)
        for request in requests
    ]


async def get_help_requests_logic(
    status: str | None = None,
    help_type: str | None = None,
    db: AsyncSession = None
) -> tuple[list[HelpRequest], int]:
    """Список заявок"""
    query = select(HelpRequest).options(selectinload(HelpRequest.responses))
    if status:
        query = query.where(HelpRequest.status == status)
    if help_type:
        query = query.where(HelpRequest.help_type == help_type)

    result = await db.execute(
        query.where(
            HelpRequest.status.notin_(("fulfilled", "cancelled"))
        ).order_by(HelpRequest.created_at.desc())
    )
    requests = result.scalars().all()

    count_result = await db.execute(select(HelpRequest))
    total = len(count_result.scalars().all())

    return requests, total


async def get_help_request_detail_logic(
    request_id: int,
    db: AsyncSession
) -> HelpRequest:
    """Детали заявки вместе с откликами"""
    result = await db.execute(
        select(HelpRequest)
        .where(HelpRequest.id == request_id)
        .options(selectinload(HelpRequest.responses))
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return request