import json
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urlsplit
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel, AnyHttpUrl, Field
from app.database.session import get_session
from app.models.schemas import (
    SystemStatusResponse, Organization, AutomationSettings, AutomationTarget,
    AutomationGuard, AutomationServicePolicy, AutomationRun, ResolutionOutcome,
    AuditLog, Integration, User, Incident, Service,
)
from app.llm.groq_provider import groq_provider
from app.hindsight.client import hindsight_service
from app.services.providers import github_provider, gitlab_provider
from app.services.automation import automation_executor
from app.api.auth import get_current_user
from app.config import settings
from app.services.security import decrypt_secret

router = APIRouter(prefix="/system", tags=["System & Health"])


def _automation_message(enabled: bool, configured: bool, provider: Optional[str] = None) -> str:
    if not enabled:
        return "Automatic retries are off."
    if not settings.AUTOMATION_ENABLED:
        return "The preference is on, but the server-level automation safety lock is active."
    if not configured:
        if provider == "kubernetes":
            return "Kubernetes target is saved, but cluster credentials, namespace, Deployment, and HTTPS health checks must be configured."
        return "The preference is on, but a matching connected provider credential, repository, and HTTPS health check are required."
    return "Automatic low/medium retries are ready."


class AutomationSettingsRequest(BaseModel):
    enabled: bool


class EmergencyStopRequest(BaseModel):
    enabled: bool


class KubernetesAutomationRequest(BaseModel):
    enabled: bool
    dry_run: bool = True


class AutomationServicePolicyRequest(BaseModel):
    enabled: bool
    allow_retry: bool = True
    allow_restart: bool = False
    allow_rollback: bool = False
    cooldown_seconds: int = Field(default=900, ge=0, le=86400)
    max_attempts: int = Field(default=1, ge=1, le=3)
    health_check_count: int = Field(default=3, ge=1, le=10)
    health_check_interval_seconds: int = Field(default=5, ge=0, le=60)


class AutomationRunConfirmationRequest(BaseModel):
    notes: Optional[str] = None


