from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ----------------- Multi-Tenancy & Auth Models -----------------

class Organization(SQLModel, table=True):
    __tablename__ = "organizations"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    hindsight_bank_id: str = Field(default="opsmemory-demo", index=True)
    created_at: datetime = Field(default_factory=utc_now)

    users: List["User"] = Relationship(back_populates="org_rel")
    integrations: List["Integration"] = Relationship(back_populates="org_rel")
    repositories: List["Repository"] = Relationship(back_populates="org_rel")
    services: List["Service"] = Relationship(back_populates="org_rel")
    audit_logs: List["AuditLog"] = Relationship(back_populates="org_rel")


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organizations.id", index=True)
    email: str = Field(unique=True, index=True)
    name: str
    hashed_password: str
    role: str = "admin" # admin, engineer, viewer
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)

    org_rel: Optional[Organization] = Relationship(back_populates="users")


class Integration(SQLModel, table=True):
    __tablename__ = "integrations"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organizations.id", index=True)
    provider: str = Field(index=True) # github, gitlab
    status: str = Field(default="connected") # connected, disconnected, error
    auth_type: str = Field(default="oauth") # oauth, app, token
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    encrypted_token: Optional[str] = None
    encrypted_refresh_token: Optional[str] = None
    webhook_secret: Optional[str] = None
    metadata_json: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    org_rel: Optional[Organization] = Relationship(back_populates="integrations")
    repositories: List["Repository"] = Relationship(back_populates="integration_rel")


class Repository(SQLModel, table=True):
    __tablename__ = "repositories"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organizations.id", index=True)
    integration_id: Optional[int] = Field(default=None, foreign_key="integrations.id", index=True)
    provider: str = Field(default="github", index=True) # github, gitlab
    external_repo_id: str = Field(index=True)
    name: str = Field(index=True)
    full_name: str = Field(index=True)
    default_branch: str = "main"
    monitored_branch: str = "main"
    environment: str = "production"
    is_monitored: bool = True
    status: str = "active" # active, paused, archived
    last_sync_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)

    org_rel: Optional[Organization] = Relationship(back_populates="repositories")
    integration_rel: Optional[Integration] = Relationship(back_populates="repositories")
    pipelines: List["Pipeline"] = Relationship(back_populates="repository_rel")


class Pipeline(SQLModel, table=True):
    __tablename__ = "pipelines"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    repository_id: int = Field(foreign_key="repositories.id", index=True)
    external_pipeline_id: str = Field(index=True)
    name: str = Field(index=True)
    workflow_file: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=utc_now)

    repository_rel: Optional[Repository] = Relationship(back_populates="pipelines")
    runs: List["PipelineRun"] = Relationship(back_populates="pipeline_rel")


class PipelineRun(SQLModel, table=True):
    __tablename__ = "pipeline_runs"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    pipeline_id: int = Field(foreign_key="pipelines.id", index=True)
    external_run_id: str = Field(index=True)
    run_number: int
    commit_sha: str = Field(index=True)
    commit_message: Optional[str] = None
    author: Optional[str] = None
    branch: str = "main"
    event_type: str = "push" # push, pull_request, workflow_dispatch
    status: str = Field(default="in_progress", index=True) # success, failed, in_progress, cancelled
    conclusion: Optional[str] = None
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: Optional[datetime] = None
    html_url: Optional[str] = None
    raw_logs: Optional[str] = None
    logs_summary: Optional[str] = None

    pipeline_rel: Optional[Pipeline] = Relationship(back_populates="runs")
    jobs: List["PipelineJob"] = Relationship(back_populates="run_rel")


class PipelineJob(SQLModel, table=True):
    __tablename__ = "pipeline_jobs"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    pipeline_run_id: int = Field(foreign_key="pipeline_runs.id", index=True)
    external_job_id: str = Field(index=True)
    name: str
    stage: Optional[str] = None
    status: str = "queued" # queued, in_progress, completed, failed
    conclusion: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    raw_logs: Optional[str] = None

    run_rel: Optional[PipelineRun] = Relationship(back_populates="jobs")


class WebhookEvent(SQLModel, table=True):
    __tablename__ = "webhook_events"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: Optional[int] = Field(default=None, index=True)
    provider: str = Field(index=True) # github, gitlab
    event_type: str = Field(index=True)
    delivery_id: str = Field(unique=True, index=True)
    payload_hash: str = Field(index=True)
    status: str = Field(default="received", index=True) # received, processing, processed, duplicate, ignored, error
    error_message: Optional[str] = None
    received_at: datetime = Field(default_factory=utc_now)
    processed_at: Optional[datetime] = None


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organizations.id", index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    actor: str = "system"
    action: str = Field(index=True) # integration_connected, incident_created, diagnosis_generated, correction_submitted, resolution_applied, memory_retained
    resource_type: str = Field(index=True)
    resource_id: str
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

    org_rel: Optional[Organization] = Relationship(back_populates="audit_logs")


