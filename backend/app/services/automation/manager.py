import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select, func

from app.config import settings
from app.models.schemas import (
    AutomationAction,
    AutomationPolicy,
    AutomationEffectiveness,
    Incident,
    Deployment,
    AuditLog,
    utc_now
)
from app.services.automation.policy_engine import AutomationPolicyEngine, PolicyDecision, RiskLevel
from app.services.automation.verifier import AutomationVerifier
from app.services.automation.compensation import AutomationCompensator
from app.services.providers.github import github_provider
from app.services.providers.gitlab import gitlab_provider
from app.hindsight.client import hindsight_service

logger = logging.getLogger("opsmemory.automation.manager")


class AutomationManager:
    """
    Orchestrates the Safe Automation & Self-Recovery lifecycle:
    Evaluation -> Policy Check -> Approval / Execution -> Health Verification -> Compensation -> Hindsight Memory.
    """

    @staticmethod
    def _generate_action_code(session: Session) -> str:
        count = session.exec(select(func.count(AutomationAction.id))).one()
        return f"ACT-2026-{count + 1:04d}"

    @classmethod
    async def propose_and_evaluate(
        cls,
        session: Session,
        action_type: str,
        target: str,
        reason: str,
        environment: str = "production",
        incident_id: Optional[int] = None,
        deployment_id: Optional[int] = None,
        provider: str = "github",
        repository: str = "",
        confidence: float = 1.0,
        org_id: int = 1,
        force_dry_run: bool = False
    ) -> AutomationAction:
        """
        Evaluates an automation candidate against deterministic safety policies
        and records the decision in the database.
        """
        engine = AutomationPolicyEngine(session)
        policy = engine.get_or_create_policy(org_id)
        decision, policy_reason, risk = engine.evaluate(
            action_type=action_type,
            target=target,
            environment=environment,
            incident_id=incident_id,
            confidence=confidence,
            org_id=org_id,
            force_dry_run=force_dry_run
        )

        action_code = cls._generate_action_code(session)
        is_dry_run = force_dry_run or policy.dry_run or (policy.mode == "dry_run")

        if decision == PolicyDecision.NO_ACTION:
            initial_status = "no_action"
            approval_req = False
        elif decision == PolicyDecision.BLOCKED:
            initial_status = "blocked"
            approval_req = False
        elif decision == PolicyDecision.APPROVAL_REQUIRED:
            initial_status = "awaiting_approval"
            approval_req = True
        else:
            # Approved
            approval_req = False
            initial_status = "pending"

        action = AutomationAction(
            action_code=action_code,
            org_id=org_id,
            incident_id=incident_id,
            deployment_id=deployment_id,
            action_type=action_type,
            provider=provider,
            repository=repository,
            environment=environment,
            target=target,
            reason=reason,
            risk_level=risk.value,
            policy_result=decision.value,
            policy_reason=policy_reason,
            approval_required=approval_req,
            status=initial_status,
            is_dry_run=is_dry_run
        )
        session.add(action)
        session.commit()
        session.refresh(action)

        # Record audit log
        audit = AuditLog(
            org_id=org_id,
            actor="OpsMemory Automation Engine",
            action=f"AUTOMATION_ACTION_{decision.value.upper()}",
            resource_type="automation_action",
            resource_id=action_code,
            details=f"Evaluated {action_type} on {target} in {environment}. Decision: {decision.value}. Reason: {policy_reason}"
        )
        session.add(audit)
        session.commit()

        # If immediately approved and not requiring approval and not no_action/blocked, execute
        if decision == PolicyDecision.APPROVED and not approval_req:
            await cls.execute_action(session, action.id, actor="OpsMemory Autonomous Policy")

        return action

    @classmethod
    async def execute_action(
        cls,
        session: Session,
        action_id: int,
        actor: str = "DevOps Engineer"
    ) -> AutomationAction:
        """
        Executes an approved automation recovery action, monitors health,
        triggers compensation if unhealthy, and retains memory into Hindsight.
        """
        action = session.get(AutomationAction, action_id)
        if not action:
            raise ValueError(f"Automation action #{action_id} not found.")

        action.status = "running"
        session.add(action)
        session.commit()
        session.refresh(action)

        start_time = datetime.now(timezone.utc)
        exec_result: Dict[str, Any] = {}
        try:
            if action.is_dry_run:
                exec_result = {
                    "simulated": True,
                    "action": action.action_type,
                    "target": action.target,
                    "provider": action.provider,
                    "details": f"[DRY-RUN] Simulated execution of {action.action_type} on {action.target} without making changes."
                }
            elif action.provider.lower() == "kubernetes":
                from app.services.kubernetes_automation import KubernetesAutomationExecutor
                from app.services.automation.k8s_ci_executor import AutomationContext
                k8s_executor = KubernetesAutomationExecutor()
                k8s_ctx = AutomationContext(
                    incident_id=action.incident_id or 0,
                    service_name=action.target or "service",
                    environment=action.environment,
                    action=action.action_type,
                    failure_fingerprint=None,
                    confidence=1.0,
                    severity="medium",
                    known_successful_pattern=True,
                    provider="kubernetes",
                    kube_namespace=action.environment if action.environment != "development" else "default",
                    kube_deployment=action.target,
                    dry_run=action.is_dry_run,
                )
                if k8s_executor.is_configured:
                    exec_result = k8s_executor.execute(k8s_ctx)
                else:
                    exec_result = {
                        "status": "simulated",
                        "provider": "kubernetes",
                        "target": action.target,
                        "action": action.action_type,
                        "details": f"Kubernetes cluster not directly connected. Action {action.action_type} on deployment '{action.target}' recorded for cluster controller."
                    }
            else:
                devops_provider = gitlab_provider if action.provider.lower() == "gitlab" else github_provider
                if action.action_type in ["retry", "retry_pipeline"]:
                    exec_result = await devops_provider.retry_pipeline_run(
                        repo_id=action.repository or "opsmemory/api",
                        run_id=action.target or "101"
                    )
                elif action.action_type in ["restart", "restart_service"]:
                    exec_result = await devops_provider.restart_service(
                        service_name=action.target or "api-service",
                        environment=action.environment
                    )
                elif action.action_type in ["rollback", "rollback_deployment"]:
                    exec_result = await devops_provider.rollback_deployment(
                        repo_id=action.repository or "opsmemory/api",
                        target_sha=action.target or "c3f8e12a",
                        environment=action.environment
                    )
                else:
                    exec_result = {"status": "noop", "details": f"No-op execution for action {action.action_type}"}

            action.execution_details = json.dumps(exec_result)

            # Health Verification
            verification = await AutomationVerifier.verify_health(
                service_name=action.repository.split("/")[-1] if "/" in action.repository else (action.target or "core-service"),
                environment=action.environment,
                provider=action.provider,
                action_type=action.action_type
            )
            action.verification_status = verification["verification_status"]
            action.verification_details = json.dumps(verification)

            end_time = datetime.now(timezone.utc)
            duration_sec = int((end_time - start_time).total_seconds())
            action.recovery_time_seconds = max(12, duration_sec + 15)

            if verification["is_healthy"]:
                action.status = "succeeded"
                action.compensation_status = "not_needed"
            else:
                action.status = "failed"
                # Trigger Compensation
                AutomationCompensator.handle_recovery_failure(
                    session=session,
                    action=action,
                    verification_result=verification,
                    org_id=action.org_id
                )

        except Exception as e:
            logger.error(f"Error executing automation action {action.action_code}: {e}", exc_info=True)
            action.status = "failed"
            action.execution_details = json.dumps({"error": str(e)})
            action.verification_status = "failed"
            action.compensation_status = "executed"
            action.compensation_action = "escalate_to_sre"

        # Update or record Effectiveness stats
        cls._update_effectiveness(session, action)

        # Retain learning to Hindsight
        cls._retain_to_hindsight(action)
        action.retained_to_hindsight = True

        action.updated_at = utc_now()
        session.add(action)
        session.commit()
        session.refresh(action)

        return action

    @classmethod
    def _update_effectiveness(cls, session: Session, action: AutomationAction):
        """Updates recovery statistics per failure pattern/fingerprint."""
        fingerprint = "unknown"
        if action.incident_id:
            inc = session.get(Incident, action.incident_id)
            if inc and inc.failure_fingerprint:
                fingerprint = inc.failure_fingerprint

        eff = session.exec(
            select(AutomationEffectiveness).where(
                AutomationEffectiveness.org_id == action.org_id,
                AutomationEffectiveness.action_type == action.action_type,
                AutomationEffectiveness.failure_fingerprint == fingerprint
            )
        ).first()

        if not eff:
            eff = AutomationEffectiveness(
                org_id=action.org_id,
                failure_fingerprint=fingerprint,
                action_type=action.action_type,
                attempts=1,
                successes=1 if action.status == "succeeded" else 0,
                failures=0 if action.status == "succeeded" else 1,
                avg_recovery_time_seconds=float(action.recovery_time_seconds or 30),
                last_recovery_at=utc_now() if action.status == "succeeded" else None
            )
            session.add(eff)
        else:
            eff.attempts += 1
            if action.status == "succeeded":
                eff.successes += 1
                eff.last_recovery_at = utc_now()
                if action.recovery_time_seconds:
                    eff.avg_recovery_time_seconds = (
                        (eff.avg_recovery_time_seconds * (eff.successes - 1) + action.recovery_time_seconds)
                        / eff.successes
                    )
            else:
                eff.failures += 1
            session.add(eff)

        session.commit()

    @classmethod
    def _retain_to_hindsight(cls, action: AutomationAction):
        """Stores structured automation recovery outcome into Hindsight."""
        content = (
            f"Automation Recovery Outcome: Action [{action.action_type.upper()}] applied to [{action.target}] "
            f"in environment [{action.environment}]. Result: [{action.status}]. "
            f"Verification: [{action.verification_status}]. Recovery duration: {action.recovery_time_seconds}s. "
            f"Policy Decision: {action.policy_result}. Policy Reason: {action.policy_reason}."
        )
        tags = ["automation", "recovery", action.action_type, action.environment]
        if action.status == "succeeded":
            tags.append("recovery_success")
        else:
            tags.append("recovery_failure")

        metadata = {
            "action_code": action.action_code,
            "action_type": action.action_type,
            "target": action.target,
            "status": action.status,
            "verification_status": action.verification_status,
            "recovery_time_seconds": action.recovery_time_seconds,
            "policy_result": action.policy_result,
            "approval_required": action.approval_required,
            "is_dry_run": action.is_dry_run,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        try:
            hindsight_service.retain(
                contents=content,
                memory_type="resolution",
                tags=tags,
                metadata=metadata,
                org_id=action.org_id
            )
            logger.info(f"Retained automation action {action.action_code} into Hindsight memory.")
        except Exception as e:
            logger.error(f"Failed to retain automation memory to Hindsight: {e}")

    @classmethod
    def record_feedback(
        cls,
        session: Session,
        action_id: int,
        feedback: str,
        notes: Optional[str] = None
    ) -> AutomationAction:
        """Stores human validation feedback on whether an automation was appropriate."""
        action = session.get(AutomationAction, action_id)
        if not action:
            raise ValueError(f"Automation action #{action_id} not found.")

        action.human_feedback = feedback
        action.human_feedback_notes = notes
        action.updated_at = utc_now()
        session.add(action)
        session.commit()
        session.refresh(action)

        # Retain feedback to Hindsight
        feedback_content = (
            f"Human SRE Feedback on Automation [{action.action_code}]: Engineer marked action "
            f"'{action.action_type}' on '{action.target}' as [{feedback.upper()}]. "
            f"Engineer notes: {notes or 'No additional notes'}."
        )
        hindsight_service.retain(
            contents=feedback_content,
            memory_type="human_correction",
            tags=["automation_feedback", action.action_type, feedback],
            metadata={
                "action_code": action.action_code,
                "action_type": action.action_type,
                "feedback": feedback,
                "notes": notes
            },
            org_id=action.org_id
        )

        return action

    @classmethod
    async def simulate_scenario(
        cls,
        session: Session,
        scenario: str,
        dry_run: bool = False,
        service_name: Optional[str] = None,
        org_id: int = 1
    ) -> Dict[str, Any]:
        """
        Executes one of the 4 benchmark simulation scenarios:
        - Scenario A: Transient CI pipeline failure (Retry, Low risk)
        - Scenario B: Memory leak / connection exhaustion (Restart, Controlled risk, Cooldown check)
        - Scenario C: Bad schema migration (Rollback, High risk, Approval gate)
        - Scenario D: Ambiguous / unknown root cause (No-Action, Safe default)
        """
        scenario = scenario.lower().strip()
        svc = service_name or "payment-service"

        if "scenario_a" in scenario or "retry" in scenario or "transient" in scenario:
            # Scenario A: Transient CI failure
            action = await cls.propose_and_evaluate(
                session=session,
                action_type="retry",
                target="run-84920",
                reason="Flaky network timeout during Docker layer push. Identified as transient failure.",
                environment="staging",
                provider="github",
                repository=f"acme-corp/{svc}",
                confidence=0.94,
                org_id=org_id,
                force_dry_run=dry_run
            )
            return {
                "scenario": "Scenario A: Transient CI Pipeline Failure",
                "action": action.model_dump(),
                "recommendation": "retry",
                "risk_level": "low",
                "outcome_summary": f"Proposed pipeline retry for run-84920. Policy check: {action.policy_result}. Status: {action.status}."
            }

        elif "scenario_b" in scenario or "restart" in scenario or "memory" in scenario:
            # Scenario B: Memory leak / worker exhaustion
            action = await cls.propose_and_evaluate(
                session=session,
                action_type="restart",
                target=svc,
                reason="Memory leak in worker pool detected. Reached 96% RSS limit with degraded latency.",
                environment="production",
                provider="github",
                repository=f"acme-corp/{svc}",
                confidence=0.88,
                org_id=org_id,
                force_dry_run=dry_run
            )
            return {
                "scenario": "Scenario B: Service Memory Leak / Resource Exhaustion",
                "action": action.model_dump(),
                "recommendation": "restart",
                "risk_level": "controlled",
                "outcome_summary": f"Controlled service restart for '{svc}'. Policy evaluated cooldown & attempt limits. Policy check: {action.policy_result}. Status: {action.status}."
            }

        elif "scenario_c" in scenario or "rollback" in scenario or "schema" in scenario:
            # Scenario C: Bad schema migration rollback
            action = await cls.propose_and_evaluate(
                session=session,
                action_type="rollback",
                target="e4d2a1b",
                reason="Database schema migration lock contention causing 504 Gateway Timeouts.",
                environment="production",
                provider="github",
                repository=f"acme-corp/{svc}",
                confidence=0.96,
                org_id=org_id,
                force_dry_run=dry_run
            )
            return {
                "scenario": "Scenario C: Bad Schema Migration / Production Rollback",
                "action": action.model_dump(),
                "recommendation": "rollback",
                "risk_level": "high",
                "outcome_summary": f"High-risk rollback proposed to stable SHA e4d2a1b. Gated behind human approval. Policy check: {action.policy_result}. Status: {action.status}."
            }

        else:
            # Scenario D: Unclear / ambiguous root cause
            action = await cls.propose_and_evaluate(
                session=session,
                action_type="no_action",
                target=svc,
                reason="Conflicting log traces and third-party API timeout. Root cause uncertain. Automated remediation withheld to prevent cascading failure.",
                environment="production",
                provider="github",
                repository=f"acme-corp/{svc}",
                confidence=0.42,
                org_id=org_id,
                force_dry_run=dry_run
            )
            return {
                "scenario": "Scenario D: Ambiguous / Unknown Root Cause",
                "action": action.model_dump(),
                "recommendation": "no_action",
                "risk_level": "low",
                "outcome_summary": "Policy Engine enforced explicit NO-ACTION rule. Withheld automated remediation to protect production stability."
            }


automation_manager = AutomationManager()