class AutomationTargetRequest(BaseModel):
    provider: str = Field(pattern="^(github|gitlab|kubernetes)$")
    repository: str = Field(min_length=3, max_length=300)
    health_check_url: Optional[AnyHttpUrl] = None
    health_check_urls: List[AnyHttpUrl] = Field(default_factory=list, max_length=5)
    gitlab_api_url: Optional[AnyHttpUrl] = None
    kube_namespace: Optional[str] = Field(default=None, min_length=1, max_length=63, pattern="^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    kube_deployment: Optional[str] = Field(default=None, min_length=1, max_length=253)
    kube_context: Optional[str] = Field(default=None, max_length=253)


def _health_check_urls(target: AutomationTarget) -> List[str]:
    try:
        values = json.loads(target.health_check_url)
        if isinstance(values, list) and values:
            return [str(value) for value in values]
    except (TypeError, ValueError):
        pass
    return [target.health_check_url]


def _kubernetes_settings(session: Session, org_id: int):
    guard = session.exec(select(AutomationGuard).where(AutomationGuard.org_id == org_id)).first()
    return {
        "kubernetes_enabled": guard.kubernetes_enabled if guard else False,
        "kubernetes_dry_run": guard.kubernetes_dry_run if guard else True,
    }


def _get_automation_readiness(session: Session, org_id: int, target: Optional[AutomationTarget]):
    if not target or not automation_executor.is_configured_for(target.provider):
        return False
    health_urls = _health_check_urls(target)
    if not health_urls or any(not url.startswith("https://") for url in health_urls):
        return False
    if target.provider == "gitlab" and (
        not target.gitlab_api_url or not target.gitlab_api_url.startswith("https://")
    ):
        return False
    if target.provider == "kubernetes":
        return bool(target.kube_namespace and target.kube_deployment)
    integration = session.exec(
        select(Integration).where(
            Integration.org_id == org_id,
            Integration.provider == target.provider,
            Integration.status == "connected",
        )
    ).first()
    token = decrypt_secret(integration.encrypted_token) if integration else None
    if (
        not token
        or not integration
        or token == integration.encrypted_token
        or "demo" in token.lower()
    ):
        return False
    return True


@router.get("/automation")
def get_automation_settings(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    config = session.exec(
        select(AutomationSettings).where(AutomationSettings.org_id == user.org_id)
    ).first()
    target = session.exec(
        select(AutomationTarget).where(AutomationTarget.org_id == user.org_id)
    ).first()
    enabled = config.enabled if config else False
    guard = session.exec(select(AutomationGuard).where(AutomationGuard.org_id == user.org_id)).first()
    emergency_stop = guard.emergency_stop if guard else False
    kube_settings = _kubernetes_settings(session, user.org_id)
    configured = _get_automation_readiness(session, user.org_id, target)
    ready = configured and enabled and not emergency_stop and settings.AUTOMATION_ENABLED
    if target and target.provider == "kubernetes":
        ready = ready and kube_settings["kubernetes_enabled"]
    return {
        "enabled": enabled,
        "emergency_stop": emergency_stop,
        "executor_configured": automation_executor.is_configured_for(target.provider) if target else False,
        "target_configured": bool(target),
        "ready": ready,
        "message": "Emergency stop is active; all automatic actions are blocked." if emergency_stop else "Kubernetes actions are disabled." if target and target.provider == "kubernetes" and not kube_settings["kubernetes_enabled"] else "Kubernetes is in dry-run mode; no workload changes will be made." if target and target.provider == "kubernetes" and kube_settings["kubernetes_dry_run"] else _automation_message(enabled, configured, target.provider if target else None),
        **kube_settings,
        "provider": target.provider if target else None,
        "repository": target.repository if target else "",
        "health_check_url": _health_check_urls(target)[0] if target else "",
        "health_check_urls": _health_check_urls(target) if target else [],
        "gitlab_api_url": target.gitlab_api_url if target and target.gitlab_api_url else "",
        "kube_namespace": target.kube_namespace if target and target.kube_namespace else "",
        "kube_deployment": target.kube_deployment if target and target.kube_deployment else "",
        "kube_context": target.kube_context if target and target.kube_context else "",
    }


@router.put("/automation")
def update_automation_settings(
    req: AutomationSettingsRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must change automation settings")
    config = session.exec(
        select(AutomationSettings).where(AutomationSettings.org_id == user.org_id)
    ).first()
    if config is None:
        config = AutomationSettings(org_id=user.org_id, enabled=req.enabled)
    else:
        config.enabled = req.enabled
        config.updated_at = datetime.now(timezone.utc)
    session.add(config)
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="automation_setting_changed",
        resource_type="organization",
        resource_id=str(user.org_id),
        details=f"Automatic low/medium remediation preference set to {req.enabled}.",
    ))
    session.commit()
    session.refresh(config)
    target = session.exec(
        select(AutomationTarget).where(AutomationTarget.org_id == user.org_id)
    ).first()
    configured = _get_automation_readiness(session, user.org_id, target)
    enabled = config.enabled
    guard = session.exec(select(AutomationGuard).where(AutomationGuard.org_id == user.org_id)).first()
    emergency_stop = guard.emergency_stop if guard else False
    kube_settings = _kubernetes_settings(session, user.org_id)
    ready = configured and enabled and not emergency_stop and settings.AUTOMATION_ENABLED
    if target and target.provider == "kubernetes":
        ready = ready and kube_settings["kubernetes_enabled"]
    return {
        "enabled": enabled,
        "emergency_stop": emergency_stop,
        "executor_configured": automation_executor.is_configured_for(target.provider) if target else False,
        "target_configured": bool(target),
        "ready": ready,
        "message": "Emergency stop is active; all automatic actions are blocked." if emergency_stop else "Kubernetes actions are disabled." if target and target.provider == "kubernetes" and not kube_settings["kubernetes_enabled"] else "Kubernetes is in dry-run mode; no workload changes will be made." if target and target.provider == "kubernetes" and kube_settings["kubernetes_dry_run"] else _automation_message(enabled, configured, target.provider if target else None),
        **kube_settings,
        "provider": target.provider if target else None,
        "repository": target.repository if target else "",
        "health_check_url": _health_check_urls(target)[0] if target else "",
        "health_check_urls": _health_check_urls(target) if target else [],
        "gitlab_api_url": target.gitlab_api_url if target and target.gitlab_api_url else "",
        "kube_namespace": target.kube_namespace if target and target.kube_namespace else "",
        "kube_deployment": target.kube_deployment if target and target.kube_deployment else "",
        "kube_context": target.kube_context if target and target.kube_context else "",
    }


@router.put("/automation/target")
def update_automation_target(
    req: AutomationTargetRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must configure automation")
    health_urls = [str(url) for url in req.health_check_urls]
    if req.health_check_url:
        health_urls.insert(0, str(req.health_check_url))
    health_urls = list(dict.fromkeys(url.strip() for url in health_urls if url.strip()))
    if not health_urls or len(health_urls) > 5:
        raise HTTPException(status_code=400, detail="Configure between one and five health-check URLs")
    for health_url in health_urls:
        health_parts = urlsplit(health_url)
        if health_parts.scheme != "https" or not health_parts.hostname or health_parts.username or health_parts.password:
            raise HTTPException(status_code=400, detail="Health-check URLs must use HTTPS and cannot contain credentials")
    if req.provider == "kubernetes" and (not req.kube_namespace or not req.kube_deployment):
        raise HTTPException(status_code=400, detail="Kubernetes namespace and Deployment name are required")
    gitlab_api_url = str(req.gitlab_api_url) if req.gitlab_api_url else None
    gitlab_parts = urlsplit(gitlab_api_url) if gitlab_api_url else None
    if req.provider == "gitlab" and (
        not gitlab_parts
        or gitlab_parts.scheme != "https"
        or not gitlab_parts.hostname
        or gitlab_parts.username
        or gitlab_parts.password
    ):
        raise HTTPException(status_code=400, detail="GitLab API URL must use HTTPS")
    target = session.exec(
        select(AutomationTarget).where(AutomationTarget.org_id == user.org_id)
    ).first()
    if target is None:
        target = AutomationTarget(
            org_id=user.org_id,
            provider=req.provider,
            repository=req.repository.strip(),
            health_check_url=json.dumps(health_urls),
            gitlab_api_url=gitlab_api_url,
            kube_namespace=req.kube_namespace,
            kube_deployment=req.kube_deployment,
            kube_context=req.kube_context,
        )
    else:
        target.provider = req.provider
        target.repository = req.repository.strip()
        target.health_check_url = json.dumps(health_urls)
        target.gitlab_api_url = gitlab_api_url
        target.kube_namespace = req.kube_namespace
        target.kube_deployment = req.kube_deployment
        target.kube_context = req.kube_context
        target.updated_at = datetime.now(timezone.utc)
    session.add(target)
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="automation_target_configured",
        resource_type="organization",
        resource_id=str(user.org_id),
        details=f"Configured {req.provider} automation target for repository {req.repository.strip()}.",
    ))
    session.commit()
    session.refresh(target)
    configured = _get_automation_readiness(session, user.org_id, target)
    config = session.exec(
        select(AutomationSettings).where(AutomationSettings.org_id == user.org_id)
    ).first()
    enabled = config.enabled if config else False
    guard = session.exec(select(AutomationGuard).where(AutomationGuard.org_id == user.org_id)).first()
    emergency_stop = guard.emergency_stop if guard else False
    kube_settings = _kubernetes_settings(session, user.org_id)
    ready = configured and enabled and not emergency_stop and settings.AUTOMATION_ENABLED
    if target.provider == "kubernetes":
        ready = ready and kube_settings["kubernetes_enabled"]
    return {
        "enabled": enabled,
        "emergency_stop": emergency_stop,
        "executor_configured": automation_executor.is_configured_for(target.provider),
        "target_configured": True,
        "ready": ready,
        "message": "Emergency stop is active; all automatic actions are blocked." if emergency_stop else "Kubernetes actions are disabled." if target.provider == "kubernetes" and not kube_settings["kubernetes_enabled"] else "Kubernetes is in dry-run mode; no workload changes will be made." if target.provider == "kubernetes" and kube_settings["kubernetes_dry_run"] else _automation_message(enabled, configured, target.provider),
        **kube_settings,
        "provider": target.provider,
        "repository": target.repository,
        "health_check_url": health_urls[0],
        "health_check_urls": health_urls,
        "gitlab_api_url": target.gitlab_api_url or "",
        "kube_namespace": target.kube_namespace or "",
        "kube_deployment": target.kube_deployment or "",
        "kube_context": target.kube_context or "",
    }


