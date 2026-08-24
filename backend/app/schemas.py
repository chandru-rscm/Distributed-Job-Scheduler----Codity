from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime
from .models import JobStatus, BackoffStrategy

class JobCreate(BaseModel):
    queue_id: str
    name: str
    payload: Dict[str, Any]
    priority: int = 0
    scheduled_at: Optional[datetime] = None
    cron_expression: Optional[str] = None
    parent_job_id: Optional[str] = None
    shard_key: str = "shard-0"
    max_retries: int = 3
    backoff_strategy: BackoffStrategy = BackoffStrategy.EXPONENTIAL

class JobResponse(JobCreate):
    id: str
    status: JobStatus
    retry_count: int
    worker_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QueueCreate(BaseModel):
    project_id: str
    name: str
    concurrency_limit: int = 10
    shard_key: str = "shard-0"
    default_max_retries: int = 3

class QueueResponse(QueueCreate):
    id: str
    is_paused: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    organization_id: str
    name: str
    webhook_url: Optional[str] = None

class ProjectResponse(ProjectCreate):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class OrganizationCreate(BaseModel):
    name: str

class OrganizationResponse(OrganizationCreate):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
