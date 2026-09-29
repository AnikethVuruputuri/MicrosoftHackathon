import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func, desc

from app.database.session import get_session
from app.config import settings
from app.models.schemas import (
    AutomationPolicy,
    AutomationAction,
    AutomationEffectiveness,
    AutomationActionApprovalRequest,
    AutomationFeedbackRequest,
    AutomationPolicyUpdateRequest,
    AutomationSimulateRequest,
    Incident,
    AuditLog,
    utc_now
)
from app.services.automation.policy_engine import AutomationPolicyEngine, PolicyDecision
from app.services.automation.manager import automation_manager

logger = logging.getLogger("opsmemory.api.automation")

router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/status")
def get_automation_status(session: Session = Depends(get_session)):
    """Returns global and organization-level automation subsystem status."""
    engine = AutomationPolicyEngine(session)
    policy = engine.get_or_create_policy(org_id=1)
    
    pending_count = session.exec(
        select(func.count(AutomationAction.id)).where(
            AutomationAction.status == "awaiting_approval"
        )
    ).one()

    return {
        "status": "Operational",
        "global_enabled": settings.AUTOMATION_ENABLED,
        "org_enabled": policy.enabled,
        "mode": policy.mode,
        "dry_run": policy.dry_run or settings.AUTOMATION_DRY_RUN,
        "pending_approvals_count": pending_count,
        "max_attempts_per_incident": policy.max_attempts_per_incident,
        "allowed_environments": policy.allowed_environments.split(",") if policy.allowed_environments else []
    }


@router.get("/dashboard")
def get_automation_dashboard(session: Session = Depends(get_session)):
    """Aggregates metrics, pending approvals, recent actions, and recovery stats."""
    engine = AutomationPolicyEngine(session)
    policy = engine.get_or_create_policy(org_id=1)

    total_actions = session.exec(select(func.count(AutomationAction.id))).one()
    successful = session.exec(
        select(func.count(AutomationAction.id)).where(AutomationAction.status == "succeeded")
    ).one()
    pending = session.exec(
        select(func.count(AutomationAction.id)).where(AutomationAction.status == "awaiting_approval")
    ).one()
    blocked = session.exec(
        select(func.count(AutomationAction.id)).where(AutomationAction.status.in_(["blocked", "no_action"]))
    ).one()

    # Calculate average recovery time
    avg_rec = session.exec(
        select(func.avg(AutomationAction.recovery_time_seconds)).where(
            AutomationAction.status == "succeeded",
            AutomationAction.recovery_time_seconds != None
        )
    ).one() or 24.5

    pending_actions = session.exec(
        select(AutomationAction).where(AutomationAction.status == "awaiting_approval").order_by(desc(AutomationAction.created_at)).limit(10)
    ).all()

    recent_actions = session.exec(
        select(AutomationAction).order_by(desc(AutomationAction.created_at)).limit(20)
    ).all()

    effectiveness = session.exec(
        select(AutomationEffectiveness).limit(10)
    ).all()

    return {
        "metrics": {
            "total_actions": total_actions,
            "successful_recoveries": successful,
            "awaiting_approval": pending,
            "prevented_or_blocked": blocked,
            "avg_recovery_seconds": round(float(avg_rec), 1)
        },
        "pending_actions": pending_actions,
        "recent_actions": recent_actions,
        "effectiveness": effectiveness,
        "policy": policy
    }


@router.get("/actions", response_model=List[AutomationAction])
def list_automation_actions(
    status: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    incident_id: Optional[int] = Query(None),
    limit: int = Query(50, le=100),
    session: Session = Depends(get_session)
):
    """Lists automation actions with optional filtering."""
    query = select(AutomationAction)
    if status:
        query = query.where(AutomationAction.status == status)
    if action_type:
        query = query.where(AutomationAction.action_type == action_type)
    if incident_id:
        query = query.where(AutomationAction.incident_id == incident_id)
    
    query = query.order_by(desc(AutomationAction.created_at)).limit(limit)
    return session.exec(query).all()


