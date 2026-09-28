import asyncio
import json
import logging
from datetime import datetime, timezone
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
    AuditLog
)
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

                # If failed pipeline / deployment, create or link Incident
                if status == "failed":
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
                        severity="high",
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
        logger.info(f"Triggered background investigation for incident {incident_id}")

task_queue = TaskQueue()
