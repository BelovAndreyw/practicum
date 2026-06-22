from datetime import datetime
from pydantic import BaseModel


class AchievementResponse(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    unlocked_at: datetime
