import asyncio
from sqlalchemy import text
from app.db.session import async_session_factory

async def main():
    async with async_session_factory() as db:
        await db.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS pasture_area_ha FLOAT;"))
        await db.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS historical_mortality_rate FLOAT;"))
        await db.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS current_head_count FLOAT;"))
        await db.commit()
    print("Columns added successfully")

if __name__ == "__main__":
    asyncio.run(main())
