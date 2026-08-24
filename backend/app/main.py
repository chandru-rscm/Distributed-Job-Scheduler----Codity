from fastapi import FastAPI, Depends, HTTPException, status, Header, WebSocket, WebSocketDisconnect, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import exc
from typing import List
from datetime import datetime
import uvicorn

from . import models, schemas
from .database import get_db, engine, Base

from fastapi.middleware.cors import CORSMiddleware

async def verify_api_key(x_api_key: str = Header("dev-secret-key")):
    if x_api_key != "dev-secret-key" and x_api_key != "dev-admin-key":
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_api_key

async def verify_admin(x_api_key: str = Header("dev-admin-key")):
    if x_api_key != "dev-admin-key":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return x_api_key

RATE_LIMIT = {}
async def rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now()
    if client_ip not in RATE_LIMIT:
        RATE_LIMIT[client_ip] = []
    RATE_LIMIT[client_ip] = [t for t in RATE_LIMIT[client_ip] if (now - t).total_seconds() < 60]
    if len(RATE_LIMIT[client_ip]) > 100:
        raise HTTPException(status_code=429, detail="Too Many Requests")
    RATE_LIMIT[client_ip].append(now)

app = FastAPI(
    title="Distributed Job Scheduler API",
    description="Peak engineering job scheduler API with atomic claiming and robust retry mechanics.",
    version="1.0.0",
    dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)

active_websockets: List[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        active_websockets.remove(websocket)

from pydantic import BaseModel
class WebhookPayload(BaseModel):
    job_id: str
    status: str

@app.post("/internal/webhook/")
async def internal_webhook(payload: WebhookPayload):
    # Broadcast to all connected clients
    for ws in active_websockets:
        try:
            await ws.send_json(payload.model_dump())
        except:
            pass
    return {"message": "Broadcasted"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/jobs/", response_model=List[schemas.JobResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_db), 
    skip: int = 0,
    limit: int = 20,
    status: str = None
):
    query = select(models.Job).order_by(models.Job.created_at.desc())
    if status:
        query = query.filter(models.Job.status == status)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@app.get("/jobs/{job_id}/executions")
async def get_job_executions(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.JobExecution)
        .filter(models.JobExecution.job_id == job_id)
        .order_by(models.JobExecution.started_at.desc())
    )
    return result.scalars().all()

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/jobs/batch", response_model=List[schemas.JobResponse], status_code=status.HTTP_201_CREATED)
async def enqueue_batch_jobs(jobs: List[schemas.JobCreate], db: AsyncSession = Depends(get_db)):
    db_jobs = []
    for job in jobs:
        db_job = models.Job(**job.model_dump())
        if job.scheduled_at:
            db_job.status = models.JobStatus.SCHEDULED
        db.add(db_job)
        db_jobs.append(db_job)
    try:
        await db.commit()
        for job in db_jobs:
            await db.refresh(job)
        return db_jobs
    except exc.IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Queue not found for one or more jobs")

@app.post("/queues/{queue_id}/pause", dependencies=[Depends(verify_admin)])
async def pause_queue(queue_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Queue).filter(models.Queue.id == queue_id))
    queue = result.scalars().first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    queue.is_paused = True
    await db.commit()
    return {"message": "Queue paused"}

@app.post("/queues/{queue_id}/resume", dependencies=[Depends(verify_admin)])
async def resume_queue(queue_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Queue).filter(models.Queue.id == queue_id))
    queue = result.scalars().first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    queue.is_paused = False
    await db.commit()
    return {"message": "Queue resumed"}

@app.post("/jobs/{job_id}/retry")
async def retry_failed_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Job).filter(models.Job.id == job_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (models.JobStatus.FAILED, models.JobStatus.DLQ):
        raise HTTPException(status_code=400, detail="Only FAILED or DLQ jobs can be retried")
    job.status = models.JobStatus.QUEUED
    job.retry_count = 0
    job.worker_id = None
    await db.commit()
    return {"message": "Job successfully queued for retry"}

@app.get("/workers/")
async def list_workers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Worker))
    return result.scalars().all()
