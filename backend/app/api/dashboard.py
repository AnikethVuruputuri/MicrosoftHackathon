from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from app.database.session import get_session
from app.models.schemas import (
    Deployment,
    Incident,
    HumanCorrection,
    FailurePattern,
    ResolutionOutcome,
    Service
)
from app.services.effectiveness import ResolutionEffectivenessEngine
from app.hindsight.client import hindsight_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_summary(session: Session = Depends(get_session)) -> Dict[str, Any]:
    # 1. Latest Deployment
    latest_dep = session.exec(select(Deployment).order_by(Deployment.id.desc())).first()

    # 2. Recent Incidents
    recent_incidents = session.exec(select(Incident).order_by(Incident.id.desc()).limit(5)).all()

    # 3. Learning Activity Statistics
    total_deployments = session.exec(select(func.count(Deployment.id))).one()
    total_incidents = session.exec(select(func.count(Incident.id))).one()
    total_corrections = session.exec(select(func.count(HumanCorrection.id))).one()
    total_patterns = session.exec(select(func.count(FailurePattern.id))).one()
    hindsight_memories = len(hindsight_service.local_memories)

    # 4. Remediation Effectiveness Stats
    effectiveness_stats = ResolutionEffectivenessEngine.get_effectiveness_for_fingerprint(session)

    # 5. Services Overview
    services = session.exec(select(Service)).all()

    return {
        "current_deployment": latest_dep.model_dump() if latest_dep else None,
        "recent_incidents": [inc.model_dump() for inc in recent_incidents],
        "learning_metrics": {
            "total_deployments": total_deployments,
            "total_incidents": total_incidents,
            "human_corrections": total_corrections,
            "failure_patterns_mined": total_patterns,
            "hindsight_memories_retained": hindsight_memories
        },
        "historical_effectiveness": effectiveness_stats,
        "services_count": len(services),
        "demo_before_after": {
            "scenario": "Payment API Under Concurrency Burst",
            "fingerprint": "PAYMENT_API_DB_POOL_PRODUCTION",
            "before_learning": {
                "ai_initial": "Redis connectivity failure / Cache socket timeout. Recommended flush cache and restart Redis cluster.",
                "engineer_correction": "Incorrect. Redis timeout is only a downstream symptom. PostgreSQL connection pool exhaustion is the root cause.",
                "retained_to_hindsight": True
            },
            "after_learning": {
                "ai_recalled": "OpsMemory recalled previous engineer correction for PAYMENT_API_DB_POOL_PRODUCTION. Identified PostgreSQL pool exhaustion as true root cause.",
                "ai_recommendation": "Increase database connection pool size from 20 to 100 (100% historical success rate)."
            }
        }
    }