@router.get("/actions/{action_id}", response_model=AutomationAction)
def get_automation_action(action_id: int, session: Session = Depends(get_session)):
    """Fetches details for a specific automation action."""
    action = session.get(AutomationAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Automation action not found.")
    return action


@router.post("/actions/{action_id}/approve")
async def approve_automation_action(
    action_id: int,
    request: AutomationActionApprovalRequest,
    session: Session = Depends(get_session)
):
    """Approves an action waiting in the approval gate and triggers execution."""
    action = session.get(AutomationAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Automation action not found.")

    if action.status not in ["awaiting_approval", "pending"]:
        raise HTTPException(
            status_code=400,
            detail=f"Action is in status '{action.status}' and cannot be approved."
        )

    action.approval_decision = "approved" if request.approved else "rejected"
    action.approved_by = request.approved_by
    action.approval_reason = request.reason
    action.approval_timestamp = utc_now()

    if not request.approved:
        action.status = "rejected"
        session.add(action)
        session.commit()
        session.refresh(action)

        # Audit log
        audit = AuditLog(
            org_id=action.org_id,
            actor=request.approved_by,
            action="AUTOMATION_ACTION_REJECTED",
            resource_type="automation_action",
            resource_id=action.action_code,
            details=f"Human SRE rejected {action.action_type} on {action.target}. Reason: {request.reason}"
        )
        session.add(audit)
        session.commit()
        return {"status": "rejected", "action": action.model_dump()}

    # If approved, execute recovery action
    executed_action = await automation_manager.execute_action(
        session=session,
        action_id=action.id,
        actor=request.approved_by
    )

    # Audit log
    audit = AuditLog(
        org_id=action.org_id,
        actor=request.approved_by,
        action="AUTOMATION_ACTION_APPROVED_AND_EXECUTED",
        resource_type="automation_action",
        resource_id=action.action_code,
        details=f"Human SRE approved {action.action_type} on {action.target}. Verification status: {executed_action.verification_status}"
    )
    session.add(audit)
    session.commit()
    session.refresh(executed_action)

    return {"status": "approved", "action": executed_action.model_dump()}


@router.post("/actions/{action_id}/reject")
def reject_automation_action(
    action_id: int,
    request: AutomationActionApprovalRequest,
    session: Session = Depends(get_session)
):
    """Rejects a pending automation action."""
    action = session.get(AutomationAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Automation action not found.")

    action.status = "rejected"
    action.approval_decision = "rejected"
    action.approved_by = request.approved_by
    action.approval_reason = request.reason or "Rejected by engineer"
    action.approval_timestamp = utc_now()
    action.updated_at = utc_now()

    audit = AuditLog(
        org_id=action.org_id,
        actor=request.approved_by,
        action="AUTOMATION_ACTION_REJECTED",
        resource_type="automation_action",
        resource_id=action.action_code,
        details=f"Action rejected by {request.approved_by}: {request.reason}"
    )
    session.add(action)
    session.add(audit)
    session.commit()
    session.refresh(action)

    return {"status": "rejected", "action": action.model_dump()}



@router.post("/actions/{action_id}/feedback")
def submit_automation_feedback(
    action_id: int,
    request: AutomationFeedbackRequest,
    session: Session = Depends(get_session)
):
    """Records human engineer feedback ('appropriate', 'inappropriate', 'neutral')."""
    if request.feedback not in ["appropriate", "inappropriate", "neutral"]:
        raise HTTPException(status_code=400, detail="Invalid feedback type. Must be appropriate, inappropriate, or neutral.")
    
    updated_action = automation_manager.record_feedback(
        session=session,
        action_id=action_id,
        feedback=request.feedback,
        notes=request.notes
    )
    return {"status": "success", "action": updated_action.model_dump()}



@router.post("/simulate")
async def simulate_automation_scenario(
    request: AutomationSimulateRequest,
    session: Session = Depends(get_session)
):
    """
    Runs a benchmark simulation scenario (Scenario A, B, C, or D)
    to demonstrate deterministic policy, dry-run, approval gating, and learning retention.
    """
    result = await automation_manager.simulate_scenario(
        session=session,
        scenario=request.scenario,
        dry_run=request.dry_run,
        service_name=request.service_name,
        org_id=1
    )
    return result


@router.get("/settings", response_model=AutomationPolicy)
def get_automation_settings(session: Session = Depends(get_session)):
    """Fetches organization automation policy configuration."""
    engine = AutomationPolicyEngine(session)
    return engine.get_or_create_policy(org_id=1)


@router.put("/settings", response_model=AutomationPolicy)
def update_automation_settings(
    request: AutomationPolicyUpdateRequest,
    session: Session = Depends(get_session)
):
    """Updates organization automation policy configuration."""
    engine = AutomationPolicyEngine(session)
    policy = engine.get_or_create_policy(org_id=1)

    if request.enabled is not None:
        policy.enabled = request.enabled
    if request.mode is not None:
        policy.mode = request.mode
    if request.dry_run is not None:
        policy.dry_run = request.dry_run
    if request.allow_retry is not None:
        policy.allow_retry = request.allow_retry
    if request.max_retries is not None:
        policy.max_retries = request.max_retries
    if request.allow_restart is not None:
        policy.allow_restart = request.allow_restart
    if request.max_restarts is not None:
        policy.max_restarts = request.max_restarts
    if request.allow_rollback is not None:
        policy.allow_rollback = request.allow_rollback
    if request.rollback_approval_required is not None:
        policy.rollback_approval_required = request.rollback_approval_required
    if request.allowed_environments is not None:
        policy.allowed_environments = request.allowed_environments
    if request.escalation_channel is not None:
        policy.escalation_channel = request.escalation_channel

    policy.updated_at = utc_now()
    session.add(policy)
    session.commit()
    session.refresh(policy)

    # Audit log
    audit = AuditLog(
        org_id=1,
        actor="DevOps Engineer",
        action="AUTOMATION_POLICY_UPDATED",
        resource_type="automation_policy",
        resource_id=str(policy.id),
        details=f"Updated automation policy: enabled={policy.enabled}, mode={policy.mode}, dry_run={policy.dry_run}"
    )
    session.add(audit)
    session.commit()

    return policy
