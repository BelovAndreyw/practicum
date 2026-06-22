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
}


def get_achievement(achievement_id: str) -> AchievementDef | None:
    return ACHIEVEMENT_CATALOG.get(achievement_id)
