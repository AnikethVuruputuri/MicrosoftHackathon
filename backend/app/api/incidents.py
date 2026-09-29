import json
import logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from app.database.session import get_session, engine
from app.models.schemas import (
    Incident,
    IncidentEvent,
    AgentDiagnosis,
    HumanCorrection,
    MemoryReference,
    CorrectionRequest,
    ResolutionRequest,
    InvestigationRequest,
    AutomationRequest,
    ResolutionOutcome,
    AuditLog,
    User,
    AutomationSettings,
    AutomationGuard,
    AutomationServicePolicy,
    AutomationRun,
    AutomationTarget,
    AutomationIncidentSource,
    Integration,
)
from app.agent.graph import opsmemory_graph
from app.services.effectiveness import ResolutionEffectivenessEngine
from app.hindsight.client import hindsight_service
from app.config import settings
from app.api.auth import get_current_user
from app.services.automation import (
    AutomationContext,
    automation_executor,
    execute_automation,
)
from app.services.security import decrypt_secret

router = APIRouter(prefix="/incidents", tags=["Incidents"])
logger = logging.getLogger("opsmemory.api.incidents")

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
    automation_runs = session.exec(
        select(AutomationRun)
        .where(AutomationRun.incident_id == inc.id)
        .order_by(AutomationRun.started_at.desc())
    ).all()

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
        "automation_runs": [run.model_dump() for run in automation_runs],
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
        "resolution_outcome": {
            "success": req.success,
            "recovery_time_minutes": req.recovery_time_minutes,
            "notes": req.notes,
        },
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


