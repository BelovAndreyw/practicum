from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.activity import Challenge, TeamChallenge, Activity
from app.models.team import Team, TeamMember
from app.modules.rating.logic import RatingService
from app.modules.rating.team_logic import TeamRatingService
from datetime import datetime

# reward_points / 30 = прирост КРК на участника (150 очков → +5.00 КРК)
CHALLENGE_KRK_DIVISOR = 30


async def get_challenges_logic(
    status: str = "active",
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = None
) -> tuple[list[Challenge], int]:
    """Получение списка челленджей"""
    query = select(Challenge)
    count_query = select(func.count()).select_from(Challenge)
    if status == "active":
        query = query.where(Challenge.is_active == True)
        count_query = count_query.where(Challenge.is_active == True)

    result = await db.execute(
        query.order_by(Challenge.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    challenges = result.scalars().all()

    total = (await db.execute(count_query)).scalar_one()

    return challenges, total


async def get_completed_team_ids_by_challenge(
    challenge_ids: list[int],
    db: AsyncSession,
) -> dict[int, list[int]]:
    """Команды, завершившие челленджи"""
    if not challenge_ids:
        return {}

    result = await db.execute(
        select(TeamChallenge.challenge_id, TeamChallenge.team_id).where(
            TeamChallenge.challenge_id.in_(challenge_ids),
            TeamChallenge.status == "completed",
        )
    )
    mapping: dict[int, list[int]] = {}
    for challenge_id, team_id in result.all():
        mapping.setdefault(challenge_id, []).append(team_id)
    return mapping


async def create_challenge_logic(
    title: str,
    description: str | None,
    reward_points: int,
    deadline: datetime | None,
    db: AsyncSession = None
) -> Challenge:
    """Создание челленджа (только для админов/преподавателей)"""
    challenge = Challenge(
        title=title,
        description=description,
        reward_points=reward_points,
        deadline=deadline,
        is_active=True
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return challenge


async def ensure_enrollment_logic(
    challenge_id: int,
    team_id: int,
    db: AsyncSession,
) -> TeamChallenge:
    """Запись команды на челлендж (идемпотентно)"""
    existing = await db.execute(
        select(TeamChallenge).where(
            TeamChallenge.challenge_id == challenge_id,
            TeamChallenge.team_id == team_id,
        )
    )
    enrollment = existing.scalar_one_or_none()
    if enrollment:
        return enrollment

    challenge = await db.get(Challenge, challenge_id)
    if not challenge or not challenge.is_active:
        raise HTTPException(status_code=404, detail="Челлендж не найден или неактивен")

    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Команда не найдена")

    enrollment = TeamChallenge(
        challenge_id=challenge_id,
        team_id=team_id,
        status="active",
    )
    db.add(enrollment)
    await db.flush()
    return enrollment


async def enroll_challenge_logic(
    challenge_id: int,
    team_id: int,
    db: AsyncSession = None
) -> TeamChallenge:
    """Запись команды на челлендж"""
    existing = await db.execute(
        select(TeamChallenge).where(
            TeamChallenge.challenge_id == challenge_id,
            TeamChallenge.team_id == team_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Команда уже записана на этот челлендж")

    enrollment = await ensure_enrollment_logic(challenge_id, team_id, db)
    await db.commit()
    await db.refresh(enrollment)
    return enrollment


async def _apply_challenge_krk_bonus(
    team_id: int,
    challenge: Challenge,
    db: AsyncSession,
) -> None:
    """Начисляет бонус КРК всем участникам команды за челлендж."""
    members_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id)
    )
    members = members_result.scalars().all()
    if not members:
        return

    krk_gain = round(challenge.reward_points / CHALLENGE_KRK_DIVISOR, 2)
    bonus_delta = round(krk_gain / RatingService.BONUS_WEIGHT, 2)
    rating_service = RatingService(db)
    for member in members:
        await rating_service.apply_krk_delta(
            user_id=member.user_id,
            krk_delta=krk_gain,
            bonus_delta=bonus_delta,
            event_type="challenge",
            description=f'Завершён челлендж "{challenge.title}" (+{challenge.reward_points} очков)',
            team_id=team_id,
        )

    await TeamRatingService(db).recalculate_team_rating(team_id)


async def complete_challenge_logic(
    challenge_id: int,
    team_id: int,
    db: AsyncSession = None
) -> TeamChallenge:
    """Завершение челленджа командой"""
    enrollment_result = await db.execute(
        select(TeamChallenge).where(
            TeamChallenge.challenge_id == challenge_id,
            TeamChallenge.team_id == team_id
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if not enrollment:
        enrollment = await ensure_enrollment_logic(challenge_id, team_id, db)
    if enrollment.status == "completed":
        raise HTTPException(status_code=400, detail="Челлендж уже завершён")

    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Челлендж не найден")

    enrollment.status = "completed"
    enrollment.completed_at = datetime.utcnow()

    await _apply_challenge_krk_bonus(team_id, challenge, db)

    activity = Activity(
        team_id=team_id,
        event_type="challenge_completed",
        title=f'Челлендж завершён: {challenge.title}',
        description=f'Получено {challenge.reward_points} очков команде',
        event_metadata={"challenge_id": challenge_id, "reward_points": challenge.reward_points}
    )
    db.add(activity)

    await db.commit()
    await db.refresh(enrollment)
    return enrollment


async def get_team_challenges_logic(
    team_id: int,
    db: AsyncSession = None
) -> list[TeamChallenge]:
    """Получение всех челленджей команды"""
    result = await db.execute(
        select(TeamChallenge)
        .where(TeamChallenge.team_id == team_id)
        .options(selectinload(TeamChallenge.challenge))
        .order_by(TeamChallenge.enrolled_at.desc())
    )
    return result.scalars().all()


async def get_pending_report_challenge_ids(
    team_id: int,
    db: AsyncSession,
) -> set[int]:
    """Челленджи с неодобренными отчётами команды"""
    from app.models.reports import TeamReport

    result = await db.execute(
        select(TeamReport.challenge_id).where(
            TeamReport.team_id == team_id,
            TeamReport.challenge_id.isnot(None),
            TeamReport.is_approved == False,
        )
    )
    return {row[0] for row in result.all() if row[0] is not None}


async def delete_challenge_logic(
    challenge_id: int,
    db: AsyncSession = None
) -> None:
    """Удаление челленджа (только для админов/преподавателей)"""
    challenge = await db.get(Challenge, challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Челлендж не найден")

    await db.execute(
        delete(TeamChallenge).where(TeamChallenge.challenge_id == challenge_id)
    )
    await db.delete(challenge)
    await db.commit()
