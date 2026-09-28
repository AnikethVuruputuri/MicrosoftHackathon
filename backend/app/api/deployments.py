from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database.session import get_session
from app.models.schemas import (
    Deployment,
    DeploymentChange,
    DeploymentSimulateRequest,
    RiskAnalysisRequest,
    Incident,
    Service
)
from app.services.risk_engine import DeploymentRiskEngine
from app.services.fingerprint import FailureFingerprintEngine
from app.services.github_provider import github_provider

router = APIRouter(prefix="/deployments", tags=["Deployments"])

@router.get("", response_model=List[Deployment])
def list_deployments(
    service_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    session: Session = Depends(get_session)
):
    query = select(Deployment).order_by(Deployment.id.desc())
    if service_name:
        query = query.where(Deployment.service_name == service_name)
    if status:
        query = query.where(Deployment.status == status)
    return session.exec(query.limit(limit)).all()

@router.get("/{deployment_id}")
def get_deployment(deployment_id: int, session: Session = Depends(get_session)):
    dep = session.get(Deployment, deployment_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    changes = session.exec(
        select(DeploymentChange).where(DeploymentChange.deployment_id == dep.id)
    ).all()
    incidents = session.exec(
        select(Incident).where(Incident.deployment_id == dep.id)
    ).all()
    return {
        **dep.model_dump(),
        "changes": [c.model_dump() for c in changes],
        "incidents": [inc.model_dump() for inc in incidents]
    }

@router.post("/simulate")
def simulate_deployment(
    req: DeploymentSimulateRequest,
    session: Session = Depends(get_session)
):
    service = session.exec(select(Service).where(Service.name == req.service_name)).first()
    if not service:
        service = Service(
            name=req.service_name,
            description=f"Simulated microservice: {req.service_name}",
            repository=f"org/{req.service_name}",
            owner_team="DevOps Team"
        )
        session.add(service)
        session.commit()
        session.refresh(service)

    last_dep = session.exec(select(Deployment).order_by(Deployment.deployment_number.desc())).first()
    next_num = (last_dep.deployment_number + 1) if last_dep else 127

    status = "failed" if req.fail_deployment else "success"
    risk_eval = DeploymentRiskEngine.evaluate_risk(
        session,
        service_name=req.service_name,
        environment=req.environment,
        change_type=req.change_type,
        changed_files=["config/database.yml"] if "database" in req.change_type else ["src/main.py"],
        component="database_pool" if "database" in req.change_type else "core"
    )

    raw_logs = github_provider.get_deployment_logs(req.service_name, next_num)
    
    dep = Deployment(
        deployment_number=next_num,
        service_id=service.id,
        service_name=service.name,
        environment=req.environment,
        commit_sha=f"sim{next_num}f9",
        commit_message=f"deploy({service.name}): apply {req.change_type} changes for release #{next_num}",
        author=req.author,
        status=status,
        risk_level=risk_eval["risk_level"].lower(),
        risk_reason=risk_eval["reason"],
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        logs_summary="Simulation executed: " + ("Readiness probe failed" if req.fail_deployment else "Healthy rollout"),
        raw_logs=raw_logs
    )
    session.add(dep)
    session.commit()
    session.refresh(dep)

    # Add change
    comp = "database_pool" if "database" in req.change_type else "auth_middleware" if "auth" in req.change_type else "core"
    ch = DeploymentChange(
        deployment_id=dep.id,
        change_type=req.change_type,
        component=comp,
        file_path="config/database.yml" if comp == "database_pool" else "deploy/manifest.yaml",
        diff_snippet="- pool_size: 100\n+ pool_size: 20" if comp == "database_pool" else "+ env: PRODUCTION",
        description=f"Automated simulated change of type {req.change_type}"
    )
    session.add(ch)
    session.commit()

    # If failed, generate associated incident
    inc = None
    if req.fail_deployment:
        fp_info = FailureFingerprintEngine.generate(
            service_name=service.name,
            environment=req.environment,
            component=comp,
            logs=raw_logs,
            symptoms="Redis connection timeout errors reported during checkout surges, 504 Gateway Timeouts"
        )
        inc = Incident(
            incident_code=f"INC-{next_num}",
            title=f"{service.name} Failure on Deployment #{next_num}",
            service_id=service.id,
            service_name=service.name,
            deployment_id=dep.id,
            environment=req.environment,
            severity="critical" if req.environment == "production" else "medium",
            status="investigating",
            failure_fingerprint=fp_info["fingerprint"],
            symptoms_summary="Redis connection timeout errors reported during checkout surges, 504 Gateway Timeouts",
            detected_at=datetime.now(timezone.utc)
        )
        session.add(inc)
        session.commit()
        session.refresh(inc)
    session.refresh(dep)

    return {
        "deployment": {
            "id": dep.id,
            "deployment_number": dep.deployment_number,
            "service_id": dep.service_id,
            "service_name": dep.service_name,
            "environment": dep.environment,
            "commit_sha": dep.commit_sha,
            "commit_message": dep.commit_message,
            "author": dep.author,
            "status": dep.status,
            "risk_level": dep.risk_level,
            "risk_reason": dep.risk_reason,
            "started_at": str(dep.started_at),
            "completed_at": str(dep.completed_at),
            "logs_summary": dep.logs_summary
        },
        "risk_evaluation": risk_eval,
        "incident": {
            "id": inc.id,
            "incident_code": inc.incident_code,
            "title": inc.title,
            "service_id": inc.service_id,
            "service_name": inc.service_name,
            "environment": inc.environment,
            "severity": inc.severity,
            "status": inc.status,
            "failure_fingerprint": inc.failure_fingerprint,
            "symptoms_summary": inc.symptoms_summary
        } if inc else None
    }

@router.post("/analyze")
def analyze_deployment_risk(
    req: RiskAnalysisRequest,
    session: Session = Depends(get_session)
):
    return DeploymentRiskEngine.evaluate_risk(
        session,
        service_name=req.service_name,
        environment=req.environment,
        change_type=req.change_type,
        changed_files=req.changed_files,
        component=req.component
    )