# ----------------- Core SRE & DevOps Domain Models -----------------

class Service(SQLModel, table=True):
    __tablename__ = "services"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=1, foreign_key="organizations.id", index=True)
    name: str = Field(index=True, unique=True)
    description: str
    repository: str
    owner_team: str
    tier: str = "tier-1"
    status: str = "operational" # operational, degraded, incident
    created_at: datetime = Field(default_factory=utc_now)

    org_rel: Optional[Organization] = Relationship(back_populates="services")
    deployments: List["Deployment"] = Relationship(back_populates="service_rel")
    incidents: List["Incident"] = Relationship(back_populates="service_rel")


class Deployment(SQLModel, table=True):
    __tablename__ = "deployments"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=1, index=True)
    deployment_number: int = Field(index=True) # e.g. 101, 127
    service_id: int = Field(foreign_key="services.id", index=True)
    service_name: str = Field(index=True)
    repository_id: Optional[int] = Field(default=None, foreign_key="repositories.id")
    pipeline_run_id: Optional[int] = Field(default=None, foreign_key="pipeline_runs.id")
    environment: str = Field(default="production") # production, staging
    commit_sha: str
    commit_message: str
    author: str
    status: str = Field(default="pending") # success, failed, rolled_back, in_progress
    risk_level: str = "low" # low, medium, high, critical
    risk_reason: Optional[str] = None
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: Optional[datetime] = None
    logs_summary: Optional[str] = None
    raw_logs: Optional[str] = None

    service_rel: Optional[Service] = Relationship(back_populates="deployments")
    changes: List["DeploymentChange"] = Relationship(back_populates="deployment_rel")
    incidents: List["Incident"] = Relationship(back_populates="deployment_rel")


class DeploymentChange(SQLModel, table=True):
    __tablename__ = "deployment_changes"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    deployment_id: int = Field(foreign_key="deployments.id", index=True)
    change_type: str # config, dependency, code, schema, env_var
    component: str # e.g. database_pool, redis_client, auth_middleware
    file_path: str
    diff_snippet: str
    description: str

    deployment_rel: Optional[Deployment] = Relationship(back_populates="changes")


class Incident(SQLModel, table=True):
    __tablename__ = "incidents"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=1, index=True)
    incident_code: str = Field(unique=True, index=True) # e.g. INC-101, INC-127
    title: str
    service_id: int = Field(foreign_key="services.id", index=True)
    service_name: str = Field(index=True)
    deployment_id: Optional[int] = Field(default=None, foreign_key="deployments.id")
    pipeline_run_id: Optional[int] = Field(default=None, foreign_key="pipeline_runs.id")
    environment: str = "production"
    severity: str = "high" # critical, high, medium, low
    status: str = "investigating" # open, investigating, diagnosing, corrected, resolved, closed
    failure_fingerprint: Optional[str] = Field(default=None, index=True)
    symptoms_summary: str
    detected_at: datetime = Field(default_factory=utc_now)
    resolved_at: Optional[datetime] = None
    
    # AI & Human fields
    initial_diagnosis: Optional[str] = None
    human_correction: Optional[str] = None
    confirmed_root_cause: Optional[str] = None
    remediation_applied: Optional[str] = None
    resolution_status: Optional[str] = None # success, failed, rollback
    recovery_time_seconds: Optional[int] = None
    retained_in_hindsight: bool = False

    service_rel: Optional[Service] = Relationship(back_populates="incidents")
    deployment_rel: Optional[Deployment] = Relationship(back_populates="incidents")
    events: List["IncidentEvent"] = Relationship(back_populates="incident_rel")
    diagnoses: List["AgentDiagnosis"] = Relationship(back_populates="incident_rel")
    corrections: List["HumanCorrection"] = Relationship(back_populates="incident_rel")
    memory_references: List["MemoryReference"] = Relationship(back_populates="incident_rel")


class IncidentEvent(SQLModel, table=True):
    __tablename__ = "incident_events"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    incident_id: int = Field(foreign_key="incidents.id", index=True)
    timestamp: datetime = Field(default_factory=utc_now)
    event_type: str # alert, log_error, agent_start, diagnosis_made, human_correction, fix_applied, resolved, memory_retained
    stage_name: Optional[str] = None # LangGraph stage
    summary: str
    details: Optional[str] = None

    incident_rel: Optional[Incident] = Relationship(back_populates="events")


