from typing import Dict
from app.services.providers.base import DevOpsProvider
from app.services.providers.github import github_provider, GitHubProvider
from app.services.providers.gitlab import gitlab_provider, GitLabProvider
from app.services.providers.models import (
    NormalizedRepository,
    NormalizedCommit,
    NormalizedPipelineRun,
    NormalizedJob,
    NormalizedWebhookPayload
)

_PROVIDERS: Dict[str, DevOpsProvider] = {
    "github": github_provider,
    "gitlab": gitlab_provider
}

def get_provider(provider_name: str) -> DevOpsProvider:
    provider = _PROVIDERS.get(provider_name.lower())
    if not provider:
        raise ValueError(f"Unsupported DevOps provider: '{provider_name}'. Supported: {list(_PROVIDERS.keys())}")
    return provider

__all__ = [
    "DevOpsProvider",
    "GitHubProvider",
    "GitLabProvider",
    "github_provider",
    "gitlab_provider",
    "get_provider",
    "NormalizedRepository",
    "NormalizedCommit",
    "NormalizedPipelineRun",
    "NormalizedJob",
    "NormalizedWebhookPayload"
]
