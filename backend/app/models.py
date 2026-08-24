from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON, Boolean, Text, Index, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    SCHEDULED = "SCHEDULED"
    CLAIMED = "CLAIMED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DLQ = "DLQ"

class BackoffStrategy(str, enum.Enum):
    FIXED = "FIXED"
    LINEAR = "LINEAR"
    EXPONENTIAL = "EXPONENTIAL"

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    organizations = relationship("Organization", back_populates="owner")

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    owner_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    owner = relationship("User", back_populates="organizations")
    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=generate_uuid)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization", back_populates="projects")
    queues = relationship("Queue", back_populates="project", cascade="all, delete-orphan")

class Queue(Base):
    __tablename__ = "queues"
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    concurrency_limit = Column(Integer, default=10)
    is_paused = Column(Boolean, default=False)
    default_max_retries = Column(Integer, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    project = relationship("Project", back_populates="queues")
    jobs = relationship("Job", back_populates="queue", cascade="all, delete-orphan")

    __table_args__ = (Index('ix_queue_project_name', 'project_id', 'name', unique=True),)

class Worker(Base):
    __tablename__ = "workers"
    id = Column(String, primary_key=True, default=generate_uuid)
    hostname = Column(String, nullable=False)
    status = Column(String, default="IDLE") # IDLE, BUSY, OFFLINE
    last_heartbeat = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    claimed_jobs = relationship("Job", back_populates="worker")

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, default=generate_uuid)
    queue_id = Column(String, ForeignKey("queues.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED, nullable=False)
    priority = Column(Integer, default=0) # Higher number = higher priority
    scheduled_at = Column(DateTime(timezone=True), server_default=func.now())
    cron_expression = Column(String, nullable=True)
    
    # Retry policy
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    backoff_strategy = Column(Enum(BackoffStrategy), default=BackoffStrategy.EXPONENTIAL)
    
    worker_id = Column(String, ForeignKey("workers.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    queue = relationship("Queue", back_populates="jobs")
    worker = relationship("Worker", back_populates="claimed_jobs")
    executions = relationship("JobExecution", back_populates="job", cascade="all, delete-orphan")

    # Critical index for highly concurrent polling: status + scheduled_at + priority
    __table_args__ = (Index('ix_job_polling', 'status', 'scheduled_at', 'priority'),)

class JobExecution(Base):
    __tablename__ = "job_executions"
    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(String, ForeignKey("workers.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, nullable=False) # SUCCESS, FAILED
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    logs = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    job = relationship("Job", back_populates="executions")
