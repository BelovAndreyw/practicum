import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.schema_patch import apply_schema_patches
from app.core.config import settings
from app.core.demo_seed import seed_demo_data
from app.modules.auth.router import router as auth_router
from app.modules.team.router import router as team_router
from app.models.team import TeamInviteLink, TeamJoinRequest
from app.models.activity import Activity, Challenge, TeamChallenge
from app.modules.posts.router import router as posts_router
from app.modules.team_profile.router import router as team_profile_router
from app.modules.activity.router import router as activity_router
from app.modules.challenges.router import router as challenges_router
from app.modules.reports.router import router as reports_router
from app.modules.events.router import router as events_router
from app.modules.checkin.router import router as checkin_router
from app.modules.help.router import router as help_router
from app.modules.rating.router import router as rating_router
from app.models.reports import (
    TeamReport, ReportFile, ReportTask,
    TeamEvent, EventInvitation, EventParticipant,
    WeeklyCheckin, CheckinTask,
    HelpRequest, HelpResponse
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Функция жизненного цикла приложения"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await apply_schema_patches(conn)

    if settings.DEMO_MODE:
        async with AsyncSessionLocal() as session:
            await seed_demo_data(session)
            await session.commit()

    yield


app = FastAPI(title="University API", lifespan=lifespan)

app.include_router(auth_router)
app.include_router(team_router)
app.include_router(posts_router)
app.include_router(team_profile_router)
app.include_router(activity_router)
app.include_router(challenges_router)
app.include_router(reports_router)
app.include_router(events_router)
app.include_router(checkin_router)
app.include_router(help_router)
app.include_router(rating_router)


@app.get("/")
async def root():
    """Простая проверка, что сервер работает"""
    return {"message": "API работает! Открой /docs"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)