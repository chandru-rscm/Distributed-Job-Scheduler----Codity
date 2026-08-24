from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import exc
from typing import List
import uvicorn

from . import models, schemas
from .database import get_db, engine, Base

app = FastAPI(
    title="Distributed Job Scheduler API",
    description="Peak engineering job scheduler API with atomic claiming and robust retry mechanics.",
    version="1.0.0"
)

# API Endpoints for Organization, Project, Queue, Job

@app.post("/organizations/", response_model=schemas.OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(org: schemas.OrganizationCreate, db: AsyncSession = Depends(get_db)):
    db_org = models.Organization(name=org.name)
    db.add(db_org)
    await db.commit()
    await db.refresh(db_org)
    return db_org

@app.post("/projects/", response_model=schemas.ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: schemas.ProjectCreate, db: AsyncSession = Depends(get_db)):
    db_proj = models.Project(organization_id=project.organization_id, name=project.name)
    db.add(db_proj)
    try:
        await db.commit()
        await db.refresh(db_proj)
        return db_proj
    except exc.IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Organization not found")

@app.post("/queues/", response_model=schemas.QueueResponse, status_code=status.HTTP_201_CREATED)
async def create_queue(queue: schemas.QueueCreate, db: AsyncSession = Depends(get_db)):
    db_queue = models.Queue(**queue.model_dump())
    db.add(db_queue)
    try:
        await db.commit()
        await db.refresh(db_queue)
        return db_queue
    except exc.IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Project not found or Queue already exists")

@app.get("/queues/", response_model=List[schemas.QueueResponse])
async def list_queues(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Queue))
    return result.scalars().all()

@app.post("/jobs/", response_model=schemas.JobResponse, status_code=status.HTTP_201_CREATED)
async def enqueue_job(job: schemas.JobCreate, db: AsyncSession = Depends(get_db)):
    db_job = models.Job(**job.model_dump())
    if job.scheduled_at:
        db_job.status = models.JobStatus.SCHEDULED
        
    db.add(db_job)
    try:
        await db.commit()
        await db.refresh(db_job)
        return db_job
    except exc.IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Queue not found")

@app.get("/jobs/{job_id}", response_model=schemas.JobResponse)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Job).filter(models.Job.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/health")
async def health_check():
    return {"status": "ok"}
