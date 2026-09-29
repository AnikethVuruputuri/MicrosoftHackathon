import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from app.main import app
from app.database.session import engine
from app.config import settings
from app.models.schemas import AutomationPolicy, AutomationAction, Incident
from app.services.automation.policy_engine import AutomationPolicyEngine, PolicyDecision, RiskLevel
from app.services.automation.manager import automation_manager

client = TestClient(app)


def test_automation_status_endpoint():
    response = client.get("/api/automation/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "global_enabled" in data
    assert "mode" in data
    assert "pending_approvals_count" in data


def test_feature_flag_blocks_when_disabled():
    with Session(engine) as session:
        engine_policy = AutomationPolicyEngine(session)
        policy = engine_policy.get_or_create_policy(org_id=1)
        policy.enabled = False
        session.add(policy)
        session.commit()

        # When global flag and org flag are False, action is blocked
        settings.AUTOMATION_ENABLED = False
        decision, reason, risk = engine_policy.evaluate(
            action_type="retry",
            target="run-101",
            environment="production",
            confidence=0.9
        )
        assert decision == PolicyDecision.BLOCKED
        assert "disabled" in reason.lower()


def test_deterministic_risk_classification():
    with Session(engine) as session:
        engine_policy = AutomationPolicyEngine(session)
        assert engine_policy.classify_risk("retry") == RiskLevel.LOW
        assert engine_policy.classify_risk("restart") == RiskLevel.CONTROLLED
        assert engine_policy.classify_risk("rollback") == RiskLevel.HIGH
        assert engine_policy.classify_risk("no_action") == RiskLevel.LOW


def test_loop_protection_max_attempts():
    import uuid
    uid = uuid.uuid4().hex[:8]
    with Session(engine) as session:
        engine_policy = AutomationPolicyEngine(session)
        policy = engine_policy.get_or_create_policy(org_id=1)
        policy.enabled = True
        session.add(policy)
        session.commit()

        # Create dummy incident
        inc = Incident(
            incident_code=f"INC-LOOP-{uid}",
            title="Loop Test",
            service_id=1,
            service_name="payment-service",
            environment="production",
            severity="high",
            status="investigating",
            symptoms_summary="Testing loop protection"
        )
        session.add(inc)
        session.commit()
        session.refresh(inc)

        # Insert 2 actions for this incident
        for i in range(2):
            act = AutomationAction(
                action_code=f"ACT-LOOP-{uid}-{i}",
                org_id=1,
                incident_id=inc.id,
                action_type="restart",
                status="succeeded"
            )
            session.add(act)
        session.commit()

        # 3rd attempt should be BLOCKED by loop protection
        decision, reason, _ = engine_policy.evaluate(
            action_type="restart",
            target="payment-service",
            environment="production",
            incident_id=inc.id,
            confidence=0.95
        )
        assert decision == PolicyDecision.BLOCKED
        assert "Max automation attempts" in reason


def test_explicit_no_action_for_ambiguous_incident():
    with Session(engine) as session:
        engine_policy = AutomationPolicyEngine(session)
        decision, reason, _ = engine_policy.evaluate(
            action_type="no_action",
            target="auth-service",
            environment="production",
            confidence=0.4
        )
        assert decision == PolicyDecision.NO_ACTION


def test_approval_gate_and_rejection():
    import uuid
    uid = uuid.uuid4().hex[:8]
    with Session(engine) as session:
        # Create an action requiring approval
        act = AutomationAction(
            action_code=f"ACT-GATE-{uid}",
            org_id=1,
            action_type="rollback",
            provider="github",
            target="c9a8b7c",
            environment="production",
            status="awaiting_approval",
            policy_result="approval_required",
            approval_required=True
        )
        session.add(act)
        session.commit()
        session.refresh(act)
        action_id = act.id

    # Test reject endpoint
    resp = client.post(
        f"/api/automation/actions/{action_id}/reject",
        json={"approved": False, "reason": "Unsafe time for rollback", "approved_by": "Senior SRE"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"
    assert data["action"]["status"] == "rejected"
    assert data["action"]["approval_decision"] == "rejected"


def test_simulation_scenarios():
    # Scenario A: Transient CI failure
    resp_a = client.post("/api/automation/simulate", json={"scenario": "transient_ci_failure", "dry_run": True})
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["recommendation"] == "retry"
    assert data_a["risk_level"] == "low"

    # Scenario B: Memory leak
    resp_b = client.post("/api/automation/simulate", json={"scenario": "memory_leak_service", "dry_run": True})
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["recommendation"] == "restart"

    # Scenario C: Bad schema migration rollback
    resp_c = client.post("/api/automation/simulate", json={"scenario": "bad_schema_rollback", "dry_run": True})
    assert resp_c.status_code == 200
    data_c = resp_c.json()
    assert data_c["recommendation"] == "rollback"
    assert data_c["risk_level"] == "high"

    # Scenario D: Ambiguous root cause (No action)
    resp_d = client.post("/api/automation/simulate", json={"scenario": "unclear_no_action", "dry_run": True})
    assert resp_d.status_code == 200
    data_d = resp_d.json()
    assert data_d["recommendation"] == "no_action"


def test_automation_feedback_and_dashboard():
    import uuid
    uid = uuid.uuid4().hex[:8]
    with Session(engine) as session:
        act = AutomationAction(
            action_code=f"ACT-FEEDBACK-{uid}",
            org_id=1,
            action_type="restart",
            provider="github",
            target="api-service",
            environment="production",
            status="succeeded"
        )
        session.add(act)
        session.commit()
        session.refresh(act)
        action_id = act.id

    # Post human feedback
    resp = client.post(
        f"/api/automation/actions/{action_id}/feedback",
        json={"feedback": "appropriate", "notes": "Restart promptly stabilized memory usage."}
    )
    assert resp.status_code == 200
    assert resp.json()["action"]["human_feedback"] == "appropriate"

    # Check dashboard aggregates
    dash_resp = client.get("/api/automation/dashboard")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "metrics" in dash_data
    assert "recent_actions" in dash_data
    assert "policy" in dash_data
