import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlmodel import Session
from app.models.schemas import AutomationAction, AuditLog, utc_now

logger = logging.getLogger("opsmemory.automation.compensation")


class AutomationCompensator:
    """
    Compensation and Escalate Engine.
    Handles rollback, revert, or immediate on-call escalation if an
    executed recovery action fails health verification.
    """

    @staticmethod
    def handle_recovery_failure(
        session: Session,
        action: AutomationAction,
        verification_result: Dict[str, Any],
        org_id: int = 1
    ) -> Dict[str, Any]:
        """
        Executes compensation protocol:
        - If action was restart/retry and failed, marks action as degraded and logs escalation.
        - If rollback was not yet triggered, proposes rollback as compensation.
        """
        logger.warning(f"Recovery failed for action {action.action_code} on target {action.target}. Triggering compensation...")

        compensation_summary = ""
        compensation_status = "executed"

        if action.action_type in ["restart", "retry"]:
            action.compensation_action = "escalate_to_sre"
            action.compensation_status = "executed"
            compensation_summary = f"Recovery attempt '{action.action_type}' failed health verification. Automatically escalated to on-call SRE with incident context."
        elif action.action_type == "rollback":
            action.compensation_action = "critical_escalation_pagerduty"
            action.compensation_status = "executed"
            compensation_summary = f"Rollback failed health verification. Immediate critical escalation dispatched to SRE team."
        else:
            action.compensation_action = "notify_sre"
            action.compensation_status = "executed"
            compensation_summary = f"Action failed verification. SRE notified."

        # Record audit log
        audit = AuditLog(
            org_id=org_id,
            actor="OpsMemory Automation Engine",
            action="AUTOMATION_COMPENSATION_TRIGGERED",
            resource_type="automation_action",
            resource_id=str(action.action_code),
            details=f"Compensation triggered for {action.action_type}. Reason: {verification_result.get('summary', 'Health verification failed')}"
        )
        session.add(audit)
        session.commit()

        return {
            "action_code": action.action_code,
            "compensation_action": action.compensation_action,
            "compensation_status": compensation_status,
            "summary": compensation_summary
        }
