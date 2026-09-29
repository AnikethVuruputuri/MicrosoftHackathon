import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import init_db
from app.database.seed import seed_database
from sqlmodel import Session, select
from app.database.session import engine
from app.models.schemas import AutomationRun, Incident, ResolutionOutcome

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    seed_database()

client = TestClient(app)

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

def test_dashboard_endpoint():
    resp = client.get("/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "learning_metrics" in data
    assert "historical_effectiveness" in data

def test_deployments_list():
    resp = client.get("/api/deployments")
    assert resp.status_code == 200
    assert len(resp.json()) >= 10

def test_incidents_list():
    resp = client.get("/api/incidents")
    assert resp.status_code == 200
    assert len(resp.json()) >= 5

def test_system_status():
    resp = client.get("/api/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["backend"] == "Operational"
    assert "groq_status" in data
    assert "hindsight_status" in data

def test_automation_endpoint_fails_closed_by_default():
    incidents = client.get("/api/incidents").json()
    response = client.post(
        f"/api/incidents/{incidents[0]['id']}/automation",
        json={"action": "retry", "approved_by_human": True},
    )

    assert response.status_code == 200
    assert response.json()["status"] != "succeeded"
    assert response.json()["allowed"] is False

def test_automation_setting_is_persisted_and_reports_executor_readiness():
    enabled = client.put("/api/system/automation", json={"enabled": True})
    loaded = client.get("/api/system/automation")
    disabled = client.put("/api/system/automation", json={"enabled": False})

    assert enabled.status_code == 200
    assert enabled.json()["enabled"] is True
    assert enabled.json()["ready"] is False
    assert isinstance(enabled.json()["executor_configured"], bool)
    assert loaded.json()["enabled"] is True
    assert disabled.json()["enabled"] is False

def test_automation_target_requires_https_and_persists_configuration():
    insecure = client.put("/api/system/automation/target", json={
        "provider": "github",
        "repository": "acme/payment-api",
        "health_check_url": "http://health.example.com/ready",
    })
    configured = client.put("/api/system/automation/target", json={
        "provider": "github",
        "repository": "acme/payment-api",
        "health_check_urls": [
            "https://health.example.com/ready",
            "https://metrics.example.com/health",
        ],
    })
    loaded = client.get("/api/system/automation")

    assert insecure.status_code == 400
    assert configured.status_code == 200
    assert configured.json()["target_configured"] is True
    assert loaded.json()["repository"] == "acme/payment-api"
    assert loaded.json()["health_check_url"] == "https://health.example.com/ready"
    assert loaded.json()["health_check_urls"] == [
        "https://health.example.com/ready",
        "https://metrics.example.com/health",
    ]
    assert loaded.json()["ready"] is False

def test_emergency_stop_and_per_service_policy_round_trip():
    stopped = client.put("/api/system/automation/emergency-stop", json={"enabled": True})
    settings_response = client.get("/api/system/automation")
    resumed = client.put("/api/system/automation/emergency-stop", json={"enabled": False})
    policy_response = client.put("/api/system/automation/policies/payment-api", json={
        "enabled": False,
        "cooldown_seconds": 1800,
        "max_attempts": 2,
        "health_check_count": 5,
        "health_check_interval_seconds": 10,
    })
    policies = client.get("/api/system/automation/policies").json()
    policy = next(item for item in policies if item["service_name"] == "payment-api")

    assert stopped.json()["emergency_stop"] is True
    assert settings_response.json()["emergency_stop"] is True
    assert settings_response.json()["ready"] is False
    assert resumed.json()["emergency_stop"] is False
    assert policy_response.status_code == 200
    assert policy["enabled"] is False
    assert policy["cooldown_seconds"] == 1800
    assert policy["max_attempts"] == 2
    assert policy["health_check_count"] == 5
    assert policy["health_check_interval_seconds"] == 10

def test_automation_success_requires_human_confirmation_before_trusted_learning():
    with Session(engine) as session:
        incident = session.exec(select(Incident)).first()
        assert incident is not None
        run = AutomationRun(
            org_id=incident.org_id,
            incident_id=incident.id,
            provider="github",
            repository="acme/payment-api",
            pipeline_id="confirmed-test-run",
            action="retry",
            status="succeeded",
            reason="CI and health checks passed.",
            execution_attempted=True,
            health_check_passed=True,
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id
        fingerprint = incident.failure_fingerprint or "unknown"
        service_name = incident.service_name
        before = session.exec(select(ResolutionOutcome).where(
            ResolutionOutcome.failure_fingerprint == fingerprint,
            ResolutionOutcome.service_name == service_name,
            ResolutionOutcome.engineer_confirmed.is_(True),
        )).all()

    runs = client.get("/api/system/automation/runs")
    confirmed = client.post(f"/api/system/automation/runs/{run_id}/confirm", json={"notes": "Verified"})

    assert runs.status_code == 200
    assert any(item["id"] == run_id for item in runs.json())
    assert confirmed.status_code == 200
    with Session(engine) as session:
        after = session.exec(select(ResolutionOutcome).where(
            ResolutionOutcome.failure_fingerprint == fingerprint,
            ResolutionOutcome.service_name == service_name,
            ResolutionOutcome.engineer_confirmed.is_(True),
        )).all()
        saved_run = session.get(AutomationRun, run_id)
        assert saved_run.human_confirmed is True
        assert len(after) == len(before) + 1

def test_kubernetes_target_requires_workload_and_service_action_opt_ins():
    incomplete = client.put("/api/system/automation/target", json={
        "provider": "kubernetes",
        "repository": "acme/payment-api",
        "health_check_urls": ["https://payment.example.com/ready"],
    })
    configured = client.put("/api/system/automation/target", json={
        "provider": "kubernetes",
        "repository": "acme/payment-api",
        "health_check_urls": ["https://payment.example.com/ready"],
        "kube_namespace": "production",
        "kube_deployment": "payment-api",
        "kube_context": "prod-cluster",
    })
    policy_response = client.put("/api/system/automation/policies/payment-api", json={
        "enabled": True,
        "allow_retry": True,
        "allow_restart": True,
        "allow_rollback": True,
        "cooldown_seconds": 900,
        "max_attempts": 1,
        "health_check_count": 3,
        "health_check_interval_seconds": 5,
    })
    loaded = client.get("/api/system/automation")
    policy = next(
        item for item in client.get("/api/system/automation/policies").json()
        if item["service_name"] == "payment-api"
    )

    assert incomplete.status_code == 400
    assert configured.status_code == 200
    assert loaded.json()["provider"] == "kubernetes"
    assert loaded.json()["kube_namespace"] == "production"
    assert loaded.json()["kube_deployment"] == "payment-api"
    assert policy_response.status_code == 200
    assert policy["allow_restart"] is True
    assert policy["allow_rollback"] is True

def test_kubernetes_automation_is_disabled_and_dry_run_by_default_then_configurable():
    enabled_dry_run = client.put("/api/system/automation/kubernetes", json={
        "enabled": True,
        "dry_run": True,
    })
    settings_response = client.get("/api/system/automation")
    enabled_live = client.put("/api/system/automation/kubernetes", json={
        "enabled": True,
        "dry_run": False,
    })
    restored_safe_default = client.put("/api/system/automation/kubernetes", json={
        "enabled": False,
        "dry_run": True,
    })

    assert enabled_dry_run.status_code == 200
    assert settings_response.json()["kubernetes_enabled"] is True
    assert settings_response.json()["kubernetes_dry_run"] is True
    assert enabled_live.json()["kubernetes_enabled"] is True
    assert enabled_live.json()["kubernetes_dry_run"] is False
    assert restored_safe_default.json() == {"kubernetes_enabled": False, "kubernetes_dry_run": True}

def test_dry_run_preview_cannot_be_confirmed_as_recovery():
    with Session(engine) as session:
        incident = session.exec(select(Incident)).first()
        assert incident is not None
        run = AutomationRun(
            org_id=incident.org_id,
            incident_id=incident.id,
            provider="kubernetes",
            repository="acme/payment-api",
            pipeline_id="preview-only",
            action="rollback",
            status="dry_run",
            reason="Plan only.",
            dry_run=True,
            target_namespace="production",
            target_deployment="payment-api",
            plan_json='{"target_revision": 1}',
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id

    response = client.post(f"/api/system/automation/runs/{run_id}/confirm", json={})

    assert response.status_code == 409