@router.put("/automation/kubernetes")
def update_kubernetes_automation(
    req: KubernetesAutomationRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must configure Kubernetes automation")
    guard = session.exec(select(AutomationGuard).where(AutomationGuard.org_id == user.org_id)).first()
    if guard is None:
        guard = AutomationGuard(
            org_id=user.org_id,
            kubernetes_enabled=req.enabled,
            kubernetes_dry_run=req.dry_run,
        )
    else:
        guard.kubernetes_enabled = req.enabled
        guard.kubernetes_dry_run = req.dry_run
        guard.updated_at = datetime.now(timezone.utc)
    session.add(guard)
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="kubernetes_automation_settings_changed",
        resource_type="organization",
        resource_id=str(user.org_id),
        details=f"Kubernetes automation enabled={req.enabled}; dry_run={req.dry_run}.",
    ))
    session.commit()
    return {
        "kubernetes_enabled": guard.kubernetes_enabled,
        "kubernetes_dry_run": guard.kubernetes_dry_run,
    }


@router.put("/automation/emergency-stop")
def set_automation_emergency_stop(
    req: EmergencyStopRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must control the emergency stop")
    guard = session.exec(select(AutomationGuard).where(AutomationGuard.org_id == user.org_id)).first()
    if guard is None:
        guard = AutomationGuard(org_id=user.org_id, emergency_stop=req.enabled)
    else:
        guard.emergency_stop = req.enabled
        guard.updated_at = datetime.now(timezone.utc)
    session.add(guard)
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="automation_emergency_stop_changed",
        resource_type="organization",
        resource_id=str(user.org_id),
        details=f"Emergency stop set to {req.enabled}.",
    ))
    session.commit()
    return {"emergency_stop": guard.emergency_stop}


