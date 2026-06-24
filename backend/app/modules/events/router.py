from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_optional_current_user
from app.core.access import is_staff, require_team_access
from app.models.user import User
from app.models.team import TeamMember
from app.modules.events.logic import (
    create_event_logic,
    update_event_logic,
    get_events_logic,
    get_event_detail_logic,
    invite_team_logic,
    respond_invitation_logic,
    rsvp_event_logic,
    delete_event_logic,
    resolve_organizer_name,
    resolve_organizer_names,
)
from app.modules.events.schemas import (
    EventCreateRequest,
    EventUpdateRequest,
    EventResponse,
    EventDetailResponse,
    InvitationRespondRequest
)
from sqlalchemy import select

router = APIRouter(prefix="/events", tags=["Events"])


def _event_response(event, organizer_name=None) -> EventResponse:
    return EventResponse(
        id=event.id,
        team_id=event.team_id,
        title=event.title,
        description=event.description,
        image_url=event.image_url,
        event_type=event.event_type,
        format=event.format,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        max_participants=event.max_participants,
        is_public=event.is_public,
        created_by=event.created_by,
        organizer_name=organizer_name,
        created_at=event.created_at,
    )


@router.get("")
async def list_events(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    team_id: int | None = Query(None, description="Только события этой команды (командный календарь)"),
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список событий (или командный календарь при team_id)."""
    if team_id is not None:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Требуется авторизация для командного календаря",
                headers={"WWW-Authenticate": "Bearer"},
            )
        await require_team_access(current_user, team_id, db)
    events, total = await get_events_logic(limit, offset, db, team_id=team_id)
    names = await resolve_organizer_names([e.created_by for e in events], db)
    return {
        "events": [_event_response(e, names.get(e.created_by)) for e in events],
        "total": total
    }


@router.post("")
async def create_event(
    data: EventCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать событие"""
    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()

    if membership:
        target_team_id = membership.team_id
    elif is_staff(current_user) and data.team_id is not None:
        target_team_id = data.team_id
    else:
        raise HTTPException(
            status_code=400,
            detail="Вы не состоите в команде. Укажите team_id (для организатора) или вступите в команду.",
        )

    event = await create_event_logic(target_team_id, current_user.id, data, db)
    organizer_name = await resolve_organizer_name(event.created_by, db)
    return _event_response(event, organizer_name)


@router.get("/{event_id}")
async def get_event(
    event_id: int,
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Детали события (приватные — только для участников команды или staff)."""
    event = await get_event_detail_logic(event_id, db)
    if not event.is_public:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Требуется авторизация для просмотра этого события",
                headers={"WWW-Authenticate": "Bearer"},
            )
        await require_team_access(current_user, event.team_id, db)
    organizer_name = await resolve_organizer_name(event.created_by, db)
    return EventDetailResponse(
        id=event.id,
        team_id=event.team_id,
        title=event.title,
        description=event.description,
        image_url=event.image_url,
        event_type=event.event_type,
        format=event.format,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        max_participants=event.max_participants,
        is_public=event.is_public,
        created_by=event.created_by,
        organizer_name=organizer_name,
        created_at=event.created_at,
        invitations=[],
        participants=[]
    )


@router.patch("/{event_id}")
async def patch_event(
    event_id: int,
    data: EventUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Редактировать событие (автор или организатор)"""
    event = await update_event_logic(event_id, current_user, data, db)
    organizer_name = await resolve_organizer_name(event.created_by, db)
    return _event_response(event, organizer_name)


@router.post("/{event_id}/invite/{team_id}")
async def invite_to_event(
    event_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Пригласить команду на событие"""
    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="Вы не состоите в команде")

    invitation = await invite_team_logic(event_id, team_id, db)
    return {"message": "Команда приглашена", "invitation_id": invitation.id}


@router.post("/{event_id}/rsvp")
async def rsvp_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Зарегистрироваться на событие"""
    participant = await rsvp_event_logic(event_id, current_user.id, db)
    return {"message": "Вы зарегистрированы", "participant_id": participant.id}


@router.post("/invitations/{invitation_id}/respond")
async def respond_invitation(
    invitation_id: int,
    data: InvitationRespondRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Ответить на приглашение"""
    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="Вы не состоите в команде")

    invitation = await respond_invitation_logic(invitation_id, membership.team_id, data.accept, db)
    return {"message": "Ответ отправлен", "status": invitation.status}


@router.delete("/{event_id}")
async def remove_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить событие (автор или организатор)"""
    await delete_event_logic(event_id, current_user, db)
    return {"message": "Событие удалено"}
