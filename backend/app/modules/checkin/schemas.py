from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from app.core.datetime_utils import to_naive_utc


class CheckinCreateRequest(BaseModel):
    """Создание check-in"""
    week_start_date: datetime
    content: Optional[str] = None
    achievements: Optional[str] = None
    blockers: Optional[str] = None

    @field_validator("week_start_date", mode="after")
    @classmethod
    def normalize_week_start(cls, value: datetime) -> datetime:
        return to_naive_utc(value)


class CheckinTaskRequest(BaseModel):
    """Добавление задачи в check-in"""
    user_id: int
    description: str


class CheckinTaskResponse(BaseModel):
    """Задача check-in"""
    id: int
    user_id: int
    description: str
    completed: bool
    completed_at: Optional[datetime] = None


class CheckinResponse(BaseModel):
    """Check-in"""
    id: int
    team_id: int
    week_start_date: datetime
    content: Optional[str] = None
    achievements: Optional[str] = None
    blockers: Optional[str] = None
    created_by: int
    created_at: datetime
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    status: str
    tasks: list[CheckinTaskResponse]


class CheckinListResponse(BaseModel):
    """Список check-ins"""
    checkins: list[CheckinResponse]
    total: int
