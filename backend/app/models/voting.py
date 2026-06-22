from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from app.core.database import Base


class VoteRound(Base):
    """Раунд анонимного голосования внутри команды"""
    __tablename__ = "vote_rounds"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    cycle_label = Column(String(100), nullable=False)
    is_open = Column(Boolean, default=True, nullable=False)
    closes_at = Column(DateTime, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VoteBallot(Base):
    """Анонимная оценка участника (1–5)"""
    __tablename__ = "vote_ballots"
    __table_args__ = (
        UniqueConstraint(
            "round_id", "voter_user_id", "target_user_id",
            name="uq_vote_ballot",
        ),
    )

    id = Column(Integer, primary_key=True)
    round_id = Column(Integer, ForeignKey("vote_rounds.id"), nullable=False, index=True)
    voter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    score = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
