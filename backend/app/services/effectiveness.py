from typing import List, Dict, Any, Optional
from sqlmodel import Session, select
from app.models.schemas import ResolutionOutcome

class ResolutionEffectivenessEngine:
    """
    Computes statistical resolution effectiveness across historical organizational remediations.
    """

    @classmethod
    def get_effectiveness_for_fingerprint(
        cls,
        db_session: Session,
        fingerprint: Optional[str] = None,
        service_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = select(ResolutionOutcome)
        if fingerprint:
            query = query.where(ResolutionOutcome.failure_fingerprint == fingerprint)
        elif service_name:
            query = query.where(ResolutionOutcome.service_name == service_name)

        outcomes = db_session.exec(query).all()
        
        # If no specific outcomes found, retrieve all to provide baseline organizational data
        if not outcomes:
            outcomes = db_session.exec(select(ResolutionOutcome)).all()

        action_stats: Dict[str, Dict[str, Any]] = {}

        for outcome in outcomes:
            action = outcome.remediation_action
            if action not in action_stats:
                action_stats[action] = {
                    "action": action,
                    "success_count": 0,
                    "failure_count": 0,
                    "total_count": 0,
                    "avg_recovery_time_min": 0,
                    "total_recovery_time": 0,
                    "rollback_rate": 0.0,
                    "rollback_count": 0
                }
            
            stats = action_stats[action]
            stats["total_count"] += 1
            if outcome.success:
                stats["success_count"] += 1
            else:
                stats["failure_count"] += 1
            
            stats["total_recovery_time"] += outcome.recovery_time_minutes
            if outcome.rollback_required:
                stats["rollback_count"] += 1

        results = []
        for action, data in action_stats.items():
            tot = data["total_count"]
            success_rate = (data["success_count"] / tot) * 100 if tot > 0 else 0.0
            avg_rec = round(data["total_recovery_time"] / tot, 1) if tot > 0 else 0.0
            results.append({
                "remediation_action": action,
                "success_count": data["success_count"],
                "failure_count": data["failure_count"],
                "total_attempts": tot,
                "success_rate_percent": round(success_rate, 1),
                "avg_recovery_time_minutes": avg_rec,
                "recommended": success_rate >= 80.0
            })

        # Sort by success rate descending
        results.sort(key=lambda x: x["success_rate_percent"], reverse=True)
        return results
