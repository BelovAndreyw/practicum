from dataclasses import dataclass


@dataclass(frozen=True)
class AchievementDef:
    id: str
    title: str
    description: str
    icon: str


ACHIEVEMENT_CATALOG: dict[str, AchievementDef] = {
    "ach_x1": AchievementDef(
        id="ach_x1",
        title="Первый check-in",
        description="Отправьте первый еженедельный отчёт",
        icon="✅",
    ),
    "ach_x2": AchievementDef(
        id="ach_x2",
        title="Спаситель",
        description="Помогите другой команде в спасении",
        icon="🆘",
    ),
    "ach_x3": AchievementDef(
        id="ach_x3",
        title="Знаток биржи",
        description="Разместите предложение на бирже знаний",
        icon="💡",
    ),
    "ach_notes": AchievementDef(
        id="ach_notes",
        title="Создание лучших конспектов",
        description="Ваши конспекты признаны лучшими в потоке",
        icon="📝",
    ),
    "ach_first_aid": AchievementDef(
        id="ach_first_aid",
        title="Первая помощь",
        description="Первыми откликнулись на запрос о помощи",
        icon="🚑",
    ),
    "ach_workshop": AchievementDef(
        id="ach_workshop",
        title="Мастер воркшопов",
        description="Провели совместный воркшоп для других команд",
        icon="🎤",
    ),
    "ach_checklist": AchievementDef(
        id="ach_checklist",
        title="Чек-лист мастер",
        description="Создали полезный чек-лист по теме",
        icon="✔️",
    ),
    "ach_streak": AchievementDef(
        id="ach_streak",
        title="На волне",
        description="Три еженедельных check-in подряд",
        icon="🔥",
    ),
    "ach_team_player": AchievementDef(
        id="ach_team_player",
        title="Командный игрок",
        description="Активно участвуете в жизни команды",
        icon="🤝",
    ),
}


def get_achievement(achievement_id: str) -> AchievementDef | None:
    return ACHIEVEMENT_CATALOG.get(achievement_id)
