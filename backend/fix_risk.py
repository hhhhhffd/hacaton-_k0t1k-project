import asyncio
from app.db.session import async_session_factory
from app.db.models import Application
from sqlalchemy import update

async def fix():
    async with async_session_factory() as db:
        # Обновляем risk_level в зависимости от merit_score как в _determine_risk
        # 1. green: > 60
        await db.execute(update(Application).where(Application.merit_score >= 60).values(risk_level="green"))
        # 2. yellow: 30-59.9
        await db.execute(update(Application).where((Application.merit_score >= 30) & (Application.merit_score < 60)).values(risk_level="yellow"))
        # 3. red: < 30
        await db.execute(update(Application).where(Application.merit_score < 30).values(risk_level="red"))
        # 4. red: normativ == 0 or amount == 0
        await db.execute(update(Application).where((Application.normativ == 0) | (Application.amount == 0)).values(risk_level="red"))
        
        await db.commit()
    print("Fix applied successfully")

if __name__ == "__main__":
    asyncio.run(fix())
