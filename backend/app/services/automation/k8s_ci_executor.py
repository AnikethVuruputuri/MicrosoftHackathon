import json
from dataclasses import dataclass
import ipaddress
import re
import time
from typing import Any, Dict, Optional, Protocol
from urllib.parse import quote, urlparse

import httpx


ALLOWED_ACTIONS = {"rollback", "restart", "retry", "no_action"}


@dataclass
class AutomationContext:
    incident_id: int
    service_name: str
    environment: str
    action: str
    failure_fingerprint: Optional[str]
    confidence: float
    severity: str
    known_successful_pattern: bool
    previous_attempts: int = 0
    provider: Optional[str] = None
    repository: Optional[str] = None
    pipeline_id: Optional[str] = None
    api_base_url: Optional[str] = None
    health_check_url: Optional[str] = None
    credential: Optional[str] = None
    credential_type: str = "token"
    health_check_count: int = 3
    health_check_interval_seconds: int = 5
    max_attempts: int = 1
    allow_retry: bool = True
    allow_restart: bool = False
    allow_rollback: bool = False
    kube_namespace: Optional[str] = None
    kube_deployment: Optional[str] = None
    kube_context: Optional[str] = None
    dry_run: bool = False


class AutomationExecutor(Protocol):
    """Infrastructure adapter. Implementations must use scoped credentials."""

    @property
    def is_configured(self) -> bool:
        """Whether live infrastructure execution and health checks are available."""

    def execute(self, context: AutomationContext) -> Any:
        """Apply the requested action and return compensation data."""

    def plan(self, context: AutomationContext) -> Any:
        """Describe an action without mutating infrastructure."""

    def health_check(self, context: AutomationContext, execution_data: Any = None) -> bool:
        """Return true only when configured service health checks pass."""

    def compensate(self, context: AutomationContext, execution_data: Any) -> bool:
        """Undo the action where possible and return whether recovery succeeded."""


class UnconfiguredAutomationExecutor:
    @property
    def is_configured(self) -> bool:
        return False

    def execute(self, context: AutomationContext) -> Any:
        raise RuntimeError("No deployment automation provider is configured")

    def health_check(self, context: AutomationContext, execution_data: Any = None) -> bool:
        return False

    def compensate(self, context: AutomationContext, execution_data: Any) -> bool:
        return False


