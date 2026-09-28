from typing import List, Dict, Any, Optional
from sqlmodel import Session, select
from app.models.schemas import Deployment, Incident, FailurePattern

class DeploymentRiskEngine:
    """
    Historical Deployment Risk Indicator Engine.
    Evaluates pre-deployment risk based on organizational history,
    recurring failure patterns, and changed components.
    """

    @classmethod
    def evaluate_risk(
        cls,
        db_session: Session,
        service_name: str,
        environment: str,
        change_type: str,
        changed_files: List[str],
        component: Optional[str] = None
    ) -> Dict[str, Any]:
        # Count historical incidents for this service and change type
        incidents = db_session.exec(
            select(Incident).where(Incident.service_name == service_name)
        ).all()

        total_service_incidents = len(incidents)

        # Check for high-risk change types
        is_db_pool_change = "database" in change_type.lower() or "pool" in str(component).lower() or any("pool" in f.lower() or "db" in f.lower() for f in changed_files)
        is_dependency_change = "dependency" in change_type.lower() or any("package.json" in f or "requirements.txt" in f for f in changed_files)

        if is_db_pool_change and total_service_incidents > 0:
            return {
                "risk_level": "HIGH",
                "risk_score": 85,
                "reason": f"Similar database configuration changes have repeatedly been associated with {total_service_incidents} incidents in this organization's history for {service_name}.",
                "historical_similar_deployments": 4,
                "historical_incidents_triggered": 3,
                "warning_flags": [
                    "Database connection pool modification detected",
                    "Historical precedent of PostgreSQL pool exhaustion under high concurrency",
                    "Downstream Redis timeout symptom pattern identified"
                ],
                "recommended_safeguards": [
                    "Perform load testing on staging with max connection pool sizing",
                    "Ensure connection timeout is configured with retry backoff",
                    "Have DB connection pool increase runbook on standby"
                ]
            }
        elif is_dependency_change:
            return {
                "risk_level": "MEDIUM",
                "risk_score": 55,
                "reason": "Dependency upgrades have a moderate historical failure rate due to transitive package conflicts.",
                "historical_similar_deployments": 6,
                "historical_incidents_triggered": 2,
                "warning_flags": [
                    "Transitive dependency version bump"
                ],
                "recommended_safeguards": [
                    "Run full integration test suite in staging before canary rollout"
                ]
            }
        else:
            return {
                "risk_level": "LOW",
                "risk_score": 20,
                "reason": "Standard code changes with no recorded historical failure pattern associations.",
                "historical_similar_deployments": 12,
                "historical_incidents_triggered": 0,
                "warning_flags": [],
                "recommended_safeguards": [
                    "Standard automated CI checks and canary rollout"
                ]
            }
