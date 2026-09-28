from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from app.services.providers.models import (
    NormalizedRepository,
    NormalizedCommit,
    NormalizedPipelineRun,
    NormalizedWebhookPayload
)

class DevOpsProvider(ABC):
    """
    Abstract DevOps Provider.
    Normalized interface for GitHub and GitLab CI/CD platforms.
    """

    @abstractmethod
    def get_provider_name(self) -> str:
        """Returns provider identifier: 'github' or 'gitlab'."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if provider credentials / tokens are configured."""
        pass

    @abstractmethod
    def get_oauth_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Constructs OAuth login URL."""
        pass

    @abstractmethod
    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchanges OAuth code for access token and user info."""
        pass

    @abstractmethod
    async def validate_and_get_user(self, token: str, custom_url: Optional[str] = None) -> Dict[str, Any]:
        """Validates token directly against provider API and returns user profile."""
        pass

    @abstractmethod
    async def list_repositories(self, token: Optional[str] = None) -> List[NormalizedRepository]:
        """Discovers accessible repositories/projects."""
        pass

    @abstractmethod
    async def get_repository(self, repo_id: str, token: Optional[str] = None) -> Optional[NormalizedRepository]:
        """Fetches repository details and branches."""
        pass

    @abstractmethod
    async def get_commit_details(self, repo_id: str, commit_sha: str, token: Optional[str] = None) -> Optional[NormalizedCommit]:
        """Fetches commit metadata, changed files, and file diffs."""
        pass

    @abstractmethod
    async def list_pipeline_runs(self, repo_id: str, branch: Optional[str] = None, limit: int = 10, token: Optional[str] = None) -> List[NormalizedPipelineRun]:
        """Fetches workflow / pipeline runs."""
        pass

    @abstractmethod
    async def get_pipeline_run(self, repo_id: str, run_id: str, token: Optional[str] = None) -> Optional[NormalizedPipelineRun]:
        """Fetches pipeline run details, jobs, and execution status."""
        pass

    @abstractmethod
    async def get_job_logs(self, repo_id: str, job_id: str, token: Optional[str] = None) -> str:
        """Fetches execution logs for a pipeline job."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, headers: Dict[str, str], raw_body: bytes, secret: str) -> bool:
        """Verifies cryptographic signature or secret of incoming webhook."""
        pass

    @abstractmethod
    def normalize_webhook(self, headers: Dict[str, str], payload: Dict[str, Any]) -> Optional[NormalizedWebhookPayload]:
        """Converts raw provider webhook payload into normalized OpsMemory event."""
        pass
