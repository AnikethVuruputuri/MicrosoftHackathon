from typing import List, Dict, Any, Optional
from langchain_core.tools import tool
from sqlmodel import Session, select
from app.database.session import engine
from app.models.schemas import Deployment, Incident, DeploymentChange, HumanCorrection, ResolutionOutcome, Service
from app.hindsight.client import hindsight_service
from app.services.fingerprint import FailureFingerprintEngine
from app.services.effectiveness import ResolutionEffectivenessEngine
from app.services.github_provider import github_provider

@tool
def get_deployment_logs(service_name: str, deployment_number: int) -> str:
    """Fetches deployment execution and bootstrap logs for a given service."""
    return github_provider.get_deployment_logs(service_name, deployment_number)

@tool
def get_commit_changes(repository: str, commit_sha: str) -> List[Dict[str, Any]]:
    """Retrieves file diffs and configuration changes associated with a commit."""
    return github_provider.get_commit_changes(repository, commit_sha)

@tool
def recall_hindsight_memories(fingerprint: str, service_name: str) -> List[Dict[str, Any]]:
    """Queries Hindsight organizational long-term memory for matching failure fingerprints."""
    query = f"{service_name} {fingerprint} incident correction root cause"
    tags = [service_name.lower(), fingerprint.lower()]
    return hindsight_service.recall(query=query, tags=tags, limit=5)

@tool
def get_historical_corrections(fingerprint: str) -> List[Dict[str, Any]]:
    """Retrieves past human corrections made by engineers for similar failure fingerprints."""
    with Session(engine) as session:
        corrections = session.exec(
            select(HumanCorrection).where(HumanCorrection.failure_fingerprint == fingerprint)
        ).all()
        return [c.model_dump() for c in corrections]

@tool
def get_resolution_effectiveness(fingerprint: str, service_name: str) -> List[Dict[str, Any]]:
    """Calculates historical remediation effectiveness percentages for a specific failure pattern."""
    with Session(engine) as session:
        return ResolutionEffectivenessEngine.get_effectiveness_for_fingerprint(
            session, fingerprint=fingerprint, service_name=service_name
        )

@tool
def retain_incident_learning(
    incident_code: str,
    service: str,
    fingerprint: str,
    root_cause: str,
    remediation: str,
    correction: Optional[str] = None
) -> Dict[str, Any]:
    """Retains verified operational learning into Hindsight organizational memory."""
    content = f"Incident {incident_code} ({service}) [Fingerprint: {fingerprint}]. "
    if correction:
        content += f"Engineer Correction: {correction}. "
    content += f"Actual Root Cause: {root_cause}. Successful Remediation: {remediation}."
    
    tags = [service.lower(), fingerprint.lower(), "learned_root_cause"]
    metadata = {
        "incident_code": incident_code,
        "service": service,
        "failure_fingerprint": fingerprint,
        "remediation": remediation,
        "is_corrected": bool(correction)
    }
    return hindsight_service.retain(contents=content, memory_type="engineering_knowledge", tags=tags, metadata=metadata)
