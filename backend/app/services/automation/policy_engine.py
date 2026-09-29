import logging
from enum import Enum
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select, func
from app.config import settings
from app.models.schemas import AutomationPolicy, AutomationAction, utc_now

logger = logging.getLogger("opsmemory.automation.policy")


class RiskLevel(str, Enum):
    LOW = "low"
    CONTROLLED = "controlled"
    HIGH = "high"
    VERY_HIGH = "very_high"


class PolicyDecision(str, Enum):
    APPROVED = "approved"
    APPROVAL_REQUIRED = "approval_required"
    BLOCKED = "blocked"
    NO_ACTION = "no_action"


class AutomationPolicyEngine:
    """
    Deterministic Safety & Policy Engine.
    LLMs only recommend candidates; the Policy Engine strictly enforces
    blast-radius, cooldowns, environment whitelists, attempt limits,
    and mandatory human-approval gates.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_or_create_policy(self, org_id: int = 1) -> AutomationPolicy:
        """Retrieves org automation policy or initializes default safe policy."""
        policy = self.session.exec(
            select(AutomationPolicy).where(AutomationPolicy.org_id == org_id)
        ).first()
        if not policy:
            policy = AutomationPolicy(
                org_id=org_id,
                enabled=settings.AUTOMATION_ENABLED,
                mode="approval_required",
                dry_run=settings.AUTOMATION_DRY_RUN,
                allow_retry=True,
                max_retries=2,
                retry_cooldown_seconds=300,
                allow_restart=True,
                max_restarts=1,
                restart_cooldown_seconds=600,
                allow_rollback=True,
                rollback_approval_required=True,
                rollback_cooldown_seconds=1800,
                health_timeout_seconds=120,
                verification_interval_seconds=10,
                max_attempts_per_incident=2,
                allowed_environments="staging,development,production",
                escalation_channel="slack"
            )
            self.session.add(policy)
            self.session.commit()
            self.session.refresh(policy)
        return policy

    def classify_risk(self, action_type: str, environment: str = "production") -> RiskLevel:
        """Determines action risk tier based on action type and environment."""
        action = (action_type or "").lower().strip()
        is_prod = environment.lower() == "production"

        if action in ["no_action", "monitor", "notify"]:
            return RiskLevel.LOW
        elif action in ["retry", "retry_pipeline", "re_run"]:
            return RiskLevel.LOW
        elif action in ["restart", "restart_service", "scale"]:
            return RiskLevel.CONTROLLED if not is_prod else RiskLevel.CONTROLLED
        elif action in ["rollback", "rollback_deployment"]:
            return RiskLevel.HIGH
        elif action in ["schema_migration_revert", "database_restore", "drop_table"]:
            return RiskLevel.VERY_HIGH
        return RiskLevel.CONTROLLED

    def evaluate(
        self,
        action_type: str,
        target: str,
        environment: str = "production",
        incident_id: Optional[int] = None,
        confidence: float = 1.0,
        org_id: int = 1,
        force_dry_run: bool = False
    ) -> Tuple[PolicyDecision, str, RiskLevel]:
        """
        Evaluates deterministic rules for candidate automation action.
        Returns (PolicyDecision, reason, RiskLevel).
        """
        policy = self.get_or_create_policy(org_id)
        risk = self.classify_risk(action_type, environment)
        action = (action_type or "").lower().strip()

        # Rule 1: Explicit No-Action / Low Confidence
        if action in ["no_action", "none", "unknown"]:
            return PolicyDecision.NO_ACTION, "Root cause uncertain or manual SRE investigation required.", RiskLevel.LOW

        if confidence < 0.65:
            return (
                PolicyDecision.APPROVAL_REQUIRED,
                f"Confidence ({confidence:.2f}) below autonomous threshold (0.65). SRE review mandatory.",
                risk
            )

        # Rule 2: Global & Org Feature Flag Check
        if not settings.AUTOMATION_ENABLED and not policy.enabled and not force_dry_run:
            return (
                PolicyDecision.BLOCKED,
                "Automation subsystem is disabled. Enable in Settings -> Automation & Recovery.",
                risk
            )

        # Rule 3: Environment Whitelist
        allowed_envs = [e.strip().lower() for e in (policy.allowed_environments or "").split(",") if e.strip()]
        if environment.lower() not in allowed_envs and not force_dry_run:
            return (
                PolicyDecision.BLOCKED,
                f"Environment '{environment}' is not in allowed environments ({policy.allowed_environments}).",
                risk
            )

        # Rule 4: Action-Specific Permission Gates
        if action in ["retry", "retry_pipeline"] and not policy.allow_retry:
            return PolicyDecision.BLOCKED, "Pipeline retries are disabled by policy.", risk
        if action in ["restart", "restart_service"] and not policy.allow_restart:
            return PolicyDecision.BLOCKED, "Service restarts are disabled by policy.", risk
        if action in ["rollback", "rollback_deployment"] and not policy.allow_rollback:
            return PolicyDecision.BLOCKED, "Deploy rollbacks are disabled by policy.", risk

        # Rule 5: Loop Protection - Max Attempts per Incident
        if incident_id:
            incident_actions_count = self.session.exec(
                select(func.count(AutomationAction.id)).where(
                    AutomationAction.incident_id == incident_id,
                    AutomationAction.status.in_(["running", "succeeded", "failed", "awaiting_approval"])
                )
            ).one()
            if incident_actions_count >= policy.max_attempts_per_incident:
                return (
                    PolicyDecision.BLOCKED,
                    f"Max automation attempts ({policy.max_attempts_per_incident}) reached for this incident. Escalating to human SRE.",
                    risk
                )

        # Rule 6: Loop Protection - Action Cooldowns
        cooldown_map = {
            "retry": policy.retry_cooldown_seconds,
            "retry_pipeline": policy.retry_cooldown_seconds,
            "restart": policy.restart_cooldown_seconds,
            "restart_service": policy.restart_cooldown_seconds,
            "rollback": policy.rollback_cooldown_seconds,
            "rollback_deployment": policy.rollback_cooldown_seconds,
        }
        cooldown_seconds = cooldown_map.get(action, 300)
        cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)

        recent_action = self.session.exec(
            select(AutomationAction).where(
                AutomationAction.org_id == org_id,
                AutomationAction.action_type.in_([action, action.replace("_deployment", "").replace("_service", "").replace("_pipeline", "")]),
                AutomationAction.target == target,
                AutomationAction.created_at >= cutoff_time,
                AutomationAction.status.in_(["running", "succeeded", "failed"])
            )
        ).first()

        if recent_action and not force_dry_run:
            seconds_ago = int((datetime.now(timezone.utc) - recent_action.created_at.replace(tzinfo=timezone.utc if recent_action.created_at.tzinfo is None else recent_action.created_at.tzinfo)).total_seconds())
            remaining = max(0, cooldown_seconds - seconds_ago)
            return (
                PolicyDecision.BLOCKED,
                f"Cooldown active for {action} on {target}. Must wait {remaining}s before next attempt.",
                risk
            )

        # Rule 7: Approval Required Gates
        # Rollback in production ALWAYS requires approval unless policy mode is fully autonomous AND rollback_approval_required is False
        if action in ["rollback", "rollback_deployment"] and policy.rollback_approval_required:
            return (
                PolicyDecision.APPROVAL_REQUIRED,
                "Rollback actions require human confirmation to prevent unintended state loss.",
                risk
            )

        if policy.mode == "approval_required" and not force_dry_run:
            return (
                PolicyDecision.APPROVAL_REQUIRED,
                "Policy mode is set to 'Approval Required'. SRE confirmation required before execution.",
                risk
            )

        # If all checks pass
        return (
            PolicyDecision.APPROVED,
            "All deterministic safety constraints and cooldown checks passed.",
            risk
        )
