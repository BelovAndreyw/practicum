"""
Скрипт для создания тестовых данных (те же данные, что и в DEMO_MODE).

Запуск из корня проекта:
  python scripts/seed_data.py
"""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.demo_seed import LEGACY_DEMO_USERS, TEAMS_DATA, USERS_DATA, seed_demo_data


async def main() -> None:
    print("=" * 55)
    print("  СЕЕДЕР ТЕСТОВЫХ ДАННЫХ")
    print("=" * 55)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("\nТаблицы проверены/созданы")

    async with AsyncSessionLocal() as session:
        await seed_demo_data(session)
        await session.commit()

    print("\n" + "=" * 55)
    print("  ГОТОВО! Все данные созданы.")
    print("=" * 55)
    print("\nСводка по пользователям:")
    print("-" * 40)
    for u in LEGACY_DEMO_USERS + USERS_DATA:
        if not u.get("username"):
            print(f"  id={u['student_id']:3} | {u['surname']:10} {u['name']:8} | без аккаунта")
            continue
        print(
            f"  @{u['username']:12} | {u['surname']:10} {u['name']:8} "
            f"{u['patronymic']:12} | пароль: {u['password']}"
        )

    print("\nСводка по командам:")
    print("-" * 40)
    for t in TEAMS_DATA:
        captain = USERS_DATA[t["captain_index"]]
        members = [USERS_DATA[i] for i in t["member_indices"]]
        print(f"  Команда: {t['name']}")
        print(f"    Капитан: {captain['surname']} {captain['name']}")
        print(f"    Участники: {', '.join(m['surname'] + ' ' + m['name'] for m in members)}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
