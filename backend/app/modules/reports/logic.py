from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from datetime import datetime
from pathlib import Path
from app.models.reports import TeamReport, ReportFile, ReportTask
from app.models.team import Team, TeamMember
from app.models.user import User
from app.modules.challenges.logic import ensure_enrollment_logic, complete_challenge_logic


async def create_report_logic(
    team_id: int,
    user_id: int,
    title: str,
    description: str | None,
    challenge_id: int | None,
    db: AsyncSession
) -> TeamReport:
    """Создание отчёта"""
    if challenge_id is not None:
        await ensure_enrollment_logic(challenge_id, team_id, db)

    report = TeamReport(
        team_id=team_id,
        title=title,
        description=description,
        challenge_id=challenge_id,
        created_by=user_id,
        is_approved=False
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def add_report_file_logic(
    report_id: int,
    filename: str,
    file_path: str,
    file_size: int,
    content_type: str,
    db: AsyncSession
) -> ReportFile:
    """Добавление файла к отчёту"""
    file = ReportFile(
        report_id=report_id,
        filename=filename,
        file_path=file_path,
        file_size=file_size,
        content_type=content_type
    )
    db.add(file)
    await db.commit()
    await db.refresh(file)
    return file


async def assign_task_logic(
    report_id: int,
    user_id: int,
    description: str,
    db: AsyncSession
) -> ReportTask:
    """Назначение задачи в отчёте"""
    task = ReportTask(
        report_id=report_id,
        user_id=user_id,
        description=description,
        completed=False
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def complete_task_logic(
    task_id: int,
    user_id: int,
    db: AsyncSession
) -> ReportTask:
    """Выполнение задачи"""
    task = await db.get(ReportTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if task.user_id != user_id:
        raise HTTPException(status_code=403, detail="Нет прав")

    task.completed = True
    task.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(task)
    return task


async def get_team_reports_logic(
    team_id: int,
    db: AsyncSession
) -> list[TeamReport]:
    """Список отчётов команды"""
    result = await db.execute(
        select(TeamReport)
        .where(TeamReport.team_id == team_id)
        .order_by(TeamReport.created_at.desc())
    )
    return result.scalars().all()


async def get_pending_reports_logic(db: AsyncSession) -> list[TeamReport]:
    """Неодобренные отчёты по челленджам"""
    result = await db.execute(
        select(TeamReport)
        .where(
            TeamReport.is_approved == False,
            TeamReport.challenge_id.isnot(None),
        )
        .options(
            selectinload(TeamReport.files),
            selectinload(TeamReport.tasks),
        )
        .order_by(TeamReport.created_at.desc())
    )
    return result.scalars().all()


async def get_report_file_logic(
    report_id: int,
    file_id: int,
    current_user: User,
    db: AsyncSession,
) -> ReportFile:
    """Возвращает файл отчёта с проверкой прав доступа"""
    result = await db.execute(
        select(ReportFile)
        .where(ReportFile.id == file_id, ReportFile.report_id == report_id)
        .options(selectinload(ReportFile.report))
    )
    report_file = result.scalar_one_or_none()
    if not report_file:
        raise HTTPException(status_code=404, detail="Файл не найден")

    if current_user.role in ("admin", "teacher"):
        return report_file

    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership or membership.team_id != report_file.report.team_id:
        raise HTTPException(status_code=403, detail="Нет прав на просмотр файла")

    return report_file


async def approve_report_logic(
    report_id: int,
    db: AsyncSession,
) -> TeamReport:
    """Одобрение отчёта и зачёт челленджа"""
    result = await db.execute(
        select(TeamReport)
        .where(TeamReport.id == report_id)
        .options(
            selectinload(TeamReport.files),
            selectinload(TeamReport.tasks),
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if report.is_approved:
        raise HTTPException(status_code=400, detail="Отчёт уже одобрен")
    if report.challenge_id is None:
        raise HTTPException(status_code=400, detail="Отчёт не привязан к челленджу")
    if not report.files:
        raise HTTPException(status_code=400, detail="К отчёту не прикреплены файлы")

    report.is_approved = True
    await db.flush()

    await complete_challenge_logic(report.challenge_id, report.team_id, db)
    await db.refresh(report)
    return report


async def reject_report_logic(
    report_id: int,
    db: AsyncSession,
) -> None:
    """Отклонение отчёта — команда сможет отправить новый"""
    result = await db.execute(
        select(TeamReport)
        .where(TeamReport.id == report_id)
        .options(selectinload(TeamReport.files))
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Отчёт не найден")
    if report.is_approved:
        raise HTTPException(status_code=400, detail="Нельзя отклонить уже одобренный отчёт")
    if report.challenge_id is None:
        raise HTTPException(status_code=400, detail="Отчёт не привязан к челленджу")

    for report_file in report.files:
        file_path = Path(report_file.file_path)
        if file_path.is_file():
            file_path.unlink()

    await db.delete(report)
    await db.commit()
