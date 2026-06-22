from datetime import datetime
from typing import List
from pydantic import BaseModel, Field, field_validator
from app.modules.voting.logic import to_naive_utc


class VoteRoundResponse(BaseModel):
    id: int
    team_id: int
    cycle_label: str
    is_open: bool
    closes_at: datetime
    has_voted: bool = False

    class Config:
        from_attributes = True


class BallotItem(BaseModel):
    target_user_id: int = Field(..., ge=1)
    score: int = Field(..., ge=1, le=5)


class SubmitBallotsRequest(BaseModel):
    round_id: int
    ballots: List[BallotItem] = Field(..., min_length=1)


class OpenRoundRequest(BaseModel):
    team_id: int
    cycle_label: str = Field(..., min_length=1, max_length=100)
    closes_at: datetime

    @field_validator("closes_at", mode="after")
    @classmethod
    def normalize_closes_at(cls, value: datetime) -> datetime:
        return to_naive_utc(value)


class CloseRoundResponse(BaseModel):
    round_id: int
    updated_users: int
    message: str
