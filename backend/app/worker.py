import asyncio
import os
import socket
import signal
import sys
import argparse
import aiohttp
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, update
import logging

from app.database import AsyncSessionLocal, engine
from app.models import Job, JobStatus, Worker, JobExecution, BackoffStrategy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

parser = argparse.ArgumentParser()
parser.add_argument("--shard", default="shard-0", help="Shard key to poll for")
args, unknown = parser.parse_known_args()
SHARD_KEY = args.shard

hostname = socket.gethostname()
shutdown_event = asyncio.Event()

def handle_sigint(sig, frame):
    logger.info("Received graceful shutdown signal. Waiting for running jobs to finish...")
    shutdown_event.set()

signal.signal(signal.SIGINT, handle_sigint)
signal.signal(signal.SIGTERM, handle_sigint)

async def register_worker(db: AsyncSession) -> Worker:
    worker = Worker(hostname=hostname, status="IDLE")
    db.add(worker)
    await db.commit()
    await db.refresh(worker)
    logger.info(f"Worker {worker.id} registered on {hostname}")
    return worker

async def update_heartbeat(worker_id: str):
    while not shutdown_event.is_set():
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
        
        # Sleep in small increments to allow quick shutdown
        for _ in range(15):
            if shutdown_event.is_set():
                break
            await asyncio.sleep(1)

async def claim_job(db: AsyncSession, worker_id: str):
    # Excludes jobs inside queues that are paused!
    query = text("""
        UPDATE jobs
        SET status = 'CLAIMED', worker_id = :worker_id, updated_at = NOW()
        WHERE id = (
            SELECT j.id FROM jobs j
            JOIN queues q ON j.queue_id = q.id
            WHERE j.status IN ('QUEUED', 'SCHEDULED')
              AND j.scheduled_at <= NOW()
              AND q.is_paused = FALSE
              AND j.shard_key = :shard_key
              AND (j.parent_job_id IS NULL OR EXISTS (
                  SELECT 1 FROM jobs p WHERE p.id = j.parent_job_id AND p.status = 'COMPLETED'
              ))
            ORDER BY j.priority DESC, j.scheduled_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING id, name, payload, retry_count, max_retries, backoff_strategy;
    """)
    result = await db.execute(query, {"worker_id": worker_id, "shard_key": SHARD_KEY})
    job = result.fetchone()
    await db.commit()
    return job

async def execute_job(job):
    logger.info(f"Executing job: {job.name} (ID: {job.id})")
    await asyncio.sleep(2) # Fake work
    if job.payload and job.payload.get("fail_me"):
        raise Exception("Simulated failure")
    return "Job completed successfully"

async def send_webhook(job_id: str, status: str):
    try:
        async with aiohttp.ClientSession() as session:
            await session.post("http://127.0.0.1:8000/internal/webhook/", json={"job_id": job_id, "status": status})
    except:
        pass

def generate_ai_summary(error_msg: str) -> str:
    # Simulated AI call
    return f"AI Diagnosis: Job failed due to '{error_msg}'. Recommendation: Verify external service availability or payload structure."

async def handle_job(worker_id: str, job):
    try:
        async with AsyncSessionLocal() as db:
            logger.info(f"Worker {worker_id} claimed job {job.id} on {SHARD_KEY}")
            await db.execute(update(Job).where(Job.id == job.id).values(status='RUNNING'))
            await send_webhook(job.id, "RUNNING")
            
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
                await send_webhook(job.id, "COMPLETED")
            except Exception as e:
                execution.status = "FAILED"
                execution.completed_at = datetime.now(timezone.utc)
                execution.error_message = str(e)
                
                new_retry_count = job.retry_count + 1
                if new_retry_count >= job.max_retries:
                    await db.execute(update(Job).where(Job.id == job.id).values(status='DLQ'))
                    execution.ai_summary = generate_ai_summary(str(e))
                    logger.error(f"Job {job.id} failed permanently (DLQ)")
                    await send_webhook(job.id, "DLQ")
                else:
                    # Configurable Backoff Strategy
                    base_delay = 5
                    if job.backoff_strategy == BackoffStrategy.FIXED:
                        delay = base_delay
                    elif job.backoff_strategy == BackoffStrategy.LINEAR:
                        delay = base_delay * new_retry_count
                    else: # EXPONENTIAL
                        delay = base_delay * (2 ** (new_retry_count - 1))
                    
                    next_run = datetime.now(timezone.utc) + timedelta(seconds=delay)
                    await db.execute(update(Job).where(Job.id == job.id).values(
                        status='QUEUED',
                        retry_count=new_retry_count,
                        scheduled_at=next_run,
                        worker_id=None
                    ))
                    logger.warning(f"Job {job.id} failed, retry {new_retry_count}/{job.max_retries} scheduled for {delay}s from now.")
                    await send_webhook(job.id, "QUEUED")
                await db.commit()
    except Exception as e:
        logger.error(f"Job handling error: {e}")

async def process_jobs(worker_id: str):
    # Concurrency using an asyncio Semaphore
    MAX_CONCURRENT_JOBS = 5
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
    active_tasks = set()

    while not shutdown_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                # Wait until we have capacity
                await semaphore.acquire()
                job = await claim_job(db, worker_id)
                
                if not job:
                    semaphore.release()
                    await asyncio.sleep(1)
                    continue
                
                # Fire and forget concurrent execution
                task = asyncio.create_task(handle_job(worker_id, job))
                active_tasks.add(task)
                
                # Cleanup task callback to release semaphore
                task.add_done_callback(lambda t: active_tasks.discard(t))
                task.add_done_callback(lambda t: semaphore.release())
                
        except Exception as e:
            logger.error(f"Worker polling error: {e}")
            semaphore.release()
            await asyncio.sleep(2)

    # Await remaining tasks before shutting down
    if active_tasks:
        logger.info(f"Waiting for {len(active_tasks)} active jobs to complete...")
        await asyncio.gather(*active_tasks, return_exceptions=True)
    logger.info("Worker fully shut down.")

async def main():
    logger.info("Starting Worker Service...")
    async with AsyncSessionLocal() as db:
        worker = await register_worker(db)
    
    await asyncio.gather(
        update_heartbeat(worker.id),
        process_jobs(worker.id)
    )

if __name__ == "__main__":
    asyncio.run(main())
