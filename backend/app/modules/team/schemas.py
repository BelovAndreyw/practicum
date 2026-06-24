from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PublicKrkBreakdown(BaseModel):
    """Публичная разбивка КРК пользователя"""
    base_score: float
    unity_score: float
    bonus_score: float
    total_krk: float


class PublicAchievementResponse(BaseModel):
    """Достижение в публичном профиле"""
    id: str
    title: str
    description: str
    icon: str
    unlocked_at: datetime


class PublicUserProfileResponse(BaseModel):
    """Публичный профиль пользователя"""
    id: int
    full_name: str
    role: str
    team_name: Optional[str] = None
    team_id: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    personal_rating: float = 0.0
    league: Optional[str] = None
    krk_breakdown: Optional[PublicKrkBreakdown] = None
    achievements: List[PublicAchievementResponse] = []


class UserProfileResponse(BaseModel):
    """Ответ с данными профиля пользователя"""
    id: int
    username: str
    student_id: int
    full_name: str
    role: str
    team_name: Optional[str] = None
    team_id: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    """Обновление профиля: ФИО, контакты, аватар"""
    surname: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    patronymic: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = None


class TeamCreateRequest(BaseModel):
    """Запрос на создание команды"""
    name: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=500)


class TeamResponse(BaseModel):
    """Информация о команде"""
    id: int
    name: str
    description: Optional[str] = None
    captain_id: int
    captain_name: Optional[str] = None
    members_count: int = 0
    created_at: datetime


class InviteLinkCreateRequest(BaseModel):
    """Создание пригласительной ссылки"""
    expires_hours: Optional[int] = 24
    max_uses: Optional[int] = None


class InviteLinkResponse(BaseModel):
    """Информация о пригласительной ссылке"""
    token: str
    team_name: str
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int = 0
    is_active: bool = True


class JoinByLinkRequest(BaseModel):
    """Вступление по пригласительной ссылке"""
    token: str


class JoinRequestResponse(BaseModel):
    """Информация о заявке"""
    id: int
    user_id: int
    username: str
    full_name: str
    status: str
    created_at: datetime


class JoinRequestAction(BaseModel):
    """Действие с заявкой"""
    action: str


class TeamUpdateRequest(BaseModel):
    """Обновление команды"""
    name: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=500)


class TeamMemberResponse(BaseModel):
    """Участник команды"""
    user_id: int
    username: str
    full_name: str
    joined_at: datetime
    personal_krk: float = 0.0
    league: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None


class TeamDetailResponse(BaseModel):
    """Детали команды"""
    id: int
    name: str
    description: Optional[str] = None
    captain_id: int
    captain_name: Optional[str] = None
    members: list[TeamMemberResponse]
    members_count: int
    average_krk: float = 0.0
    created_at: datetime
    invite_code: Optional[str] = None
    invite_expires_at: Optional[datetime] = None


class InviteLinkListResponse(BaseModel):
    """Список пригласительных ссылок"""
    links: list[InviteLinkResponse]
