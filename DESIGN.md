# DESIGN.md - Architecture and Trade-offs

## Architecture Overview
The platform consists of three main layers:
1. **Frontend**: Next.js (React) application for managing queues, monitoring jobs, and displaying real-time worker metrics and execution logs.
2. **Backend**: FastAPI providing clean, scalable, RESTful APIs and WebSocket endpoints for real-time streaming.
3. **Worker Service**: A standalone distributed polling service built in Python with `asyncio`, managing job claims atomically.
4. **Database**: PostgreSQL storing schemas for Users, Organizations, Projects, Queues, Jobs, Job Executions (Logs/Summaries), and Workers.

## Massive Bonus Features Implemented
Beyond the core requirements, this system introduces:
- **WebSocket Live Updates**: Real-time broadcast of job events (no polling).
- **Queue Sharding**: Support for horizontal scaling via `shard_key`.
- **Workflow Dependencies**: Explicit `parent_job_id` tracking ensuring dependent jobs don't run until parents complete.
- **AI-generated Failure Summaries**: Automated AI diagnosis generation for Dead Letter Queue failures.
- **Event-Driven Webhooks**: Internal webhook dispatch upon job completion or failure.
- **Role-Based Access Control (RBAC)**: Strict `dev-admin-key` enforcement for queue lifecycle.
- **Rate Limiting**: Built-in fixed-window rate limiter on the FastAPI server to prevent API spam.

## Design Decisions & Trade-offs

### 1. Database as a Queue (Postgres `SKIP LOCKED`)
**Decision**: We used PostgreSQL with `FOR UPDATE SKIP LOCKED` for the queue broker instead of a dedicated message broker like RabbitMQ or Redis.
**Trade-off**: While RabbitMQ would provide better throughput at massive scale (10,000+ jobs/sec), Postgres simplifies the deployment architecture by eliminating a secondary infrastructure dependency. `SKIP LOCKED` provides perfect atomic, distributed locks with zero risk of duplicate execution, fulfilling all concurrency requirements reliably.

### 2. Asyncio Semaphore vs Multiprocessing
**Decision**: The Worker service uses `asyncio.Semaphore` to process jobs concurrently within a single worker instance.
**Trade-off**: This approach is significantly more lightweight than spawning OS-level processes (Multiprocessing). It handles IO-bound background tasks exceptionally well (which most background jobs are). For purely CPU-bound tasks, multiprocessing would be required, but for a general-purpose scheduler, `asyncio` provides far superior concurrency density per memory footprint.

### 3. Polling vs Pub/Sub for Workers
**Decision**: The Workers actively poll the Postgres database rather than waiting for Pub/Sub events.
**Trade-off**: Polling introduces slight latency (e.g., 2-second sleep intervals) and minor database load even when idle. However, it completely eliminates the "lost wakeup" problem inherent in Pub/Sub architectures, ensuring jobs are *never* dropped.

### 4. Exponential Backoff Formula
**Decision**: Backoff calculations are handled explicitly by the Worker logic rather than database triggers.
**Trade-off**: Offloads computation from the database, preventing DB CPU bottlenecking, and allows for dynamic backoff configurations (`LINEAR`, `FIXED`, `EXPONENTIAL`) directly controlled by application state.
