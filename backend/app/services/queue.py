import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Callable
from sqlmodel import Session, select
from app.config import settings
from app.database.session import engine
from app.models.schemas import (
    WebhookEvent,
    Incident,
    Deployment,
    DeploymentChange,
    Repository,
    Pipeline,
    PipelineRun,
    AuditLog,
    AutomationIncidentSource,
    AutomationSettings,
    AutomationGuard,
    AutomationServicePolicy,
    AutomationRun,
    AutomationTarget,
    Integration,
    AgentDiagnosis,
    IncidentEvent,
    ResolutionOutcome,
)
from app.config import settings
from app.services.automation import (
    AutomationContext,
    automation_executor,
    execute_automation,
    select_automatic_action,
)
from app.services.security import decrypt_secret
from app.services.fingerprint import FailureFingerprintEngine
from app.services.risk_engine import DeploymentRiskEngine

logger = logging.getLogger("opsmemory.queue")

class TaskQueue:
    """
    Asynchronous Background Task Queue.
    Executes webhook processing, repository synchronization, pipeline monitoring,
    and memory retention asynchronously without blocking HTTP requests.
    """

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._is_running: bool = False
        self._worker_task: Optional[asyncio.Task] = None

    async def start(self):
        if not self._is_running:
            self._is_running = True
            self._worker_task = asyncio.create_task(self._worker_loop())
            logger.info("OpsMemory Background Task Queue worker started.")

    async def stop(self):
        self._is_running = False
        if self._worker_task:
            self._worker_task.cancel()

    def enqueue(self, task_name: str, payload: Dict[str, Any]):
        """Non-blocking enqueue for background execution."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._queue.put({"task": task_name, "payload": payload}))
        except RuntimeError:
            # If no running loop in thread, execute synchronously or create task
            pass

    async def _worker_loop(self):
        while self._is_running:
            try:
                item = await self._queue.get()
                task_name = item.get("task")
                payload = item.get("payload", {})
                
                logger.info(f"Processing background task: {task_name}")
                if task_name == "process_webhook":
                    await self._handle_webhook(payload)
                elif task_name == "sync_repository":
                    await self._handle_sync_repo(payload)
                elif task_name == "investigate_incident":
                    await self._handle_investigate(payload)
                
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in background task worker: {e}", exc_info=True)

    async def _handle_webhook(self, payload: Dict[str, Any]):
        event_id = payload.get("webhook_event_id")
        with Session(engine) as session:
            wb_event = session.get(WebhookEvent, event_id)
            if not wb_event:
                return

            wb_event.status = "processing"
            session.add(wb_event)
            session.commit()

            try:
                norm_data = payload.get("normalized_payload", {})
                provider = norm_data.get("provider", "github")
                repo_name = norm_data.get("repository", "payment-api")
                status = norm_data.get("pipeline_status", "in_progress")
                commit_sha = norm_data.get("commit_sha", "a7b8c9d")
                commit_msg = norm_data.get("commit_message", "Deployment update")
                author = norm_data.get("author", "dev")
                env = norm_data.get("environment", "production")
                logs = norm_data.get("logs") or ""
                pipeline_id = norm_data.get("pipeline_id")
                source_repository = "/".join(
                    part.strip("/") for part in [norm_data.get("organization", ""), repo_name] if part
                )
                existing_source = session.exec(
                    select(AutomationIncidentSource).where(
                        AutomationIncidentSource.provider == provider,
                        AutomationIncidentSource.repository == source_repository,
                        AutomationIncidentSource.pipeline_id == str(pipeline_id),
                    )
                ).first() if pipeline_id else None

                # If failed pipeline / deployment, create or link Incident
                if status == "failed" and not existing_source:
                    # Check or create repository record
                    repo = session.exec(select(Repository).where(Repository.name == repo_name)).first()
                    
                    # Create Deployment
                    last_dep = session.exec(select(Deployment).order_by(Deployment.deployment_number.desc())).first()
                    next_num = (last_dep.deployment_number + 1) if last_dep else 128

                    dep = Deployment(
                        deployment_number=next_num,
                        service_id=1,
                        service_name=repo_name,
                        environment=env,
                        commit_sha=commit_sha,
                        commit_message=commit_msg,
                        author=author,
                        status="failed",
                        risk_level="high",
                        risk_reason="Automated webhook detected CI/CD pipeline failure",
                        started_at=datetime.now(timezone.utc),
                        completed_at=datetime.now(timezone.utc),
                        logs_summary=logs[:300] if logs else "Pipeline health check failed",
                        raw_logs=logs or "Readiness probe failed on deployment rollout."
                    )
                    session.add(dep)
                    session.commit()
                    session.refresh(dep)

                    # Compute failure fingerprint
                    fp_info = FailureFingerprintEngine.generate(
                        service_name=repo_name,
                        environment=env,
                        changed_files=norm_data.get("changed_files", []),
                        logs=logs,
                        symptoms=commit_msg
                    )

                    # Create Incident
                    inc = Incident(
                        incident_code=f"INC-{next_num}",
                        title=f"CI/CD Failure on {repo_name} ({provider.upper()} #{next_num})",
                        service_id=1,
                        service_name=repo_name,
                        deployment_id=dep.id,
                        environment=env,
                        severity=norm_data.get("severity") or (
                            "low" if env.lower() in {"development", "dev", "test"}
                            else "medium" if env.lower() in {"staging", "stage"}
                            else "high"
                        ),
                        status="investigating",
                        failure_fingerprint=fp_info["fingerprint"],
                        symptoms_summary=f"Automated webhook ingestion from {provider.upper()}: Pipeline run failed on branch {norm_data.get('branch', 'main')}.",
                        detected_at=datetime.now(timezone.utc)
                    )
                    session.add(inc)
                    
                    # Add audit log
                    session.add(AuditLog(
                        org_id=1,
                        actor=f"{provider}_webhook",
                        action="incident_created",
                        resource_type="incident",
                        resource_id=f"INC-{next_num}",
                        details=f"Created incident INC-{next_num} from {provider} webhook delivery {wb_event.delivery_id}"
                    ))
                    session.commit()
                    session.refresh(inc)
                    if pipeline_id:
                        session.add(AutomationIncidentSource(
                            incident_id=inc.id,
                            provider=provider,
                            repository=source_repository,
                            pipeline_id=str(pipeline_id),
                        ))
                        session.commit()
                    self.enqueue("investigate_incident", {"incident_id": inc.id})

                wb_event.status = "processed"
                wb_event.processed_at = datetime.now(timezone.utc)
                session.add(wb_event)
                session.commit()
                logger.info(f"Successfully processed webhook event {event_id}")
            except Exception as e:
                wb_event.status = "error"
                wb_event.error_message = str(e)
                session.add(wb_event)
                session.commit()
                logger.error(f"Failed processing webhook event {event_id}: {e}")

    async def _handle_sync_repo(self, payload: Dict[str, Any]):
        repo_id = payload.get("repository_id")
        logger.info(f"Synchronized repository {repo_id}")

    async def _handle_investigate(self, payload: Dict[str, Any]):
        incident_id = payload.get("incident_id")
        from app.agent.graph import opsmemory_graph
        from app.models.schemas import Incident

        final_state = await opsmemory_graph.ainvoke({"incident_id": incident_id, "stage_logs": []})
        with Session(engine) as session:
            incident = session.get(Incident, incident_id)
            if incident:
                session.add(IncidentEvent(
                    incident_id=incident.id,
                    event_type="automated_investigation_completed",
                    stage_name="generate_diagnosis",
                    summary="Webhook-triggered investigation completed; remediation remains policy-gated.",
                    details=str(final_state.get("initial_diagnosis", {})),
                ))
                session.commit()
                automation_settings = session.exec(
                    select(AutomationSettings).where(AutomationSettings.org_id == incident.org_id)
                ).first()
                diagnosis = session.exec(
                    select(AgentDiagnosis)
                    .where(AgentDiagnosis.incident_id == incident.id)
                    .order_by(AgentDiagnosis.id.desc())
                ).first()
                recommendation = (diagnosis.recommended_action if diagnosis else "") or ""
                action = select_automatic_action(recommendation)
                target = session.exec(
                    select(AutomationTarget).where(AutomationTarget.org_id == incident.org_id)
                ).first()
                source = session.exec(
                    select(AutomationIncidentSource).where(
                        AutomationIncidentSource.incident_id == incident.id
                    )
                ).first()
                integration = session.exec(
                    select(Integration).where(
                        Integration.org_id == incident.org_id,
                        Integration.provider == (source.provider if source else ""),
                        Integration.status == "connected",
                    )
                ).first()
                provider_token = decrypt_secret(integration.encrypted_token) if integration else None
                if integration and provider_token == integration.encrypted_token:
                    provider_token = None
                target_matches_source = bool(
                    target and source
                    and target.provider in {source.provider, "kubernetes"}
                    and target.repository.casefold() == source.repository.casefold()
                )
                if automation_settings and automation_settings.enabled and action in {"retry", "restart", "rollback"}:
                    policy = session.exec(
                        select(AutomationServicePolicy).where(
                            AutomationServicePolicy.org_id == incident.org_id,
                            AutomationServicePolicy.service_name == incident.service_name,
                        )
                    ).first()
                    guard = session.exec(
                        select(AutomationGuard).where(AutomationGuard.org_id == incident.org_id)
                    ).first()
                    attempt_count = session.exec(
                        select(func.count(AutomationRun.id)).where(
                            AutomationRun.incident_id == incident.id,
                            AutomationRun.execution_attempted.is_(True),
                        )
                    ).one()
                    cooldown_seconds = policy.cooldown_seconds if policy else 900
                    max_attempts = policy.max_attempts if policy else 1
                    cutoff = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)
                    recent_service_run = session.exec(
                        select(AutomationRun.id)
                        .join(Incident, Incident.id == AutomationRun.incident_id)
                        .where(
                            AutomationRun.org_id == incident.org_id,
                            Incident.service_name == incident.service_name,
                            AutomationRun.started_at >= cutoff,
                            AutomationRun.execution_attempted.is_(True),
                        )
                    ).first() if cooldown_seconds else None
                    previous_reason = None
                    kubernetes_action = bool(
                        target and target.provider == "kubernetes" and action in {"restart", "rollback"}
                    )
                    if not settings.AUTOMATION_ENABLED:
                        previous_reason = "Server-level automation safety lock is active."
                    elif guard and guard.emergency_stop:
                        previous_reason = "Organization emergency stop is active."
                    elif policy and not policy.enabled:
                        previous_reason = "Automation is disabled for this service."
                    elif incident.severity.lower() not in {"low", "medium"}:
                        previous_reason = "Only low/medium severity incidents can be automated."
                    elif action == "retry" and policy and not policy.allow_retry:
                        previous_reason = "Automatic retry is disabled for this service."
                    elif action == "restart" and (not policy or not policy.allow_restart):
                        previous_reason = "Automatic restart is not enabled for this service."
                    elif action == "rollback" and (not policy or not policy.allow_rollback):
                        previous_reason = "Automatic rollback is not enabled for this service."
                    elif action in {"restart", "rollback"} and not kubernetes_action:
                        previous_reason = "Restart and rollback require a configured Kubernetes target."
                    elif kubernetes_action and not (guard and guard.kubernetes_enabled):
                        previous_reason = "Kubernetes automation is disabled for this organization."
                    elif attempt_count >= max_attempts:
                        previous_reason = "The configured automatic retry limit has been reached."
                    elif recent_service_run:
                        previous_reason = "A recent automation run is within the service cooldown period."
                    elif not target_matches_source:
                        previous_reason = "Configured automation target does not match the failed pipeline source."
                    elif kubernetes_action and (not target.kube_namespace or not target.kube_deployment):
                        previous_reason = "Kubernetes namespace and Deployment target are required."
                    elif not kubernetes_action and (not provider_token or "demo" in provider_token.lower()):
                        previous_reason = "A valid non-demo provider credential is required."

                    successful_matches = session.exec(
                        select(ResolutionOutcome.id).where(
                            ResolutionOutcome.failure_fingerprint == (incident.failure_fingerprint or ""),
                            ResolutionOutcome.service_name == incident.service_name,
                            ResolutionOutcome.success.is_(True),
                            ResolutionOutcome.engineer_confirmed.is_(True),
                        )
                    ).first()
                    if not previous_reason and not successful_matches:
                        previous_reason = "No engineer-confirmed successful outcome exists for this fingerprint."
                    if (
                        not previous_reason
                        and (not diagnosis or diagnosis.confidence_score < settings.AUTOMATION_CONFIDENCE_THRESHOLD)
                    ):
                        previous_reason = "Diagnosis confidence is below the configured threshold."
                    context = AutomationContext(
                        incident_id=incident.id,
                        service_name=incident.service_name,
                        environment=incident.environment,
                        action=action,
                        failure_fingerprint=incident.failure_fingerprint,
                        confidence=diagnosis.confidence_score if diagnosis else 0.0,
                        severity=incident.severity,
                        known_successful_pattern=successful_matches is not None,
                        previous_attempts=attempt_count,
                        provider="kubernetes" if kubernetes_action else (source.provider if source else None),
                        repository=source.repository if source else None,
                        pipeline_id=source.pipeline_id if source else None,
                        api_base_url=target.gitlab_api_url if target else None,
                        health_check_url=target.health_check_url if target else None,
                        credential=None if kubernetes_action else provider_token,
                        credential_type=integration.auth_type if integration else "token",
                        health_check_count=policy.health_check_count if policy else settings.AUTOMATION_HEALTH_CHECK_COUNT,
                        health_check_interval_seconds=policy.health_check_interval_seconds if policy else settings.AUTOMATION_HEALTH_CHECK_INTERVAL_SECONDS,
                        max_attempts=max_attempts,
                        allow_retry=policy.allow_retry if policy else True,
                        allow_restart=policy.allow_restart if policy else False,
                        allow_rollback=policy.allow_rollback if policy else False,
                        kube_namespace=target.kube_namespace if kubernetes_action else None,
                        kube_deployment=target.kube_deployment if kubernetes_action else None,
                        kube_context=target.kube_context if kubernetes_action else None,
                        dry_run=bool(kubernetes_action and guard and guard.kubernetes_dry_run),
                    )
                    if previous_reason:
                        result = {
                            "action": action,
                            "allowed": False,
                            "requires_approval": False,
                            "reason": previous_reason,
                            "status": "blocked",
                            "health_check_passed": None,
                            "compensated": None,
                            "execution_data": None,
                        }
                    else:
                        run = AutomationRun(
                            org_id=incident.org_id,
                            incident_id=incident.id,
                            attempt_number=attempt_count + 1,
                            provider=context.provider or "unknown",
                            repository=source.repository,
                            pipeline_id=source.pipeline_id,
                            action=action,
                            status="running",
                            reason="Planning Kubernetes action without cluster mutations." if context.dry_run else "Automation action dispatched; waiting for recovery checks.",
                            execution_attempted=not context.dry_run,
                            dry_run=context.dry_run,
                            target_namespace=context.kube_namespace,
                            target_deployment=context.kube_deployment,
                        )
                        session.add(run)
                        session.commit()
                        session.refresh(run)
                        result = await asyncio.to_thread(
                            execute_automation,
                            context,
                            executor=automation_executor,
                            automation_enabled=True,
                            confidence_threshold=settings.AUTOMATION_CONFIDENCE_THRESHOLD,
                        )
                    raw_execution_data = result.get("execution_data")
                    execution_data = raw_execution_data or {}
                    if previous_reason:
                        run = AutomationRun(
                            org_id=incident.org_id,
                            incident_id=incident.id,
                            attempt_number=attempt_count + 1,
                            provider=source.provider if source else "unknown",
                            repository=source.repository if source else "unknown",
                            pipeline_id=source.pipeline_id if source else "unknown",
                            action=action,
                            status=result["status"],
                            reason=result["reason"],
                            dry_run=result["status"] == "dry_run",
                            target_namespace=context.kube_namespace,
                            target_deployment=context.kube_deployment,
                            completed_at=datetime.now(timezone.utc),
                        )
                    else:
                        run.status = result["status"]
                        run.reason = result["reason"]
                        run.execution_attempted = result.get("execution_attempted", raw_execution_data is not None)
                        run.dry_run = result["status"] == "dry_run"
                        run.target_namespace = context.kube_namespace
                        run.target_deployment = context.kube_deployment
                        if execution_data.get("plan"):
                            run.plan_json = json.dumps(execution_data["plan"], sort_keys=True)
                        run.health_check_passed = result.get("health_check_passed")
                        run.compensation_attempted = result.get("compensated") is not None
                        run.compensated = result.get("compensated")
                        run.external_pipeline_id = execution_data.get("pipeline_id")
                        run.completed_at = datetime.now(timezone.utc)
                    session.add(run)
                    session.add(IncidentEvent(
                        incident_id=incident.id,
                        event_type="automation_" + result["status"],
                        stage_name="automation_policy",
                        summary=f"Automatic {action} decision: {result['status']}.",
                        details=str(result),
                    ))
                    session.add(AuditLog(
                        org_id=incident.org_id,
                        actor="automation_policy",
                        action="automatic_remediation_attempted",
                        resource_type="incident",
                        resource_id=incident.incident_code,
                        details=str(result),
                    ))
                    if result["status"] == "succeeded":
                        incident.status = "resolved"
                        incident.resolution_status = "success"
                        incident.remediation_applied = action
                    session.commit()
                    try:
                        from app.hindsight.client import hindsight_service

                        hindsight_service.retain(
                            contents=(
                                f"Unconfirmed automation outcome for {incident.service_name} "
                                f"[{incident.failure_fingerprint}]: action={action}; "
                                f"status={result['status']}; reason={result['reason']}"
                            ),
                            memory_type="automation_outcome",
                            tags=[incident.service_name.lower(), (incident.failure_fingerprint or "unknown").lower(), "automation_unconfirmed"],
                            metadata={"incident_id": incident.id, "automation_run_id": run.id, "human_confirmed": False, **result},
                        )
                    except Exception:
                        logger.exception("Could not retain automatic outcome for incident %s", incident.id)
        logger.info("Triggered background investigation for incident %s", incident_id)

task_queue = TaskQueue()