@router.post("/{incident_id}/automation")
def run_incident_automation(
    incident_id: int,
    req: AutomationRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    incident = session.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must authorize remediation")

    diagnosis = session.exec(
        select(AgentDiagnosis)
        .where(AgentDiagnosis.incident_id == incident_id)
        .order_by(AgentDiagnosis.id.desc())
    ).first()
    successful_matches = session.exec(
        select(func.count(ResolutionOutcome.id)).where(
            ResolutionOutcome.failure_fingerprint == (incident.failure_fingerprint or ""),
            ResolutionOutcome.service_name == incident.service_name,
            ResolutionOutcome.success.is_(True),
            ResolutionOutcome.engineer_confirmed.is_(True),
        )
    ).one()
    automation_config = session.exec(
        select(AutomationSettings).where(AutomationSettings.org_id == user.org_id)
    ).first()
    emergency_guard = session.exec(
        select(AutomationGuard).where(AutomationGuard.org_id == user.org_id)
    ).first()
    service_policy = session.exec(
        select(AutomationServicePolicy).where(
            AutomationServicePolicy.org_id == user.org_id,
            AutomationServicePolicy.service_name == incident.service_name,
        )
    ).first()
    target = session.exec(
        select(AutomationTarget).where(AutomationTarget.org_id == user.org_id)
    ).first()
    source = session.exec(
        select(AutomationIncidentSource).where(AutomationIncidentSource.incident_id == incident_id)
    ).first()
    integration = session.exec(
        select(Integration).where(
            Integration.org_id == user.org_id,
            Integration.provider == (source.provider if source else ""),
            Integration.status == "connected",
        )
    ).first()
    credential = decrypt_secret(integration.encrypted_token) if integration else None
    if integration and credential == integration.encrypted_token:
        credential = None
    previous_attempts = session.exec(
        select(func.count(AutomationRun.id)).where(
            AutomationRun.incident_id == incident_id,
            AutomationRun.execution_attempted.is_(True),
        )
    ).one()
    max_attempts = service_policy.max_attempts if service_policy else 1
    kubernetes_action = bool(
        target and target.provider == "kubernetes" and req.action in {"restart", "rollback"}
    )
    target_matches_source = bool(
        target and source
        and target.provider in {source.provider, "kubernetes"}
        and target.repository.casefold() == source.repository.casefold()
    )
    cooldown_seconds = service_policy.cooldown_seconds if service_policy else 900
    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)
    recent_service_run = session.exec(
        select(AutomationRun.id)
        .join(Incident, Incident.id == AutomationRun.incident_id)
        .where(
            AutomationRun.org_id == user.org_id,
            Incident.service_name == incident.service_name,
            AutomationRun.started_at >= cooldown_cutoff,
            AutomationRun.execution_attempted.is_(True),
        )
    ).first() if cooldown_seconds else None
    context = AutomationContext(
        incident_id=incident.id,
        service_name=incident.service_name,
        environment=incident.environment,
        action=req.action,
        failure_fingerprint=incident.failure_fingerprint,
        confidence=diagnosis.confidence_score if diagnosis else 0.0,
        severity=incident.severity,
        known_successful_pattern=successful_matches > 0,
        previous_attempts=previous_attempts,
        provider="kubernetes" if kubernetes_action else (source.provider if source else None),
        repository=source.repository if source else None,
        pipeline_id=source.pipeline_id if source else None,
        api_base_url=target.gitlab_api_url if target and target.provider == "gitlab" else None,
        health_check_url=target.health_check_url if target else None,
        credential=credential if target_matches_source and not kubernetes_action else None,
        credential_type=integration.auth_type if integration else "token",
        max_attempts=max_attempts,
        allow_retry=service_policy.allow_retry if service_policy else True,
        allow_restart=service_policy.allow_restart if service_policy else False,
        allow_rollback=service_policy.allow_rollback if service_policy else False,
        kube_namespace=target.kube_namespace if kubernetes_action else None,
        kube_deployment=target.kube_deployment if kubernetes_action else None,
        kube_context=target.kube_context if kubernetes_action else None,
        dry_run=bool(kubernetes_action and emergency_guard and emergency_guard.kubernetes_dry_run),
        health_check_count=service_policy.health_check_count if service_policy else settings.AUTOMATION_HEALTH_CHECK_COUNT,
        health_check_interval_seconds=service_policy.health_check_interval_seconds if service_policy else settings.AUTOMATION_HEALTH_CHECK_INTERVAL_SECONDS,
    )
    result = execute_automation(
        context,
        executor=automation_executor,
        automation_enabled=(
            bool(automation_config and automation_config.enabled)
            and settings.AUTOMATION_ENABLED
            and not (emergency_guard and emergency_guard.emergency_stop)
            and (not kubernetes_action or bool(emergency_guard and emergency_guard.kubernetes_enabled))
            and not (service_policy and not service_policy.enabled)
            and target_matches_source
            and (req.action == "retry" or kubernetes_action)
            and previous_attempts < max_attempts
            and not recent_service_run
        ),
        confidence_threshold=settings.AUTOMATION_CONFIDENCE_THRESHOLD,
        approved_by_human=req.approved_by_human,
    )
    raw_execution_data = result.get("execution_data")
    execution_data = raw_execution_data or {}
    run = AutomationRun(
        org_id=user.org_id,
        incident_id=incident.id,
        attempt_number=previous_attempts + 1,
        provider=source.provider if source else "unknown",
        repository=source.repository if source else "unknown",
        pipeline_id=source.pipeline_id if source else "unknown",
        action=result["action"],
        status=result["status"],
        reason=result["reason"],
        execution_attempted=result.get("execution_attempted", raw_execution_data is not None),
        dry_run=result["status"] == "dry_run",
        target_namespace=context.kube_namespace,
        target_deployment=context.kube_deployment,
        plan_json=json.dumps(execution_data["plan"], sort_keys=True) if execution_data.get("plan") else None,
        health_check_passed=result.get("health_check_passed"),
        compensation_attempted=result.get("compensated") is not None,
        compensated=result.get("compensated"),
        external_pipeline_id=execution_data.get("pipeline_id"),
        completed_at=datetime.now(timezone.utc),
    )
    session.add(run)

    session.add(IncidentEvent(
        incident_id=incident.id,
        event_type="automation_" + result["status"],
        stage_name="automation_policy",
        summary=f"Automation decision for {result['action']}: {result['status']}.",
        details=str(result),
    ))
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="incident_automation_attempted",
        resource_type="incident",
        resource_id=incident.incident_code,
        details=str(result),
    ))
    session.commit()
    session.refresh(run)

    try:
        hindsight_service.retain(
            contents=(
                f"Automation outcome for {incident.service_name} "
                f"[{incident.failure_fingerprint}]: action={result['action']}; "
                f"status={result['status']}; reason={result['reason']}"
            ),
            memory_type="automation_outcome",
            tags=[incident.service_name.lower(), (incident.failure_fingerprint or "unknown").lower(), "automation"],
            metadata={"incident_id": incident.id, **result},
        )
    except Exception:
        logger.exception("Could not retain automation outcome for incident %s", incident.id)

    return {"incident_id": incident.id, "automation_run_id": run.id, **result}
