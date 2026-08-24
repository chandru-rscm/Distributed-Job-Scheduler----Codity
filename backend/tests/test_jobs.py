import pytest
from app.models import JobStatus, BackoffStrategy
from app.schemas import JobCreate

def test_job_create_schema_validation():
    # Test valid job creation
    job_data = {
        "queue_id": "test-queue-123",
        "name": "send_email",
        "payload": {"to": "test@example.com"},
        "priority": 10
    }
    
    job = JobCreate(**job_data)
    assert job.queue_id == "test-queue-123"
    assert job.name == "send_email"
    assert job.priority == 10
    assert job.max_retries == 3
    assert job.backoff_strategy == BackoffStrategy.EXPONENTIAL

def test_job_create_invalid_schema():
    # Test missing required field (payload)
    job_data = {
        "queue_id": "test-queue-123",
        "name": "send_email"
    }
    
    with pytest.raises(ValueError):
        JobCreate(**job_data)

def test_job_status_enum():
    assert JobStatus.QUEUED == "QUEUED"
    assert JobStatus.DLQ == "DLQ"
