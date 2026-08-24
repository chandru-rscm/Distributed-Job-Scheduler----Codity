import asyncio
from app.database import AsyncSessionLocal
from app.models import Organization, Project

async def init_db():
    async with AsyncSessionLocal() as db:
        # Create default organization
        org = Organization(id="codity_org", name="Codity")
        db.add(org)
        
        # Create default project
        proj = Project(id="default", organization_id="codity_org", name="Default Project")
        db.add(proj)
        
        try:
            await db.commit()
            print("Default Org and Project created!")
        except Exception as e:
            print("Already exists or error:", e)

if __name__ == "__main__":
    asyncio.run(init_db())
