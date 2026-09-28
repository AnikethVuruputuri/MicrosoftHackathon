from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database.session import get_session, engine
from app.models.schemas import (
    Incident,
    IncidentEvent,
    AgentDiagnosis,
    HumanCorrection,
    MemoryReference,
    CorrectionRequest,
    ResolutionRequest,
    InvestigationRequest
)
from app.agent.graph import opsmemory_graph
from app.services.effectiveness import ResolutionEffectivenessEngine
from app.hindsight.client import hindsight_service

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[Incident])
def list_incidents(
    service_name: Optional[str] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session)
):
    query = select(Incident).order_by(Incident.id.desc())
    if service_name:
        query = query.where(Incident.service_name == service_name)
    if status:
        query = query.where(Incident.status == status)
    return session.exec(query).all()

@router.get("/{incident_id}")
def get_incident(incident_id: int, session: Session = Depends(get_session)):
    inc = session.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    events = session.exec(select(IncidentEvent).where(IncidentEvent.incident_id == inc.id).order_by(IncidentEvent.timestamp.asc())).all()
    diagnoses = session.exec(select(AgentDiagnosis).where(AgentDiagnosis.incident_id == inc.id).order_by(AgentDiagnosis.id.desc())).all()
    corrections = session.exec(select(HumanCorrection).where(HumanCorrection.incident_id == inc.id)).all()
    mem_refs = session.exec(select(MemoryReference).where(MemoryReference.incident_id == inc.id)).all()

    # Historical resolution effectiveness for this fingerprint
    effectiveness = ResolutionEffectivenessEngine.get_effectiveness_for_fingerprint(
        session, fingerprint=inc.failure_fingerprint, service_name=inc.service_name
    )

    return {
        "incident": inc.model_dump(),
        "events": [e.model_dump() for e in events],
        "diagnoses": [d.model_dump() for d in diagnoses],
        "corrections": [c.model_dump() for c in corrections],
        "memory_references": [m.model_dump() for m in mem_refs],
        "resolution_effectiveness": effectiveness
    }

@router.post("/{incident_id}/investigate")
async def investigate_incident(
    incident_id: int,
    session: Session = Depends(get_session)
):
    inc = session.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Initial State for LangGraph
    initial_state = {
        "incident_id": inc.id,
        "incident_code": inc.incident_code,
        "service": inc.service_name,
        "environment": inc.environment,
        "deployment_id": inc.deployment_id,
        "symptoms": inc.symptoms_summary,
        "current_logs": "",
        "current_changes": [],
        "failure_fingerprint": inc.failure_fingerprint or "",
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

    # Execute LangGraph graph asynchronously
    final_state = await opsmemory_graph.ainvoke(initial_state)

    # Refresh incident after graph execution
    session.refresh(inc)
    
    # Add investigation event
    event = IncidentEvent(
        incident_id=inc.id,
        event_type="agent_investigation_completed",
        stage_name="analyze_incident",
        summary="OpsMemory LangGraph investigation workflow completed.",
        details=final_state.get("initial_diagnosis", {}).get("diagnosis")
    )
    session.add(event)
    session.commit()

    return {
        "status": "success",
        "incident": inc.model_dump(),
        "diagnosis": final_state.get("initial_diagnosis"),
        "stage_logs": final_state.get("stage_logs"),
        "recalled_memories": final_state.get("recalled_memories"),
        "historical_corrections": final_state.get("historical_corrections"),
        "historical_resolutions": final_state.get("historical_resolutions")
    }

@router.post("/{incident_id}/correction")
async def submit_correction(
    incident_id: int,
    req: CorrectionRequest,
    session: Session = Depends(get_session)
):
    inc = session.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Construct state to route through handle_correction -> resolution -> retain_learning
    correction_state = {
        "incident_id": inc.id,
        "incident_code": inc.incident_code,
        "service": inc.service_name,
        "environment": inc.environment,
        "deployment_id": inc.deployment_id,
        "symptoms": inc.symptoms_summary,
        "current_logs": "",
        "current_changes": [],
        "failure_fingerprint": inc.failure_fingerprint or "PAYMENT_API_DB_POOL_PRODUCTION",
        "fingerprint_details": {},
        "recalled_memories": [],
        "historical_corrections": [],
        "historical_resolutions": [],
        "agent_hypotheses": [inc.confirmed_root_cause or "Initial hypothesis"],
        "initial_diagnosis": {"root_cause_hypothesis": inc.confirmed_root_cause or "Initial hypothesis"},
        "human_action": "correct",
        "human_correction": {
            "engineer_name": req.engineer_name,
            "correction_text": req.correction_text,
            "actual_root_cause": req.actual_root_cause,
            "suggested_action": req.suggested_action or "Increase DB pool size"
        },
        "confirmed_root_cause": req.actual_root_cause,
        "recommended_actions": [req.suggested_action or "Increase DB pool size"],
        "selected_action": req.suggested_action or "Increase DB pool size",
        "resolution_outcome": None,
        "learning_summary": None,
        "stage_logs": []
    }

    # Execute LangGraph graph with human correction branch
    final_state = await opsmemory_graph.ainvoke(correction_state)

    session.refresh(inc)

    # Record event
    event = IncidentEvent(
        incident_id=inc.id,
        event_type="human_correction",
        stage_name="human_review",
        summary=f"Engineer {req.engineer_name} corrected diagnosis: {req.actual_root_cause}",
        details=req.correction_text
    )
    session.add(event)
    session.commit()

    return {
        "status": "success",
        "message": "Correction applied and retained in Hindsight.",
        "incident": inc.model_dump(),
        "learning_summary": final_state.get("learning_summary"),
        "stage_logs": final_state.get("stage_logs")
    }

@router.post("/{incident_id}/resolution")
async def apply_resolution(
    incident_id: int,
    req: ResolutionRequest,
    session: Session = Depends(get_session)
):
    inc = session.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Construct state for resolution & retain
    res_state = {
        "incident_id": inc.id,
        "incident_code": inc.incident_code,
        "service": inc.service_name,
        "environment": inc.environment,
        "deployment_id": inc.deployment_id,
        "symptoms": inc.symptoms_summary,
        "current_logs": "",
        "current_changes": [],
        "failure_fingerprint": inc.failure_fingerprint or "PAYMENT_API_DB_POOL_PRODUCTION",
        "fingerprint_details": {},
        "recalled_memories": [],
        "historical_corrections": [],
        "historical_resolutions": [],
        "agent_hypotheses": [],
        "initial_diagnosis": {"root_cause_hypothesis": inc.confirmed_root_cause or "Resolved"},
        "human_action": "confirm",
        "human_correction": None,
        "confirmed_root_cause": inc.confirmed_root_cause,
        "recommended_actions": [req.remediation_action],
        "selected_action": req.remediation_action,
        "resolution_outcome": None,
        "learning_summary": None,
        "stage_logs": []
    }

    final_state = await opsmemory_graph.ainvoke(res_state)
    session.refresh(inc)

    return {
        "status": "success",
        "message": f"Remediation '{req.remediation_action}' recorded.",
        "incident": inc.model_dump(),
        "stage_logs": final_state.get("stage_logs")
    }
