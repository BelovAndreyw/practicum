from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, UploadFile
from pathlib import Path
from datetime import datetime
from app.models.reports import TeamEvent, EventInvitation, EventParticipant
from app.models.team import Team
from app.models.user import User, UserRole
from app.modules.events.schemas import EventCreateRequest, EventUpdateRequest
from app.core.uploads import EVENT_IMAGE_UPLOAD_DIR, delete_file, save_image, validate_image, versioned_upload_url


def resolve_event_image_url(event: TeamEvent) -> str | None:
    """Приоритет загруженного файла над внешней ссылкой."""
    if event.image_file_path:
        return versioned_upload_url(f"/events/{event.id}/image", event.image_file_path)
    return event.image_url


def _is_internal_event_image_url(event: TeamEvent, url: str) -> bool:
    normalized = url.split("?", 1)[0]
    return normalized.endswith(f"/events/{event.id}/image")


async def _is_team_captain(user: User, team_id: int, db: AsyncSession) -> bool:
    team = await db.get(Team, team_id)
    return team is not None and team.captain_id == user.id


async def _can_manage_team_event(user: User, event: TeamEvent, db: AsyncSession) -> bool:
    if event.created_by == user.id:
        return True
    if user.role in (UserRole.TEACHER.value, UserRole.ADMIN.value):
        return True
    return await _is_team_captain(user, event.team_id, db)


async def resolve_organizer_name(created_by: int, db: AsyncSession) -> str | None:
    """ФИО автора события (для отображения вместо «User #id»)."""
    result = await db.execute(
        select(User).where(User.id == created_by).options(selectinload(User.student))
    )
    user = result.scalar_one_or_none()
    if user and user.student:
        s = user.student
        return f"{s.surname} {s.name}".strip()
    return user.username if user else None


async def resolve_organizer_names(created_by_ids: list[int], db: AsyncSession) -> dict[int, str]:
    """ФИО авторов для списка событий одним запросом."""
    ids = list({uid for uid in created_by_ids if uid is not None})
    if not ids:
        return {}
    result = await db.execute(
        select(User).where(User.id.in_(ids)).options(selectinload(User.student))
    )
    names: dict[int, str] = {}
    for user in result.scalars().all():
        if user.student:
            names[user.id] = f"{user.student.surname} {user.student.name}".strip()
        else:
            names[user.id] = user.username
    return names


async def create_event_logic(
    team_id: int,
    user_id: int,
    data: EventCreateRequest,
    db: AsyncSession
) -> TeamEvent:
    """Создание события"""
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")

    event = TeamEvent(
        team_id=team_id,
        title=data.title,
        description=data.description,
        image_url=data.image_url,
        event_type=data.event_type,
        format=data.format,
        location=data.location,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        max_participants=data.max_participants,
        is_public=data.is_public,
        created_by=user_id
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def update_event_logic(
    event_id: int,
    user: User,
    data: EventUpdateRequest,
    db: AsyncSession,
) -> TeamEvent:
    """Редактирование события: автор или организатор (teacher/admin)."""
    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    if not await _can_manage_team_event(user, event, db):
        raise HTTPException(status_code=403, detail="Нет прав на редактирование события")

    payload = data.model_dump(exclude_unset=True)
    if "image_url" in payload:
        new_url = payload["image_url"]
        if new_url and _is_internal_event_image_url(event, new_url):
            payload.pop("image_url")
        elif new_url:
            if event.image_file_path:
                delete_file(event.image_file_path)
                event.image_file_path = None
                event.image_content_type = None
        else:
            payload["image_url"] = None

    for field, value in payload.items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)
    return event


async def get_events_logic(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = None,
    team_id: int | None = None,
) -> tuple[list[TeamEvent], int]:
    """Список событий. При team_id — только события этой команды (командный календарь)."""
    base = select(TeamEvent)
    if team_id is not None:
        # В командном календаре показываем все события команды (в т.ч. непубличные)
        base = base.where(TeamEvent.team_id == team_id)
    else:
        base = base.where(TeamEvent.is_public == True)

    result = await db.execute(
        base.order_by(TeamEvent.starts_at.desc()).offset(offset).limit(limit)
    )
    events = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    return events, total


async def get_event_detail_logic(
    event_id: int,
    db: AsyncSession = None
) -> TeamEvent:
    """Детали события"""
    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    return event


async def invite_team_logic(
    event_id: int,
    team_id: int,
    db: AsyncSession = None
) -> EventInvitation:
    """Приглашение команды на событие"""
    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")

    existing = await db.execute(
        select(EventInvitation).where(
            EventInvitation.event_id == event_id,
            EventInvitation.team_id == team_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Команда уже приглашена")

    invitation = EventInvitation(event_id=event_id, team_id=team_id)
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def respond_invitation_logic(
    invitation_id: int,
    team_id: int,
    accept: bool,
    db: AsyncSession = None
) -> EventInvitation:
    """Ответ на приглашение"""
    inv_result = await db.execute(
        select(EventInvitation).where(
            EventInvitation.id == invitation_id,
            EventInvitation.team_id == team_id
        )
    )
    invitation = inv_result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")

    invitation.status = "accepted" if accept else "declined"
    invitation.responded_at = datetime.utcnow()
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def rsvp_event_logic(
    event_id: int,
    user_id: int,
    db: AsyncSession = None
) -> EventParticipant:
    """Регистрация на событие"""
    from app.models.team import TeamMember

    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == user_id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="Вы не состоите в команде")

    team_id = membership.team_id

    existing = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.team_id == team_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Вы уже зарегистрированы")

    participant = EventParticipant(
        event_id=event_id,
        user_id=user_id,
        team_id=team_id
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return participant


async def upload_event_image_logic(
    event_id: int,
    user: User,
    file: UploadFile,
    db: AsyncSession,
) -> TeamEvent:
    """Загрузка обложки события."""
    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if not await _can_manage_team_event(user, event, db):
        raise HTTPException(status_code=403, detail="Нет прав на редактирование события")

    validate_image(file)
    delete_file(event.image_file_path)

    _, file_path, _, content_type = save_image(file, EVENT_IMAGE_UPLOAD_DIR)
    event.image_file_path = file_path
    event.image_content_type = content_type
    await db.commit()
    await db.refresh(event)
    return event


async def remove_event_image_logic(
    event_id: int,
    user: User,
    db: AsyncSession,
) -> TeamEvent:
    """Удаление загруженной обложки события."""
    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if not await _can_manage_team_event(user, event, db):
        raise HTTPException(status_code=403, detail="Нет прав на редактирование события")

    if event.image_file_path:
        delete_file(event.image_file_path)
        event.image_file_path = None
        event.image_content_type = None
        await db.commit()
        await db.refresh(event)
    return event


async def delete_event_logic(
    event_id: int,
    user: User,
    db: AsyncSession = None
) -> None:
    """Удаление события: автор или организатор (teacher/admin)."""
    event = await db.get(TeamEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if not await _can_manage_team_event(user, event, db):
        raise HTTPException(status_code=403, detail="Нет прав")
    delete_file(event.image_file_path)
    await db.delete(event)
    await db.commit()
