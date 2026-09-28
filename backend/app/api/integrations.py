from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.database.session import get_session
from app.models.schemas import Integration, Repository, AuditLog, IntegrationConnectRequest
from app.services.providers import get_provider, github_provider, gitlab_provider
from app.services.security import encrypt_secret, decrypt_secret

router = APIRouter(prefix="/integrations", tags=["Integrations"])

@router.get("")
def list_integrations(session: Session = Depends(get_session)):
    integrations = session.exec(select(Integration)).all()
    results = []
    for intg in integrations:
        repos_count = session.exec(
            select(Repository).where(Repository.integration_id == intg.id)
        ).all()
        results.append({
            "id": intg.id,
            "provider": intg.provider,
            "status": intg.status,
            "auth_type": intg.auth_type,
            "account_name": intg.account_name,
            "account_id": intg.account_id,
            "webhook_status": "healthy" if intg.status == "connected" else "inactive",
            "repositories_monitored": len(repos_count),
            "last_sync_at": str(intg.last_sync_at) if intg.last_sync_at else None,
            "created_at": str(intg.created_at)
        })
    return results

@router.get("/{provider}/auth-url")
def get_oauth_url(provider: str, redirect_uri: str = "http://localhost:5173/integrations/callback"):
    prov = get_provider(provider)
    state = f"state_{datetime.now(timezone.utc).timestamp()}"
    url = prov.get_oauth_authorization_url(state=state, redirect_uri=redirect_uri)
    return {"provider": provider, "authorization_url": url, "state": state}

@router.post("/{provider}/oauth-callback")
async def handle_oauth_callback(
    provider: str,
    code: str = Query(...),
    redirect_uri: str = "http://localhost:5173/integrations/callback",
    session: Session = Depends(get_session)
):
    prov = get_provider(provider)
    token_data = await prov.exchange_oauth_code(code=code, redirect_uri=redirect_uri)
    
    # Check or create Integration record
    intg = session.exec(select(Integration).where(Integration.provider == provider)).first()
    if not intg:
        intg = Integration(
            org_id=1,
            provider=provider,
            status="connected",
            auth_type="oauth",
            account_name=token_data.get("account_name", f"{provider}_org"),
            account_id=str(token_data.get("account_id", f"{provider}_101")),
            encrypted_token=encrypt_secret(token_data.get("access_token")),
            last_sync_at=datetime.now(timezone.utc)
        )
    else:
        intg.status = "connected"
        intg.account_name = token_data.get("account_name", intg.account_name)
        intg.encrypted_token = encrypt_secret(token_data.get("access_token"))
        intg.last_sync_at = datetime.now(timezone.utc)

    session.add(intg)
    
    # Add audit log
    session.add(AuditLog(
        org_id=1,
        actor="engineer",
        action="integration_connected",
        resource_type="integration",
        resource_id=provider,
        details=f"Successfully connected {provider.upper()} integration for account {intg.account_name}"
    ))
    session.commit()
    session.refresh(intg)

    return {
        "status": "success",
        "message": f"{provider.capitalize()} connected successfully.",
        "integration": {
            "id": intg.id,
            "provider": intg.provider,
            "account_name": intg.account_name,
            "status": intg.status
        }
    }

@router.post("/{provider}/disconnect")
def disconnect_integration(provider: str, session: Session = Depends(get_session)):
    intg = session.exec(select(Integration).where(Integration.provider == provider)).first()
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")

    intg.status = "disconnected"
    intg.encrypted_token = None
    session.add(intg)

    session.add(AuditLog(
        org_id=1,
        actor="engineer",
        action="integration_disconnected",
        resource_type="integration",
        resource_id=provider,
        details=f"Disconnected {provider.upper()} integration"
    ))
    session.commit()

    return {"status": "success", "message": f"{provider.capitalize()} disconnected."}

@router.post("/{provider}/sync")
async def sync_integration(provider: str, session: Session = Depends(get_session)):
    intg = session.exec(select(Integration).where(Integration.provider == provider)).first()
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")

    prov = get_provider(provider)
    token = decrypt_secret(intg.encrypted_token)
    repos = await prov.list_repositories(token=token)

    intg.last_sync_at = datetime.now(timezone.utc)
    intg.status = "connected"
    session.add(intg)
    session.commit()

    return {
        "status": "success",
        "message": f"Synchronized {len(repos)} repositories from {provider.capitalize()}.",
        "repositories_found": len(repos),
        "last_sync_at": str(intg.last_sync_at)
    }