class AgentDiagnosis(SQLModel, table=True):
    __tablename__ = "agent_diagnoses"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    incident_id: int = Field(foreign_key="incidents.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    diagnosis_text: str
    root_cause_hypothesis: str
    confidence_score: float = 0.85
    evidence_summary: str
    recommended_action: str
    is_accepted: Optional[bool] = None # None=pending, True=accepted, False=corrected/rejected
    historical_matches_found: int = 0
    raw_llm_response: Optional[str] = None

    incident_rel: Optional[Incident] = Relationship(back_populates="diagnoses")


class HumanCorrection(SQLModel, table=True):
    __tablename__ = "human_corrections"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=1, index=True)
    incident_id: int = Field(foreign_key="incidents.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    engineer_name: str = "SRE On-Call"
    incorrect_hypothesis: str
    correction_text: str
    actual_root_cause: str
    remediation_guidance: str
    failure_fingerprint: str
    retained_to_hindsight: bool = True

    incident_rel: Optional[Incident] = Relationship(back_populates="corrections")


class RemediationAction(SQLModel, table=True):
    __tablename__ = "remediation_actions"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    action_name: str # e.g. "Increase DB pool size", "Rollback deployment", "Restart service"
    category: str # config, infra, code, rollback
    description: str
    default_parameters: Optional[str] = None


class ResolutionOutcome(SQLModel, table=True):
    __tablename__ = "resolution_outcomes"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=1, index=True)
    incident_code: str = Field(index=True)
    service_name: str = Field(index=True)
    failure_fingerprint: str = Field(index=True)
    remediation_action: str = Field(index=True)
    success: bool
    recovery_time_minutes: int
    rollback_required: bool = False
    engineer_confirmed: bool = True
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


class MemoryReference(SQLModel, table=True):
    __tablename__ = "memory_references"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    incident_id: int = Field(foreign_key="incidents.id", index=True)
    memory_id: str
    memory_type: str # deployment, incident, human_correction, resolution, engineering_knowledge
    relevance_score: float = 0.95
    source: str # hindsight, local_index
    content_snippet: str
    recalled_at: datetime = Field(default_factory=utc_now)

    incident_rel: Optional[Incident] = Relationship(back_populates="memory_references")


class FailurePattern(SQLModel, table=True):
    __tablename__ = "failure_patterns"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(default=1, index=True)
    pattern_name: str = Field(unique=True, index=True)
    category: str
    common_trigger: str
    common_symptom: str
    common_root_cause: str
    recommended_remediation: str
    occurrence_count: int = 1
    services_affected: str # JSON or comma-separated list
    last_seen_at: datetime = Field(default_factory=utc_now)


# ----------------- Pydantic DTO Schemas -----------------

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    org_name: str = "Default Org"

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    organization: Dict[str, Any]

class InvestigationRequest(BaseModel):
    incident_id: int
    force_fresh: bool = False

class CorrectionRequest(BaseModel):
    incident_id: int
    engineer_name: str = "DevOps Engineer"
    correction_text: str
    actual_root_cause: str
    suggested_action: Optional[str] = None

class ResolutionRequest(BaseModel):
    incident_id: int
    remediation_action: str
    success: bool = True
    recovery_time_minutes: int = 3
    notes: Optional[str] = None

class DeploymentSimulateRequest(BaseModel):
    service_name: str
    environment: str = "production"
    change_type: str = "database_config" # database_config, dependency_upgrade, redis_config, env_var, clean_code
    fail_deployment: bool = True
    author: str = "alex.dev"

class RiskAnalysisRequest(BaseModel):
    service_name: str
    environment: str
    change_type: str
    changed_files: List[str] = []
    component: str = "database_pool"

class RepositoryOnboardRequest(BaseModel):
    provider: str = "github" # github, gitlab
    external_repo_id: str
    name: str
    full_name: str
    monitored_branch: str = "main"
    environment: str = "production"
    enable_monitoring: bool = True

class IntegrationConnectRequest(BaseModel):
    provider: str # github, gitlab
    token: Optional[str] = None
    account_name: Optional[str] = None

class SystemStatusResponse(BaseModel):
    backend: str = "Operational"
    groq_status: str = "Connected"
    groq_mode: str = "REAL" # REAL or FALLBACK
    groq_model: str = "llama-3.3-70b-versatile"
    hindsight_status: str = "Connected"
    hindsight_mode: str = "REAL" # REAL or FALLBACK
    hindsight_bank: str = "opsmemory-demo"
    database_status: str = "Operational"
    database_type: str = "PostgreSQL / SQLite"
    github_status: str = "Connected"
    github_mode: str = "REAL" # REAL or DEMO
    gitlab_status: str = "Connected"
    gitlab_mode: str = "REAL" # REAL or DEMO
    background_worker: str = "Operational"
