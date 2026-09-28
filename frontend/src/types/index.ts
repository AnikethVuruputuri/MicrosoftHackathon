export interface Service {
  id: number;
  name: string;
  description: string;
  repository: string;
  owner_team: string;
  tier: string;
  status: string;
  created_at: string;
}

export interface DeploymentChange {
  id: number;
  deployment_id: number;
  change_type: string;
  component: string;
  file_path: string;
  diff_snippet: string;
  description: string;
}

export interface Deployment {
  id: number;
  deployment_number: number;
  service_id: number;
  service_name: string;
  environment: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  status: 'success' | 'failed' | 'rolled_back' | 'in_progress' | 'pending';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_reason?: string;
  started_at: string;
  completed_at?: string;
  logs_summary?: string;
  raw_logs?: string;
  changes?: DeploymentChange[];
}

export interface IncidentEvent {
  id: number;
  incident_id: number;
  timestamp: string;
  event_type: string;
  stage_name?: string;
  summary: string;
  details?: string;
}

export interface AgentDiagnosis {
  id?: number;
  diagnosis_text: string;
  root_cause_hypothesis: string;
  confidence_score: number;
  evidence_summary: string;
  recommended_action: string;
  historical_matches_found: number;
  is_accepted?: boolean;
}

export interface HumanCorrection {
  id?: number;
  incident_id?: number;
  engineer_name: string;
  incorrect_hypothesis: string;
  correction_text: string;
  actual_root_cause: string;
  remediation_guidance: string;
  failure_fingerprint: string;
  created_at?: string;
}

export interface ResolutionEffectiveness {
  remediation_action: string;
  success_count: number;
  failure_count: number;
  total_attempts: number;
  success_rate_percent: number;
  avg_recovery_time_minutes: number;
  recommended: boolean;
}

export interface MemoryReference {
  id?: number;
  incident_id: number;
  memory_id: string;
  memory_type: string;
  relevance_score: number;
  source: string;
  content_snippet: string;
  recalled_at: string;
}

export interface Incident {
  id: number;
  incident_code: string;
  title: string;
  service_id: number;
  service_name: string;
  deployment_id?: number;
  environment: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'investigating' | 'diagnosing' | 'corrected' | 'resolved' | 'closed';
  failure_fingerprint?: string;
  symptoms_summary: string;
  detected_at: string;
  resolved_at?: string;
  initial_diagnosis?: string;
  human_correction?: string;
  confirmed_root_cause?: string;
  remediation_applied?: string;
  resolution_status?: string;
  recovery_time_seconds?: number;
  retained_in_hindsight: boolean;
}

export interface FailurePattern {
  id: number;
  pattern_name: string;
  category: string;
  common_trigger: string;
  common_symptom: string;
  common_root_cause: string;
  recommended_remediation: string;
  occurrence_count: number;
  services_affected: string;
  last_seen_at: string;
}

export interface IntegrationInfo {
  id: number;
  provider: 'github' | 'gitlab';
  status: 'connected' | 'disconnected' | 'error';
  auth_type: string;
  account_name: string;
  account_id: string;
  webhook_status: string;
  repositories_monitored: number;
  last_sync_at?: string;
  created_at: string;
}

export interface RepositoryInfo {
  id: number;
  org_id: number;
  provider: 'github' | 'gitlab';
  external_repo_id: string;
  name: string;
  full_name: string;
  default_branch: string;
  monitored_branch: string;
  environment: string;
  is_monitored: boolean;
  status: string;
  last_sync_at?: string;
}

export interface AuditLogItem {
  id: number;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: string;
  created_at: string;
}

export interface SystemStatus {
  backend: string;
  groq_status: string;
  groq_mode: 'REAL' | 'FALLBACK';
  groq_model: string;
  hindsight_status: string;
  hindsight_mode: 'REAL' | 'FALLBACK';
  hindsight_bank: string;
  database_status: string;
  database_type: string;
  github_status: string;
  github_mode: 'REAL' | 'DEMO';
  gitlab_status?: string;
  gitlab_mode?: 'REAL' | 'DEMO';
  background_worker?: string;
}

export interface DashboardData {
  current_deployment: Deployment | null;
  recent_incidents: Incident[];
  learning_metrics: {
    total_deployments: number;
    total_incidents: number;
    human_corrections: number;
    failure_patterns_mined: number;
    hindsight_memories_retained: number;
  };
  historical_effectiveness: ResolutionEffectiveness[];
  services_count: number;
  demo_before_after: {
    scenario: string;
    fingerprint: string;
    before_learning: {
      ai_initial: string;
      engineer_correction: string;
      retained_to_hindsight: boolean;
    };
    after_learning: {
      ai_recalled: string;
      ai_recommendation: string;
    };
  };
}

export interface StageLog {
  stage: string;
  title: string;
  status: 'completed' | 'running' | 'pending';
  summary: string;
}
