from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from app.core.database import Base


class UserAchievement(Base):
    """Разблокированное достижение пользователя"""
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(String(50), nullable=False, index=True)
    unlocked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
