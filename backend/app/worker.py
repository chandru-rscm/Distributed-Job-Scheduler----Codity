import asyncio
import os
import socket
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, update
import logging

from .database import AsyncSessionLocal, engine
from .models import Job, JobStatus, Worker, JobExecution

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

hostname = socket.gethostname()

async def register_worker(db: AsyncSession) -> Worker:
    # Register this worker in the DB
    worker = Worker(hostname=hostname, status="IDLE")
    db.add(worker)
    await db.commit()
    await db.refresh(worker)
    logger.info(f"Worker {worker.id} registered on {hostname}")
    return worker

async def update_heartbeat(worker_id: str):
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Worker)
                    .where(Worker.id == worker_id)
                    .values(last_heartbeat=datetime.now(timezone.utc))
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
        await asyncio.sleep(15)

async def claim_job(db: AsyncSession, worker_id: str):
    # The magical query for atomic claiming using FOR UPDATE SKIP LOCKED
    query = text("""
        UPDATE jobs
        SET status = 'CLAIMED', worker_id = :worker_id, updated_at = NOW()
        WHERE id = (
            SELECT id FROM jobs
            WHERE status IN ('QUEUED', 'SCHEDULED')
              AND scheduled_at <= NOW()
            ORDER BY priority DESC, scheduled_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING id, name, payload, retry_count, max_retries, backoff_strategy;
    """)
    result = await db.execute(query, {"worker_id": worker_id})
    job = result.fetchone()
    await db.commit()
    return job

async def execute_job(job):
    # Simulate job execution
    logger.info(f"Executing job: {job.name} (ID: {job.id})")
    await asyncio.sleep(2) # Fake work
    # if job.name == "fail_me":
    #     raise Exception("Simulated failure")
    return "Job completed successfully"

async def process_jobs(worker_id: str):
    while True:
        try:
            async with AsyncSessionLocal() as db:
                job = await claim_job(db, worker_id)
                if not job:
                    # No jobs available, sleep briefly
                    await asyncio.sleep(1)
                    continue

                logger.info(f"Worker {worker_id} claimed job {job.id}")
                
                # Update status to RUNNING
                await db.execute(update(Job).where(Job.id == job.id).values(status='RUNNING'))
                
                execution = JobExecution(
                    job_id=job.id,
                    worker_id=worker_id,
                    status="RUNNING",
                    started_at=datetime.now(timezone.utc)
                )
                db.add(execution)
                await db.commit()

                try:
                    result_msg = await execute_job(job)
                    execution.status = "SUCCESS"
                    execution.completed_at = datetime.now(timezone.utc)
                    execution.logs = result_msg
                    
                    await db.execute(update(Job).where(Job.id == job.id).values(status='COMPLETED'))
                    await db.commit()
                except Exception as e:
                    execution.status = "FAILED"
                    execution.completed_at = datetime.now(timezone.utc)
                    execution.error_message = str(e)
                    
                    # Handle Retry Logic
                    new_retry_count = job.retry_count + 1
                    if new_retry_count >= job.max_retries:
                        await db.execute(update(Job).where(Job.id == job.id).values(status='DLQ'))
                        logger.error(f"Job {job.id} failed permanently (DLQ)")
                    else:
                        # Simple backoff simulation: wait 5s for retry (In a real system, calculate based on backoff_strategy)
                        await db.execute(update(Job).where(Job.id == job.id).values(
                            status='QUEUED',
                            retry_count=new_retry_count,
                            scheduled_at=text("NOW() + INTERVAL '5 seconds'"),
                            worker_id=None
                        ))
                        logger.warning(f"Job {job.id} failed, scheduling retry {new_retry_count}/{job.max_retries}")
                    await db.commit()

        except Exception as e:
            logger.error(f"Worker error: {e}")
            await asyncio.sleep(2)

async def main():
    logger.info("Starting Worker Service...")
    async with AsyncSessionLocal() as db:
        worker = await register_worker(db)
    
    # Run heartbeat and job processor concurrently
    await asyncio.gather(
        update_heartbeat(worker.id),
        process_jobs(worker.id)
    )

if __name__ == "__main__":
    asyncio.run(main())
