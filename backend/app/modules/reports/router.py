from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin_or_teacher
from app.models.user import User
from app.models.team import TeamMember
from app.modules.reports.logic import (
    create_report_logic,
    add_report_file_logic,
    assign_task_logic,
    complete_task_logic,
    get_team_reports_logic,
    get_pending_reports_logic,
    get_report_file_logic,
    approve_report_logic,
    reject_report_logic,
)
from app.modules.reports.schemas import (
    ReportCreateRequest,
    ReportResponse,
    ReportFileResponse,
    ReportTaskAssignRequest,
    ReportTaskResponse,
)
from sqlalchemy import select
from pathlib import Path
import uuid

router = APIRouter(prefix="/reports", tags=["Reports"])

REPORT_UPLOAD_DIR = Path("uploads/reports")


async def ensure_report_upload_dir():
    """Создаёт директорию для загрузок отчётов"""
    REPORT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_report_file(file: UploadFile, report_id: int, content: bytes) -> tuple[str, str, int]:
    """Сохраняет файл отчёта"""
    file_extension = Path(file.filename).suffix.lower() if file.filename else ""
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    file_path = REPORT_UPLOAD_DIR / unique_filename

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    return file.filename or "unknown", str(file_path), len(content)


def build_report_response(report) -> ReportResponse:
    """Строит ответ отчёта"""
    return ReportResponse(
        id=report.id,
        team_id=report.team_id,
        challenge_id=report.challenge_id,
        title=report.title,
        description=report.description,
        created_by=report.created_by,
        created_at=report.created_at,
        is_approved=report.is_approved,
        files=[
            ReportFileResponse(
                id=f.id,
                filename=f.filename,
                file_size=f.file_size,
                content_type=f.content_type,
                uploaded_at=f.uploaded_at or report.created_at,
            )
            for f in report.files
        ],
        tasks=[
            ReportTaskResponse(
                id=t.id,
                user_id=t.user_id,
                description=t.description,
                completed=t.completed,
                completed_at=t.completed_at,
            )
            for t in report.tasks
        ],
    )


@router.post("")
async def create_report(
    title: str = Form(..., min_length=3, max_length=200),
    description: str = Form(None),
    challenge_id: int = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать отчёт команды"""
    membership_result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == current_user.id)
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=400, detail="Вы не состоите в команде")

    report = await create_report_logic(
        membership.team_id, current_user.id,
        title, description, challenge_id, db
    )
    return ReportResponse(
        id=report.id,
        team_id=report.team_id,
        challenge_id=report.challenge_id,
        title=report.title,
        description=report.description,
        created_by=report.created_by,
        created_at=report.created_at,
        is_approved=report.is_approved,
        files=[],
        tasks=[],
    )


@router.post("/{report_id}/files")
async def upload_report_file(
    report_id: int,
    files: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загрузить файлы к отчёту"""
    await ensure_report_upload_dir()

    added = []
    for file in files:
        if not file.filename:
            continue

        content = await file.read()
        file_size = len(content)

        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Файл {file.filename} пустой",
            )

        if file_size > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"Файл {file.filename} слишком большой (максимум 10MB)"
            )

        filename, file_path, size = save_report_file(file, report_id, content)
        report_file = await add_report_file_logic(
            report_id, filename, file_path, size,
            file.content_type or "application/octet-stream", db
        )
        added.append(ReportFileResponse(
            id=report_file.id,
            filename=report_file.filename,
            file_size=report_file.file_size,
            content_type=report_file.content_type,
            uploaded_at=report_file.uploaded_at
        ))

    return {"files": added}


@router.get("/{report_id}/files/{file_id}")
async def download_report_file(
    report_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Скачать или открыть файл отчёта"""
    report_file = await get_report_file_logic(report_id, file_id, current_user, db)
    file_path = Path(report_file.file_path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден на диске")

    return FileResponse(
        path=file_path,
        filename=report_file.filename,
        media_type=report_file.content_type or "application/octet-stream",
    )


@router.get("/pending")
async def list_pending_reports(
    current_user: User = Depends(get_current_admin_or_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Неодобренные отчёты по челленджам (организатор)"""
    reports = await get_pending_reports_logic(db)
    return {"reports": [build_report_response(r) for r in reports], "total": len(reports)}


@router.post("/{report_id}/approve")
async def approve_report(
    report_id: int,
    current_user: User = Depends(get_current_admin_or_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Одобрить отчёт и зачесть челлендж"""
    report = await approve_report_logic(report_id, db)
    return {"message": "Отчёт одобрен, челлендж зачтён", "report": build_report_response(report)}


@router.post("/{report_id}/reject")
async def reject_report(
    report_id: int,
    current_user: User = Depends(get_current_admin_or_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Отклонить отчёт — команда сможет отправить новый"""
    await reject_report_logic(report_id, db)
    return {"message": "Отчёт отклонён"}


@router.get("/team/{team_id}")
async def get_team_reports(
    team_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Список отчётов команды"""
    reports = await get_team_reports_logic(team_id, db)
    return {"reports": [build_report_response(r) for r in reports], "total": len(reports)}


@router.post("/{report_id}/tasks")
async def assign_report_task(
    report_id: int,
    data: ReportTaskAssignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Назначить задачу в отчёте"""
    task = await assign_task_logic(report_id, data.user_id, data.description, db)
    return ReportTaskResponse(
        id=task.id,
        user_id=task.user_id,
        description=task.description,
        completed=task.completed,
        completed_at=task.completed_at
    )


@router.post("/tasks/{task_id}/complete")
async def complete_report_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Выполнить задачу в отчёте"""
    task = await complete_task_logic(task_id, current_user.id, db)
    return ReportTaskResponse(
        id=task.id,
        user_id=task.user_id,
        description=task.description,
        completed=task.completed,
        completed_at=task.completed_at
    )