class CiRetryExecutor:
    """Retries the exact failed CI pipeline and verifies it plus service health."""

    def __init__(self, *, transport: Optional[httpx.BaseTransport] = None, poll_interval: float = 2.0, max_polls: int = 60):
        self.transport = transport
        self.poll_interval = poll_interval
        self.max_polls = max_polls

    @property
    def is_configured(self) -> bool:
        return True

    def _headers(self, context: AutomationContext) -> Dict[str, str]:
        if not context.credential:
            raise RuntimeError("No connected provider credential is available")
        if context.provider == "github":
            return {
                "Authorization": f"Bearer {context.credential}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        if context.provider == "gitlab":
            if context.credential_type == "oauth":
                return {"Authorization": f"Bearer {context.credential}"}
            return {"PRIVATE-TOKEN": context.credential}
        raise RuntimeError("Unsupported CI provider")

    def _api_url(self, context: AutomationContext) -> str:
        if not context.repository or not context.pipeline_id:
            raise RuntimeError("The incident has no exact repository and pipeline run reference")
        if context.provider == "github":
            if "/" not in context.repository:
                raise RuntimeError("GitHub repository must use owner/repository format")
            return f"https://api.github.com/repos/{context.repository}/actions/runs/{quote(context.pipeline_id, safe='')}"
        if context.provider == "gitlab":
            base = (context.api_base_url or "https://gitlab.com/api/v4").rstrip("/")
            project = quote(context.repository, safe="")
            return f"{base}/projects/{project}/pipelines/{quote(context.pipeline_id, safe='')}"
        raise RuntimeError("Unsupported CI provider")

    def execute(self, context: AutomationContext) -> Dict[str, Any]:
        if context.action.strip().lower() != "retry":
            raise RuntimeError("CI retry executor supports retry actions only")
        base_url = self._api_url(context)
        headers = self._headers(context)
        jobs_url = (
            f"{base_url}/jobs?per_page=100"
            if context.provider == "github"
            else f"{base_url}/jobs?per_page=100"
        )
        if context.provider == "github":
            retry_url = f"{base_url}/rerun-failed-jobs"
        else:
            retry_url = f"{base_url}/retry"
        with httpx.Client(transport=self.transport, timeout=10.0, follow_redirects=False) as client:
            jobs_response = client.get(jobs_url, headers=headers)
            if jobs_response.status_code != 200:
                raise RuntimeError("Could not inspect failed CI jobs; automatic retry was blocked")
            response_data = jobs_response.json()
            jobs = response_data.get("jobs", []) if context.provider == "github" else response_data
            failed_jobs = [
                job for job in jobs
                if job.get("conclusion") == "failure" or job.get("status") == "failed"
            ]
            allowed_job = re.compile(r"\b(test|tests|lint|check|checks|verify|validation)\b", re.IGNORECASE)
            risky_job = re.compile(
                r"\b(deploy|deployment|release|publish|migration|terraform|apply|rollout|promote|production|prod)\b",
                re.IGNORECASE,
            )
            if not failed_jobs or any(
                risky_job.search(f"{job.get('name', '')} {job.get('stage', '')}")
                or not allowed_job.search(f"{job.get('name', '')} {job.get('stage', '')}")
                for job in failed_jobs
            ):
                raise RuntimeError("Failed jobs are not clearly limited to safe test/check stages")
            response = client.post(retry_url, headers=headers)
            if response.status_code not in {200, 201, 202, 204}:
                raise RuntimeError(f"CI provider rejected retry (HTTP {response.status_code})")
            retry_data = response.json() if response.content else {}
        execution_data = {
            "provider": context.provider,
            "repository": context.repository,
            "pipeline_id": context.pipeline_id,
            "api_url": base_url,
        }
        if context.provider == "gitlab" and retry_data.get("id"):
            execution_data["pipeline_id"] = str(retry_data["id"])
            execution_data["api_url"] = base_url.rsplit("/", 1)[0] + "/" + quote(str(retry_data["id"]), safe="")
        return execution_data

    def health_check(self, context: AutomationContext, execution_data: Any = None) -> bool:
        if not execution_data:
            return False
        api_url = execution_data["api_url"]
        headers = self._headers(context)
        with httpx.Client(transport=self.transport, timeout=10.0, follow_redirects=False) as client:
            for poll in range(self.max_polls):
                response = client.get(api_url, headers=headers)
                if response.status_code != 200:
                    return False
                pipeline = response.json()
                if context.provider == "github":
                    completed = pipeline.get("status") == "completed"
                    succeeded = pipeline.get("conclusion") == "success"
                else:
                    status = pipeline.get("status")
                    completed = status in {"success", "failed", "canceled", "skipped"}
                    succeeded = status == "success"
                if completed:
                    if not succeeded:
                        return False
                    break
                if poll + 1 < self.max_polls:
                    time.sleep(self.poll_interval)
            else:
                return False

            return check_health_endpoints(
                context.health_check_url,
                count=context.health_check_count,
                interval_seconds=context.health_check_interval_seconds,
                transport=self.transport,
            )

    def compensate(self, context: AutomationContext, execution_data: Any) -> bool:
        if not execution_data:
            return False
        api_url = execution_data.get("api_url")
        if not api_url:
            return False
        cancel_url = f"{api_url}/cancel" if context.provider == "github" else f"{api_url}/cancel"
        try:
            with httpx.Client(transport=self.transport, timeout=10.0, follow_redirects=False) as client:
                response = client.post(cancel_url, headers=self._headers(context))
            return response.status_code in {200, 202, 204}
        except Exception:
            return False


def check_health_endpoints(
    stored_urls: Optional[str],
    *,
    count: int = 1,
    interval_seconds: int = 0,
    transport: Optional[httpx.BaseTransport] = None,
) -> bool:
    if not stored_urls:
        return False
    try:
        decoded_urls = json.loads(stored_urls)
        health_urls = decoded_urls if isinstance(decoded_urls, list) else [stored_urls]
    except (TypeError, ValueError):
        health_urls = [stored_urls]
    if not health_urls:
        return False
    for health_url in health_urls:
        parsed = urlparse(health_url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            return False
        try:
            address = ipaddress.ip_address(parsed.hostname)
            if not address.is_global:
                return False
        except ValueError:
            pass
    try:
        with httpx.Client(transport=transport, timeout=10.0, follow_redirects=False) as client:
            for observation in range(max(1, count)):
                for health_url in health_urls:
                    response = client.get(health_url)
                    if not 200 <= response.status_code < 300:
                        return False
                if observation + 1 < max(1, count):
                    time.sleep(max(0, interval_seconds))
    except httpx.HTTPError:
        return False
    return True


class AutomationExecutorRouter:
    def __init__(self):
        from app.services.kubernetes_automation import KubernetesAutomationExecutor

        self.ci = CiRetryExecutor()
        self.kubernetes = KubernetesAutomationExecutor()

    @property
    def is_configured(self) -> bool:
        return self.ci.is_configured or self.kubernetes.is_configured

    def is_configured_for(self, provider: str) -> bool:
        if provider in {"github", "gitlab"}:
            return self.ci.is_configured
        if provider == "kubernetes":
            return self.kubernetes.is_configured
        return False

    def _executor(self, context: AutomationContext) -> AutomationExecutor:
        if context.provider == "kubernetes":
            return self.kubernetes
        if context.provider in {"github", "gitlab"}:
            return self.ci
        raise RuntimeError("No executor is configured for this provider")

    def execute(self, context: AutomationContext) -> Any:
        return self._executor(context).execute(context)

    def health_check(self, context: AutomationContext, execution_data: Any = None) -> bool:
        return self._executor(context).health_check(context, execution_data)

    def compensate(self, context: AutomationContext, execution_data: Any) -> bool:
        return self._executor(context).compensate(context, execution_data)


automation_executor: AutomationExecutor = AutomationExecutorRouter()


def select_automatic_action(recommendation: str) -> str:
    normalized = recommendation.lower()
    negative = r"\b(?:do not|don't|never|avoid|not recommended to)\s+(?:retry|rerun|re-run|restart|roll back|rollback)\b"
    if re.search(negative, normalized):
        return "no_action"
    if re.search(r"\b(?:roll back|rollback|revert to previous revision)\b", normalized):
        return "rollback"
    if re.search(r"\b(?:restart|re-start|recycle)\b", normalized):
        return "restart"
    if "retry" in normalized or "rerun" in normalized or "re-run" in normalized:
        return "retry"
    return "no_action"


def evaluate_automation_policy(
    context: AutomationContext,
    *,
    automation_enabled: bool,
    confidence_threshold: float = 0.9,
    approved_by_human: bool = False,
) -> Dict[str, Any]:
    action = context.action.strip().lower().replace("-", "_").replace(" ", "_")
    result: Dict[str, Any] = {
        "action": action,
        "allowed": False,
        "requires_approval": False,
        "reason": "",
    }

    if action not in ALLOWED_ACTIONS:
        result["reason"] = "Unsupported action; no infrastructure action was taken."
    elif action == "no_action":
        result["reason"] = "Policy selected no action; escalate for human review."
    elif not automation_enabled:
        result["reason"] = "Automated remediation is disabled by configuration."
    elif not context.failure_fingerprint or not context.known_successful_pattern:
        result["reason"] = "No exact fingerprint with a verified successful historical outcome."
    elif context.confidence < confidence_threshold:
        result["reason"] = "Diagnosis confidence is below the configured threshold."
    elif context.environment.lower() not in {"development", "dev", "test", "staging", "stage", "production", "prod"}:
        result["reason"] = "Unknown environment; policy fails closed."
    elif action == "retry" and not context.allow_retry:
        result["reason"] = "Automatic retry is disabled by this service's policy."
    elif action == "restart" and not context.allow_restart:
        result["reason"] = "Automatic restart is not enabled for this service."
    elif action == "rollback" and not context.allow_rollback:
        result["reason"] = "Automatic rollback is not enabled for this service."
    elif action in {"retry", "restart", "rollback"} and context.severity.lower() not in {"low", "medium"}:
        result["reason"] = "Automatic actions are permitted only for low/medium severity."
    elif action in {"retry", "restart", "rollback"} and context.previous_attempts >= context.max_attempts:
        result["reason"] = "The configured automatic retry limit has been reached."
    else:
        production = context.environment.lower() in {"production", "prod"}
        requires_approval = production and action in {"rollback", "restart"}
        result["requires_approval"] = requires_approval
        if requires_approval and not approved_by_human:
            result["reason"] = "Human approval is required before this action can run."
        else:
            result["allowed"] = True
            result["reason"] = "Policy checks passed; execution still requires a configured provider."

    return result


def execute_automation(
    context: AutomationContext,
    *,
    executor: AutomationExecutor,
    automation_enabled: bool,
    confidence_threshold: float = 0.9,
    approved_by_human: bool = False,
) -> Dict[str, Any]:
    decision = evaluate_automation_policy(
        context,
        automation_enabled=automation_enabled,
        confidence_threshold=confidence_threshold,
        approved_by_human=(
            approved_by_human
            or (context.provider == "kubernetes" and context.dry_run)
        ),
    )
    result = {
        **decision,
        "status": "blocked",
        "health_check_passed": None,
        "compensated": None,
        "execution_data": None,
        "execution_attempted": False,
    }
    if not decision["allowed"]:
        result["status"] = "escalated"
        return result

    if context.provider == "kubernetes" and context.dry_run:
        try:
            result["execution_data"] = {"dry_run": True, "plan": executor.plan(context)}
            result["status"] = "dry_run"
            result["reason"] = "Dry run only; no Kubernetes changes were made."
        except Exception as error:
            result["status"] = "escalated"
            result["reason"] = f"Could not build Kubernetes dry-run plan: {type(error).__name__}."
        return result

    execution_data = None
    try:
        result["execution_attempted"] = True
        execution_data = executor.execute(context)
        result["execution_data"] = execution_data
        healthy = executor.health_check(context, execution_data)
        result["health_check_passed"] = healthy
        if healthy:
            result["status"] = "succeeded"
            result["reason"] = "Action executed and post-action health checks passed."
            return result
        result["reason"] = "Post-action health checks failed; compensation was attempted."
    except Exception as error:
        result["reason"] = f"Execution or health check failed: {type(error).__name__}; compensation was attempted."

    try:
        result["compensated"] = bool(executor.compensate(context, execution_data))
    except Exception:
        result["compensated"] = False
    result["status"] = "escalated"
    if not result["compensated"]:
        result["reason"] += " Compensation failed or could not be confirmed."
    return result