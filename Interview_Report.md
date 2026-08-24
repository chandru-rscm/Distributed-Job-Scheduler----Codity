# Interview Report: Distributed Job Scheduler

## Executive Summary
This project implements a robust, scalable Distributed Job Scheduler. It is designed to orchestrate background tasks across a fleet of worker machines, ensuring high availability, fault tolerance, and concurrency. The system is divided into a RESTful API backend, an autonomous worker pool, and a Next.js administrative dashboard.

## Technical Stack
- **Backend Framework:** FastAPI (Python)
- **Database:** PostgreSQL (Supabase)
- **ORM:** SQLAlchemy (Async)
- **Frontend:** Next.js (React) with custom CSS Grid/Flexbox
- **Migrations:** Alembic

## Core Features Implemented
1. **Multi-Tenant Architecture:** The database schema supports Organizations and Projects, allowing the scheduler to be offered as a SaaS product.
2. **Dynamic Queues:** Users can create isolated queues with specific concurrency limits.
3. **Atomic Job Claiming:** Using `FOR UPDATE SKIP LOCKED` inside a PostgreSQL subquery, the system completely avoids race conditions without the need for external distributed locks (like Redis Redlock).
4. **Resiliency:** Jobs that throw exceptions are caught, logged in a `job_executions` table, and automatically requeued for a retry.
5. **Dead Letter Queue (DLQ):** Jobs exceeding their `max_retries` limit are parked in a DLQ status, requiring manual intervention.
6. **Real-time Monitoring:** The Next.js dashboard polls the API to display active queues, system health, job success rates, and recent executions.

## Running the Automated Tests
Automated tests have been written using `pytest` to verify the schema validation and the integrity of critical data models.
To run the tests:
1. Navigate to the `backend` directory.
2. Activate the virtual environment.
3. Run `pytest tests/`

## Deployment Strategy
While currently configured for local development, the architecture is entirely cloud-native:
- **Database:** Already hosted on Supabase (Cloud).
- **Backend API:** Can be containerized via Docker and deployed to AWS ECS or Vercel.
- **Workers:** Can be deployed as background processes on AWS EC2 or Kubernetes pods, automatically scaling based on queue depth.
- **Frontend:** Can be deployed instantly via Vercel.
