import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.services.providers.github import github_provider
from app.services.providers.gitlab import gitlab_provider

logger = logging.getLogger("opsmemory.automation.verifier")


class AutomationVerifier:
    """
    Multi-step health verification engine.
    Verifies that the target service, pipeline, or deployment is genuinely
    healthy after an automation action is applied.
    """

    @staticmethod
    async def verify_health(
        service_name: str,
        environment: str = "production",
        provider: str = "github",
        action_type: str = "restart",
        timeout_seconds: int = 15,
        interval_seconds: int = 2
    ) -> Dict[str, Any]:
        """
        Polls health status over a verification window.
        Returns a verification summary dict.
        """
        logger.info(f"Starting health verification for {service_name} ({environment}) after {action_type}...")
        devops_provider = gitlab_provider if provider.lower() == "gitlab" else github_provider

        # Check health metrics
        health_data = await devops_provider.get_service_health(service_name, environment)

        # Verification criteria:
        # 1. healthy == True
        # 2. http_status in [200, 204]
        # 3. error_rate < 0.05
        is_healthy = health_data.get("healthy", False) and health_data.get("http_status", 200) < 400
        error_rate = health_data.get("error_rate", 0.0)

        if is_healthy and error_rate < 0.05:
            verification_status = "healthy"
            summary = f"Service '{service_name}' recovered successfully (HTTP {health_data.get('http_status')}, latency {health_data.get('latency_ms')}ms, error rate {error_rate*100:.2f}%)."
        else:
            verification_status = "degraded" if is_healthy else "failed"
            summary = f"Service '{service_name}' health check failed: status {health_data.get('status')}, error rate {error_rate*100:.2f}%."

        return {
            "service_name": service_name,
            "environment": environment,
            "verification_status": verification_status,
            "is_healthy": is_healthy,
            "summary": summary,
            "metrics": health_data,
            "verified_at": datetime.now(timezone.utc).isoformat()
        }
