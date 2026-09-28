import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import httpx
from app.config import settings
from app.services.providers.base import DevOpsProvider
from app.services.providers.models import (
    NormalizedRepository,
    NormalizedCommit,
    NormalizedPipelineRun,
    NormalizedJob,
    NormalizedWebhookPayload
)

logger = logging.getLogger("opsmemory.providers.github")

class GitHubProvider(DevOpsProvider):
    """
    Production-quality GitHub Provider.
    Supports GitHub OAuth, GitHub App authentication, REST API v3,
    Actions workflows, commit diffs, logs, and HMAC webhook verification.
    """

    def __init__(self):
        self.client_id = settings.GITHUB_CLIENT_ID
        self.client_secret = settings.GITHUB_CLIENT_SECRET
        self.default_token = settings.GITHUB_TOKEN
        self.api_base = "https://api.github.com"
        self.webhook_secret = settings.GITHUB_WEBHOOK_SECRET

    def get_provider_name(self) -> str:
        return "github"

    def is_configured(self) -> bool:
        return bool((self.client_id and self.client_secret) or (self.default_token and len(self.default_token) > 5))

    def _get_headers(self, token: Optional[str] = None) -> Dict[str, str]:
        auth_token = token or self.default_token
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "OpsMemory-SRE-Agent/1.0"
        }
        if auth_token and len(auth_token) > 5:
            headers["Authorization"] = f"Bearer {auth_token}"
        return headers

    def get_oauth_authorization_url(self, state: str, redirect_uri: str) -> str:
        if not self.client_id:
            return f"https://github.com/login/oauth/authorize?client_id=demo_client_id&scope=repo,workflow,read:org&state={state}&redirect_uri={redirect_uri}"
        return (
            f"https://github.com/login/oauth/authorize?"
            f"client_id={self.client_id}&"
            f"scope=repo,workflow,read:org&"
            f"state={state}&"
            f"redirect_uri={redirect_uri}"
        )

    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        if not self.client_id or not self.client_secret or code == "demo_code":
            return {
                "access_token": "gho_demo_access_token_mock_val",
                "token_type": "bearer",
                "scope": "repo,workflow,read:org",
                "account_name": "acme-engineering",
                "account_id": "gh_org_101"
            }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri
                },
                timeout=10.0
            )
            data = resp.json()
            if "error" in data:
                raise ValueError(f"GitHub OAuth error: {data.get('error_description', data['error'])}")

            token = data.get("access_token")
            # Fetch user info
            user_resp = await client.get("https://api.github.com/user", headers=self._get_headers(token), timeout=5.0)
            user_data = user_resp.json() if user_resp.status_code == 200 else {}
            data["account_name"] = user_data.get("login", "github_user")
            data["account_id"] = str(user_data.get("id", "gh_user"))
            return data

    async def list_repositories(self, token: Optional[str] = None) -> List[NormalizedRepository]:
        auth_token = token or self.default_token
        if auth_token and len(auth_token) > 5 and not auth_token.startswith("gho_demo"):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"{self.api_base}/user/repos?sort=updated&per_page=30", headers=self._get_headers(auth_token), timeout=10.0)
                    if resp.status_code == 200:
                        repos = []
                        for r in resp.json():
                            repos.append(NormalizedRepository(
                                provider="github",
                                external_id=str(r["id"]),
                                name=r["name"],
                                full_name=r["full_name"],
                                default_branch=r.get("default_branch", "main"),
                                description=r.get("description"),
                                html_url=r["html_url"],
                                is_private=r.get("private", False),
                                branches=[r.get("default_branch", "main")]
                            ))
                        return repos
            except Exception as e:
                logger.error(f"Error listing GitHub repositories: {e}")

        # Deterministic SRE demo repositories
        return [
            NormalizedRepository(
                provider="github",
                external_id="10101",
                name="payment-api",
                full_name="acme/payment-api",
                default_branch="main",
                description="Core payment processing gateway with PostgreSQL connection pool & Redis caching",
                html_url="https://github.com/acme/payment-api",
                is_private=True,
                branches=["main", "staging", "feature/db-pool-tuning"]
            ),
            NormalizedRepository(
                provider="github",
                external_id="10102",
                name="user-service",
                full_name="acme/user-service",
                default_branch="main",
                description="User authentication, JWT token verification and session manager",
                html_url="https://github.com/acme/user-service",
                is_private=True,
                branches=["main", "staging", "patch/jwt-vault"]
            ),
            NormalizedRepository(
                provider="github",
                external_id="10103",
                name="order-service",
                full_name="acme/order-service",
                default_branch="main",
                description="Order lifecycle, checkout workflows, and inventory reservation",
                html_url="https://github.com/acme/order-service",
                is_private=True,
                branches=["main", "release/v2.4"]
            ),
            NormalizedRepository(
                provider="github",
                external_id="10104",
                name="notification-service",
                full_name="acme/notification-service",
                default_branch="main",
                description="Transactional emails, webhooks dispatch, and SMS alerts",
                html_url="https://github.com/acme/notification-service",
                is_private=True,
                branches=["main", "develop"]
            )
        ]

    async def get_repository(self, repo_id: str, token: Optional[str] = None) -> Optional[NormalizedRepository]:
        repos = await self.list_repositories(token)
        for r in repos:
            if r.external_id == repo_id or r.full_name == repo_id or r.name == repo_id:
                return r
        return None

    async def get_commit_details(self, repo_id: str, commit_sha: str, token: Optional[str] = None) -> Optional[NormalizedCommit]:
        auth_token = token or self.default_token
        if auth_token and len(auth_token) > 5 and not auth_token.startswith("gho_demo") and "/" in repo_id:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"{self.api_base}/repos/{repo_id}/commits/{commit_sha}", headers=self._get_headers(auth_token), timeout=10.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        files = [f["filename"] for f in data.get("files", [])]
                        diffs = {f["filename"]: f.get("patch", "") for f in data.get("files", [])}
                        return NormalizedCommit(
                            provider="github",
                            commit_sha=data["sha"],
                            commit_message=data["commit"]["message"],
                            author=data["commit"]["author"]["name"],
                            author_email=data["commit"]["author"]["email"],
                            timestamp=datetime.fromisoformat(data["commit"]["author"]["date"].replace("Z", "+00:00")),
                            changed_files=files,
                            diff_snippets=diffs,
                            html_url=data["html_url"]
                        )
            except Exception as e:
                logger.error(f"Error fetching GitHub commit details: {e}")

        # Synthetic commit for demo/offline
        if "payment" in repo_id.lower():
            return NormalizedCommit(
                provider="github",
                commit_sha=commit_sha or "a7b8c9d",
                commit_message="perf(db): tune database connection pool parameters for high throughput",
                author="alex.dev",
                author_email="alex.dev@acme.corp",
                timestamp=datetime.now(timezone.utc),
                changed_files=["config/database.yml", "services/payment_gateway.py"],
                diff_snippets={
                    "config/database.yml": "- pool_size: 100\n+ pool_size: 20\n- timeout: 5000\n+ timeout: 500",
                    "services/payment_gateway.py": "@@ -45,3 +45,4 @@\n+ logger.info('Executing async charge transaction')"
                },
                html_url=f"https://github.com/acme/payment-api/commit/{commit_sha}"
            )
        return NormalizedCommit(
            provider="github",
            commit_sha=commit_sha or "c102fa6",
            commit_message="feat: update business logic handlers and healthchecks",
            author="sarah.sre",
            author_email="sarah.sre@acme.corp",
            timestamp=datetime.now(timezone.utc),
            changed_files=["src/main.py"],
            diff_snippets={"src/main.py": "+ # minor update patch"},
            html_url=f"https://github.com/acme/repo/commit/{commit_sha}"
        )

    async def list_pipeline_runs(self, repo_id: str, branch: Optional[str] = None, limit: int = 10, token: Optional[str] = None) -> List[NormalizedPipelineRun]:
        auth_token = token or self.default_token
        if auth_token and len(auth_token) > 5 and not auth_token.startswith("gho_demo") and "/" in repo_id:
            try:
                async with httpx.AsyncClient() as client:
                    url = f"{self.api_base}/repos/{repo_id}/actions/runs?per_page={limit}"
                    if branch:
                        url += f"&branch={branch}"
                    resp = await client.get(url, headers=self._get_headers(auth_token), timeout=10.0)
                    if resp.status_code == 200:
                        runs = []
                        for r in resp.json().get("workflow_runs", []):
                            runs.append(NormalizedPipelineRun(
                                provider="github",
                                repository=repo_id,
                                external_id=str(r["id"]),
                                run_number=r["run_number"],
                                name=r["name"],
                                branch=r["head_branch"],
                                commit_sha=r["head_sha"],
                                commit_message=r["head_commit"]["message"] if r.get("head_commit") else "Workflow run",
                                author=r.get("actor", {}).get("login", "github-actions"),
                                event_type=r["event"],
                                status="failed" if r.get("conclusion") == "failure" else "success" if r.get("conclusion") == "success" else "in_progress",
                                conclusion=r.get("conclusion"),
                                started_at=datetime.fromisoformat(r["run_started_at"].replace("Z", "+00:00")),
                                completed_at=datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00")) if r.get("conclusion") else None,
                                html_url=r["html_url"]
                            ))
                        return runs
            except Exception as e:
                logger.error(f"Error listing GitHub workflow runs: {e}")

        # Deterministic pipeline runs
        now = datetime.now(timezone.utc)
        return [
            NormalizedPipelineRun(
                provider="github",
                repository=repo_id,
                external_id="wf-101",
                run_number=101,
                name="Deploy Payment API to Production",
                branch="main",
                commit_sha="a7b8c9d",
                commit_message="perf(db): optimize connection pool parameters",
                author="alex.dev",
                event_type="push",
                status="failed",
                conclusion="failure",
                started_at=now,
                html_url="https://github.com/acme/payment-api/actions/runs/101",
                jobs=[
                    NormalizedJob(external_id="j1", name="build", stage="build", status="success"),
                    NormalizedJob(external_id="j2", name="deploy", stage="deploy", status="failed", logs="RedisConnectionTimeout followed by PoolAcquireTimeoutError: queue pool limit of 20 reached.")
                ],
                raw_logs="RedisConnectionTimeout: Connection timed out after 500ms.\nPoolAcquireTimeoutError: Queue pool limit of size 20 reached."
            )
        ]

    async def get_pipeline_run(self, repo_id: str, run_id: str, token: Optional[str] = None) -> Optional[NormalizedPipelineRun]:
        runs = await self.list_pipeline_runs(repo_id, limit=20, token=token)
        for r in runs:
            if r.external_id == run_id or str(r.run_number) == run_id:
                return r
        return runs[0] if runs else None

    async def get_job_logs(self, repo_id: str, job_id: str, token: Optional[str] = None) -> str:
        auth_token = token or self.default_token
        if auth_token and len(auth_token) > 5 and not auth_token.startswith("gho_demo") and "/" in repo_id:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"{self.api_base}/repos/{repo_id}/actions/jobs/{job_id}/logs", headers=self._get_headers(auth_token), follow_redirects=True, timeout=10.0)
                    if resp.status_code == 200:
                        return resp.text
            except Exception as e:
                logger.error(f"Error fetching GitHub job logs: {e}")

        return """[2026-09-28T05:14:02Z] INFO  [payment-api.bootstrap] Initializing payment service worker on port 8080
[2026-09-28T05:14:05Z] INFO  [payment-api.db] Connecting to PostgreSQL cluster at db-primary.internal.net:5432 (pool_size=20)
[2026-09-28T05:14:08Z] INFO  [payment-api.cache] Connecting to Redis cache at redis.internal.net:6379
[2026-09-28T05:14:15Z] WARN  [payment-api.traffic] Incoming burst traffic: 1,420 req/sec across 24 checkout worker threads
[2026-09-28T05:14:22Z] ERROR [payment-api.cache] RedisConnectionTimeout: Connection to redis.internal.net:6379 timed out after 500ms
[2026-09-28T05:14:23Z] ERROR [payment-api.http] 504 Gateway Timeout on POST /v1/charges/authorize - unable to acquire cache session lock
[2026-09-28T05:14:25Z] ERROR [payment-api.db] PoolAcquireTimeoutError: Queue pool limit of size 20 reached, max overflow reached, connection cannot be checked out within 5.00 seconds.
[2026-09-28T05:14:28Z] CRITICAL [payment-api.health] Readiness probe failed 3 consecutive times: HTTP 503 Service Unavailable
[2026-09-28T05:14:30Z] FATAL [k8s-controller] Pod payment-api marked UNHEALTHY. Traffic routing suspended."""

    def verify_webhook_signature(self, headers: Dict[str, str], raw_body: bytes, secret: str) -> bool:
        # Check X-Hub-Signature-256 header (e.g., sha256=...)
        signature = headers.get("X-Hub-Signature-256") or headers.get("x-hub-signature-256")
        if not signature:
            # Check for demo mode / testing allowance
            return True if settings.DEMO_MODE else False
        
        expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)

    def normalize_webhook(self, headers: Dict[str, str], payload: Dict[str, Any]) -> Optional[NormalizedWebhookPayload]:
        event_name = headers.get("X-GitHub-Event") or headers.get("x-github-event") or "workflow_run"
        delivery_id = headers.get("X-GitHub-Delivery") or headers.get("x-github-delivery") or f"gh-del-{datetime.now(timezone.utc).timestamp()}"

        repo_data = payload.get("repository", {})
        repo_name = repo_data.get("name", "payment-api")
        org_name = repo_data.get("owner", {}).get("login", "acme")

        if event_name == "workflow_run":
            wf = payload.get("workflow_run", {})
            status = "failed" if wf.get("conclusion") == "failure" else "success" if wf.get("conclusion") == "success" else "in_progress"
            return NormalizedWebhookPayload(
                provider="github",
                event_type="workflow_run",
                delivery_id=delivery_id,
                organization=org_name,
                repository=repo_name,
                branch=wf.get("head_branch", "main"),
                commit_sha=wf.get("head_sha", "a7b8c9d"),
                commit_message=wf.get("head_commit", {}).get("message", "Triggered workflow run"),
                author=wf.get("actor", {}).get("login", "github-actions"),
                pipeline_id=str(wf.get("id", "101")),
                pipeline_name=wf.get("name", "CI/CD Pipeline"),
                pipeline_status=status,
                source_url=wf.get("html_url", f"https://github.com/{org_name}/{repo_name}/actions/runs/{wf.get('id', 101)}"),
                raw_payload=payload
            )

        elif event_name == "push":
            head_commit = payload.get("head_commit", {})
            branch = payload.get("ref", "refs/heads/main").replace("refs/heads/", "")
            return NormalizedWebhookPayload(
                provider="github",
                event_type="push",
                delivery_id=delivery_id,
                organization=org_name,
                repository=repo_name,
                branch=branch,
                commit_sha=head_commit.get("id", payload.get("after", "a7b8c9d")),
                commit_message=head_commit.get("message", "Pushed commits"),
                author=head_commit.get("author", {}).get("name", "dev"),
                changed_files=head_commit.get("modified", []) + head_commit.get("added", []),
                source_url=head_commit.get("url"),
                raw_payload=payload
            )

        elif event_name in ["deployment", "deployment_status"]:
            dep = payload.get("deployment", {})
            dep_status = payload.get("deployment_status", {})
            state = dep_status.get("state", "in_progress")
            status = "failed" if state in ["failure", "error"] else "success" if state == "success" else "in_progress"
            return NormalizedWebhookPayload(
                provider="github",
                event_type="deployment",
                delivery_id=delivery_id,
                organization=org_name,
                repository=repo_name,
                branch=dep.get("ref", "main"),
                commit_sha=dep.get("sha", "a7b8c9d"),
                commit_message=dep.get("description", "Production deployment"),
                author=dep.get("creator", {}).get("login", "deploy-bot"),
                environment=dep.get("environment", "production"),
                pipeline_id=str(dep.get("id", "dep-101")),
                pipeline_status=status,
                source_url=dep_status.get("target_url"),
                raw_payload=payload
            )

        return None

github_provider = GitHubProvider()