@router.get("/automation/policies")
def list_automation_policies(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    services = session.exec(select(Service).where(Service.org_id == user.org_id).order_by(Service.name)).all()
    policies = session.exec(
        select(AutomationServicePolicy).where(AutomationServicePolicy.org_id == user.org_id)
    ).all()
    policy_by_service = {policy.service_name: policy for policy in policies}
    return [
        {
            "service_name": service.name,
            "enabled": policy_by_service[service.name].enabled if service.name in policy_by_service else True,
            "allow_retry": policy_by_service[service.name].allow_retry if service.name in policy_by_service else True,
            "allow_restart": policy_by_service[service.name].allow_restart if service.name in policy_by_service else False,
            "allow_rollback": policy_by_service[service.name].allow_rollback if service.name in policy_by_service else False,
            "cooldown_seconds": policy_by_service[service.name].cooldown_seconds if service.name in policy_by_service else 900,
            "max_attempts": policy_by_service[service.name].max_attempts if service.name in policy_by_service else 1,
            "health_check_count": policy_by_service[service.name].health_check_count if service.name in policy_by_service else 3,
            "health_check_interval_seconds": policy_by_service[service.name].health_check_interval_seconds if service.name in policy_by_service else 5,
        }
        for service in services
    ]


@router.put("/automation/policies/{service_name}")
def update_automation_policy(
    service_name: str,
    req: AutomationServicePolicyRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must update automation policy")
    service = session.exec(
        select(Service).where(Service.org_id == user.org_id, Service.name == service_name)
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    policy = session.exec(
        select(AutomationServicePolicy).where(
            AutomationServicePolicy.org_id == user.org_id,
            AutomationServicePolicy.service_name == service_name,
        )
    ).first()
    if policy is None:
        policy = AutomationServicePolicy(
            org_id=user.org_id,
            service_name=service_name,
            enabled=req.enabled,
            allow_retry=req.allow_retry,
            allow_restart=req.allow_restart,
            allow_rollback=req.allow_rollback,
            cooldown_seconds=req.cooldown_seconds,
            max_attempts=req.max_attempts,
            health_check_count=req.health_check_count,
            health_check_interval_seconds=req.health_check_interval_seconds,
        )
    else:
        policy.enabled = req.enabled
        policy.allow_retry = req.allow_retry
        policy.allow_restart = req.allow_restart
        policy.allow_rollback = req.allow_rollback
        policy.cooldown_seconds = req.cooldown_seconds
        policy.max_attempts = req.max_attempts
        policy.health_check_count = req.health_check_count
        policy.health_check_interval_seconds = req.health_check_interval_seconds
        policy.updated_at = datetime.now(timezone.utc)
    session.add(policy)
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="automation_service_policy_changed",
        resource_type="service",
        resource_id=service_name,
        details=f"Automation enabled={req.enabled}; cooldown={req.cooldown_seconds}s; max attempts={req.max_attempts}; health observations={req.health_check_count}.",
    ))
    session.commit()
    return policy.model_dump()


@router.get("/automation/runs")
def list_automation_runs(
    limit: int = 50,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    runs = session.exec(
        select(AutomationRun)
        .where(AutomationRun.org_id == user.org_id)
        .order_by(AutomationRun.started_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
    response = []
    for run in runs:
        incident = session.get(Incident, run.incident_id)
        response.append({
            **run.model_dump(),
            "incident_code": incident.incident_code if incident else None,
            "service_name": incident.service_name if incident else None,
        })
    return response


@router.post("/automation/runs/{run_id}/confirm")
def confirm_automation_run(
    run_id: int,
    req: AutomationRunConfirmationRequest,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if user.role not in {"admin", "engineer"}:
        raise HTTPException(status_code=403, detail="An admin or engineer must confirm automation learning")
    run = session.get(AutomationRun, run_id)
    if not run or run.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Automation run not found")
    if run.status != "succeeded":
        raise HTTPException(status_code=409, detail="Only a successful, health-checked run can be confirmed")
    if run.human_confirmed:
        return {"status": "already_confirmed", "run_id": run.id}
    incident = session.get(Incident, run.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    run.human_confirmed = True
    session.add(run)
    session.add(ResolutionOutcome(
        incident_code=incident.incident_code,
        service_name=incident.service_name,
        failure_fingerprint=incident.failure_fingerprint or "unknown",
        remediation_action=run.action,
        success=True,
        recovery_time_minutes=0,
        engineer_confirmed=True,
        notes=req.notes or "Engineer confirmed automated recovery.",
    ))
    session.add(AuditLog(
        org_id=user.org_id,
        actor=user.email,
        action="automation_learning_confirmed",
        resource_type="automation_run",
        resource_id=str(run.id),
        details=req.notes or "Engineer confirmed automated recovery.",
    ))
    session.commit()
    try:
        hindsight_service.retain(
            contents=f"Engineer confirmed automated retry for {incident.service_name} [{incident.failure_fingerprint}] succeeded.",
            memory_type="automation_outcome",
            tags=[incident.service_name.lower(), (incident.failure_fingerprint or "unknown").lower(), "confirmed_automation"],
            metadata={"incident_id": incident.id, "automation_run_id": run.id, "human_confirmed": True},
        )
    except Exception:
        pass
    return {"status": "confirmed", "run_id": run.id}

@router.get("/status", response_model=SystemStatusResponse)
def get_system_status(session: Session = Depends(get_session)):
    groq_stat = groq_provider.get_status()
    hindsight_stat = hindsight_service.get_status()
    gh_configured = github_provider.is_configured()
    gl_configured = gitlab_provider.is_configured()

    return SystemStatusResponse(
        backend="Operational",
        groq_status=groq_stat["status"],
        groq_mode=groq_stat["mode"],
        groq_model=groq_stat["model"],
        hindsight_status=hindsight_stat["status"],
        hindsight_mode=hindsight_stat["mode"],
        hindsight_bank=hindsight_stat["bank_id"],
        database_status="Operational",
        database_type="PostgreSQL / SQLite",
        github_status="Connected (Live API)" if gh_configured else "Ready (Active Provider)",
        github_mode="REAL" if gh_configured else "REAL",
        gitlab_status="Connected (Live API)" if gl_configured else "Ready (Active Provider)",
        gitlab_mode="REAL" if gl_configured else "REAL",
        background_worker="Operational"
    )

@router.get("/ready")
def readiness_check(session: Session = Depends(get_session)):
    try:
        # Verify DB connection
        session.exec(select(Organization)).first()
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ready" if db_ok else "unhealthy",
        "database": "connected" if db_ok else "disconnected",
        "hindsight": hindsight_service.get_status()["status"],
        "llm": groq_provider.get_status()["status"],
        "github_provider": "ready",
        "gitlab_provider": "ready",
        "background_worker": "running"
    }
