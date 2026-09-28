import pytest
import asyncio
from sqlmodel import Session, select
from app.database.session import engine, init_db
from app.database.seed import seed_database
from app.models.schemas import Incident, Deployment, HumanCorrection
from app.agent.graph import opsmemory_graph
from app.hindsight.client import hindsight_service

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    seed_database()

@pytest.mark.asyncio
async def test_end_to_end_learning_loop():
    # 1. Start with Round 1 Incident (INC-101)
    with Session(engine) as session:
        inc = session.exec(select(Incident).where(Incident.incident_code == "INC-101")).first()
        assert inc is not None
        inc_id = inc.id

    # 2. Run initial LangGraph investigation
    state_round_1 = {
        "incident_id": inc_id,
        "incident_code": "INC-101",
        "service": "payment-api",
        "environment": "production",
        "deployment_id": None,
        "symptoms": "Redis connection timeout errors reported during checkout surges",
        "current_logs": "RedisConnectionTimeout: timed out after 500ms",
        "current_changes": [],
        "failure_fingerprint": "PAYMENT_API_DB_POOL_PRODUCTION",
        "fingerprint_details": {},
        "recalled_memories": [],
        "historical_corrections": [],
        "historical_resolutions": [],
        "agent_hypotheses": [],
        "initial_diagnosis": {},
        "human_action": None,
        "human_correction": None,
        "confirmed_root_cause": None,
        "recommended_actions": [],
        "selected_action": None,
        "resolution_outcome": None,
        "learning_summary": None,
        "stage_logs": []
    }

    res_1 = await opsmemory_graph.ainvoke(state_round_1)
    assert res_1["initial_diagnosis"] is not None

    # 3. Engineer Submits Correction
    state_correction = {
        **res_1,
        "human_action": "correct",
        "human_correction": {
            "engineer_name": "Senior SRE",
            "correction_text": "Redis is only a downstream symptom. PostgreSQL pool exhaustion is the real root cause.",
            "actual_root_cause": "PostgreSQL connection pool exhaustion",
            "suggested_action": "Increase DB pool size from 20 to 100"
        },
        "selected_action": "Increase DB pool size from 20 to 100"
    }

    res_corrected = await opsmemory_graph.ainvoke(state_correction)
    assert res_corrected["learning_summary"] is not None

    # 4. Verify Hindsight has retained the correction
    recalled = hindsight_service.recall("payment-api PAYMENT_API_DB_POOL_PRODUCTION")
    assert len(recalled) > 0
    assert any("PostgreSQL" in r["contents"] for r in recalled)

    # 5. Round 2: A new similar incident arrives (INC-127)
    state_round_2 = {
        "incident_id": inc_id,
        "incident_code": "INC-127",
        "service": "payment-api",
        "environment": "production",
        "deployment_id": None,
        "symptoms": "Redis connection timeout errors reported during checkout surges",
        "current_logs": "RedisConnectionTimeout: timed out after 500ms",
        "current_changes": [],
        "failure_fingerprint": "PAYMENT_API_DB_POOL_PRODUCTION",
        "fingerprint_details": {},
        "recalled_memories": [],
        "historical_corrections": [],
        "historical_resolutions": [],
        "agent_hypotheses": [],
        "initial_diagnosis": {},
        "human_action": None,
        "human_correction": None,
        "confirmed_root_cause": None,
        "recommended_actions": [],
        "selected_action": None,
        "resolution_outcome": None,
        "learning_summary": None,
        "stage_logs": []
    }

    res_2 = await opsmemory_graph.ainvoke(state_round_2)
    diag_text = res_2["initial_diagnosis"]["diagnosis"]

    # 6. Verify agent learned!
    assert "Hindsight" in diag_text or "previous" in diag_text.lower() or "PostgreSQL" in diag_text
    assert "PostgreSQL" in res_2["initial_diagnosis"]["root_cause_hypothesis"]
    assert "Increase DB" in res_2["initial_diagnosis"]["recommended_action"]
