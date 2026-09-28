from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class NormalizedRepository(BaseModel):
    provider: str # "github" | "gitlab"
    external_id: str
    name: str
    full_name: str
    default_branch: str = "main"
    description: Optional[str] = None
    html_url: str
    is_private: bool = False
    branches: List[str] = Field(default_factory=list)

class NormalizedCommit(BaseModel):
    provider: str
    commit_sha: str
    commit_message: str
    author: str
    author_email: Optional[str] = None
    timestamp: Optional[datetime] = None
    changed_files: List[str] = Field(default_factory=list)
    diff_snippets: Dict[str, str] = Field(default_factory=dict) # filepath -> diff
    html_url: Optional[str] = None

class NormalizedJob(BaseModel):
    external_id: str
    name: str
    stage: Optional[str] = None
    status: str # "queued" | "in_progress" | "success" | "failed" | "cancelled"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    logs: Optional[str] = None

class NormalizedPipelineRun(BaseModel):
    provider: str
    repository: str
    external_id: str
    run_number: int
    name: str
    branch: str
    commit_sha: str
    commit_message: str
    author: str
    event_type: str # "push" | "pull_request" | "workflow_dispatch"
    status: str # "in_progress" | "success" | "failed" | "cancelled"
    conclusion: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    html_url: str
    jobs: List[NormalizedJob] = Field(default_factory=list)
    raw_logs: Optional[str] = None
    changed_files: List[str] = Field(default_factory=list)

class NormalizedWebhookPayload(BaseModel):
    provider: str # "github" | "gitlab"
    event_type: str # "workflow_run" | "pipeline" | "push" | "pull_request" | "deployment"
    delivery_id: str
    organization: str
    repository: str
    branch: str
    commit_sha: str
    commit_message: str
    author: str
    environment: str = "production"
    pipeline_id: Optional[str] = None
    pipeline_name: Optional[str] = None
    pipeline_status: str = "in_progress" # "in_progress" | "success" | "failed"
    changed_files: List[str] = Field(default_factory=list)
    logs: Optional[str] = None
    source_url: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    raw_payload: Dict[str, Any] = Field(default_factory=dict)
