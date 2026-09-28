import pytest
from app.services.providers import get_provider, github_provider, gitlab_provider
from app.services.providers.models import NormalizedWebhookPayload

@pytest.mark.asyncio
async def test_github_provider_discovery():
    repos = await github_provider.list_repositories()
    assert len(repos) > 0
    assert any(r.name == "payment-api" for r in repos)
    
    repo = await github_provider.get_repository("payment-api")
    assert repo is not None
    assert repo.provider == "github"

@pytest.mark.asyncio
async def test_gitlab_provider_discovery():
    repos = await gitlab_provider.list_repositories()
    assert len(repos) > 0
    assert any(r.name == "payment-api" for r in repos)
    
    repo = await gitlab_provider.get_repository("payment-api")
    assert repo is not None
    assert repo.provider == "gitlab"

@pytest.mark.asyncio
async def test_provider_commit_normalization():
    commit_gh = await github_provider.get_commit_details("payment-api", "a7b8c9d")
    assert commit_gh is not None
    assert commit_gh.commit_sha == "a7b8c9d"
    assert "config/database.yml" in commit_gh.changed_files

    commit_gl = await gitlab_provider.get_commit_details("payment-api", "gl_c98f12a")
    assert commit_gl is not None
    assert "config/database.yml" in commit_gl.changed_files

def test_github_webhook_normalization():
    payload = {
        "repository": {"name": "payment-api", "owner": {"login": "acme"}},
        "workflow_run": {
            "id": 101,
            "name": "Deploy Payment API",
            "head_branch": "main",
            "head_sha": "a7b8c9d",
            "conclusion": "failure",
            "actor": {"login": "alex.dev"},
            "head_commit": {"message": "tune pool"}
        }
    }
    headers = {"X-GitHub-Event": "workflow_run", "X-GitHub-Delivery": "del-123"}
    norm = github_provider.normalize_webhook(headers, payload)
    assert norm is not None
    assert norm.provider == "github"
    assert norm.pipeline_status == "failed"
    assert norm.commit_sha == "a7b8c9d"

def test_gitlab_webhook_normalization():
    payload = {
        "object_kind": "pipeline",
        "project": {"name": "payment-api", "namespace": "fintech"},
        "object_attributes": {
            "id": 127,
            "ref": "main",
            "sha": "gl_c98f12a",
            "status": "failed"
        },
        "commit": {
            "id": "gl_c98f12a",
            "message": "update database pool",
            "author": {"name": "elena"}
        }
    }
    headers = {"X-Gitlab-Event": "Pipeline Hook"}
    norm = gitlab_provider.normalize_webhook(headers, payload)
    assert norm is not None
    assert norm.provider == "gitlab"
    assert norm.pipeline_status == "failed"
    assert norm.pipeline_id == "127"
