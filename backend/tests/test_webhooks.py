import hmac
import hashlib
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database.session import init_db
from app.database.seed import seed_database
from app.database.session import engine
from sqlmodel import Session, select
from app.models.schemas import AutomationIncidentSource, WebhookEvent
from app.services.queue import TaskQueue

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    seed_database()

client = TestClient(app)

def test_github_webhook_endpoint_with_signature():
    delivery_id = f"delivery-{uuid.uuid4()}"
    payload = {
        "repository": {"name": "payment-api", "owner": {"login": "acme"}},
        "workflow_run": {
            "id": 202,
            "name": "CI/CD Test",
            "head_branch": "main",
            "head_sha": "a7b8c9d",
            "conclusion": "failure",
            "actor": {"login": "alex.dev"},
            "head_commit": {"message": "fix connection settings"}
        }
    }
    raw_bytes = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(settings.GITHUB_WEBHOOK_SECRET.encode(), raw_bytes, hashlib.sha256).hexdigest()

    headers = {
        "X-GitHub-Event": "workflow_run",
        "X-GitHub-Delivery": delivery_id,
        "X-Hub-Signature-256": signature,
        "Content-Type": "application/json"
    }

    resp = client.post("/api/webhooks/github", content=raw_bytes, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    assert resp.json()["pipeline_status"] == "failed"

    # Test Idempotency: Send the exact same webhook delivery again
    resp_dup = client.post("/api/webhooks/github", content=raw_bytes, headers=headers)
    assert resp_dup.status_code == 200
    assert resp_dup.json()["status"] == "ignored"
    assert resp_dup.json()["reason"] == "duplicate_event"

def test_gitlab_webhook_endpoint():
    unique_pipe_id = int(uuid.uuid4().int % 100000)
    payload = {
        "object_kind": "pipeline",
        "project": {"name": "payment-api", "namespace": "fintech"},
        "object_attributes": {
            "id": unique_pipe_id,
            "ref": "main",
            "sha": "gl_c98f12a",
            "status": "failed"
        },
        "commit": {
            "id": "gl_c98f12a",
            "message": "GitLab CI failure",
            "author": {"name": "elena"}
        }
    }
    raw_bytes = json.dumps(payload).encode()
    headers = {
        "X-Gitlab-Event": "Pipeline Hook",
        "X-Gitlab-Token": settings.GITLAB_WEBHOOK_SECRET,
        "Content-Type": "application/json"
    }

    resp = client.post("/api/webhooks/gitlab", content=raw_bytes, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_failed_webhook_persists_exact_pipeline_source():
    with Session(engine) as session:
        webhook_event = WebhookEvent(
            provider="github",
            event_type="workflow_run",
            delivery_id=f"automation-{uuid.uuid4()}",
            payload_hash="test-hash",
            status="received",
        )
        session.add(webhook_event)
        session.commit()
        session.refresh(webhook_event)
        event_id = webhook_event.id

    queue = TaskQueue()
    await queue._handle_webhook({
        "webhook_event_id": event_id,
        "normalized_payload": {
            "provider": "github",
            "organization": "opsmemory-test-owner",
            "repository": "automation-test-repo",
            "pipeline_status": "failed",
            "pipeline_id": "998877",
            "environment": "staging",
            "commit_sha": "testsha",
            "commit_message": "test failure",
            "author": "test-user",
            "logs": "transient timeout",
        },
    })

    with Session(engine) as session:
        source = session.exec(
            select(AutomationIncidentSource)
            .where(AutomationIncidentSource.pipeline_id == "998877")
        ).first()
        assert source is not None
        assert source.provider == "github"
        assert source.repository == "opsmemory-test-owner/automation-test-repo"
        before_count = len(session.exec(
            select(AutomationIncidentSource).where(AutomationIncidentSource.pipeline_id == "998877")
        ).all())

    duplicate_event = WebhookEvent(
        provider="github",
        event_type="workflow_run",
        delivery_id=f"automation-duplicate-{uuid.uuid4()}",
        payload_hash="duplicate-test-hash",
        status="received",
    )
    with Session(engine) as session:
        session.add(duplicate_event)
        session.commit()
        session.refresh(duplicate_event)
        duplicate_event_id = duplicate_event.id

    await queue._handle_webhook({
        "webhook_event_id": duplicate_event_id,
        "normalized_payload": {
            "provider": "github",
            "organization": "opsmemory-test-owner",
            "repository": "automation-test-repo",
            "pipeline_status": "failed",
            "pipeline_id": "998877",
            "environment": "staging",
            "commit_sha": "testsha",
            "commit_message": "duplicate delivery",
            "author": "test-user",
            "logs": "transient timeout",
        },
    })
    with Session(engine) as session:
        matches = session.exec(
            select(AutomationIncidentSource).where(AutomationIncidentSource.pipeline_id == "998877")
        ).all()
        assert len(matches) == before_count
