from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.database.session import get_session
from app.models.schemas import Repository, Integration, AuditLog, RepositoryOnboardRequest
from app.services.providers import get_provider
from app.services.security import decrypt_secret

router = APIRouter(prefix="/repositories", tags=["Repositories & Pipelines"])

@router.get("")
def list_repositories(
    provider: Optional[str] = None,
    session: Session = Depends(get_session)
):
    query = select(Repository).order_by(Repository.id.asc())
    if provider:
        query = query.where(Repository.provider == provider)
    return session.exec(query).all()

@router.get("/discover")
async def discover_repositories(
    provider: str = "github",
    session: Session = Depends(get_session)
):
    """Discovers accessible repositories from connected provider."""
    intg = session.exec(select(Integration).where(Integration.provider == provider)).first()
    token = decrypt_secret(intg.encrypted_token) if intg else None

    prov = get_provider(provider)
    repos = await prov.list_repositories(token=token)
    return {
        "provider": provider,
        "total": len(repos),
        "repositories": [r.model_dump() for r in repos]
    }

@router.post("/onboard")
async def onboard_repository(
    req: RepositoryOnboardRequest,
    session: Session = Depends(get_session)
):
    intg = session.exec(select(Integration).where(Integration.provider == req.provider)).first()
    
    # Check if already onboarded
    repo = session.exec(
        select(Repository).where(
            Repository.provider == req.provider,
            Repository.external_repo_id == req.external_repo_id
        )
    ).first()

    if not repo:
        repo = Repository(
            org_id=1,
            integration_id=intg.id if intg else None,
            provider=req.provider,
            external_repo_id=req.external_repo_id,
            name=req.name,
            full_name=req.full_name,
            default_branch=req.monitored_branch,
            monitored_branch=req.monitored_branch,
            environment=req.environment,
            is_monitored=req.enable_monitoring,
            status="active",
            last_sync_at=datetime.now(timezone.utc)
        )
        session.add(repo)
    else:
        repo.monitored_branch = req.monitored_branch
        repo.environment = req.environment
        repo.is_monitored = req.enable_monitoring
        repo.status = "active"
        repo.last_sync_at = datetime.now(timezone.utc)
        session.add(repo)

    session.add(AuditLog(
        org_id=1,
        actor="engineer",
        action="repository_onboarded",
        resource_type="repository",
        resource_id=req.name,
        details=f"Connected repository {req.full_name} for monitoring on branch {req.monitored_branch} ({req.environment})"
    ))
    session.commit()
    session.refresh(repo)

    return {
        "status": "success",
        "message": f"Repository '{req.full_name}' onboarded with ACTIVE pipeline monitoring and Hindsight memory learning.",
        "repository": repo.model_dump()
    }

@router.get("/{repo_id}/pipeline-runs")
async def get_repository_pipelines(
    repo_id: str,
    branch: Optional[str] = None,
    session: Session = Depends(get_session)
):
    repo = session.exec(select(Repository).where(Repository.name == repo_id)).first()
    provider_name = repo.provider if repo else "github"
    
    intg = session.exec(select(Integration).where(Integration.provider == provider_name)).first()
    token = decrypt_secret(intg.encrypted_token) if intg else None

    prov = get_provider(provider_name)
    runs = await prov.list_pipeline_runs(repo_id=repo.full_name if repo else repo_id, branch=branch, limit=10, token=token)
    return [r.model_dump() for r in runs]
