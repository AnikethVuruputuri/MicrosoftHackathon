import {
  DashboardData,
  Deployment,
  Incident,
  FailurePattern,
  SystemStatus,
  StageLog,
  IntegrationInfo,
  RepositoryInfo,
  AuditLogItem,
  PipelinesResponse,
  PipelineRun,
  AutomationAction,
  AutomationPolicy,
  AutomationDashboardData
} from '../types';

const API_BASE = '/api';

export interface AutomationSettings {
  enabled: boolean;
  emergency_stop: boolean;
  ready: boolean;
  executor_configured: boolean;
  target_configured: boolean;
  message: string;
  provider: string | null;
  repository: string;
  health_check_url: string;
  health_check_urls: string[];
  gitlab_api_url: string;
  kube_namespace: string;
  kube_deployment: string;
  kube_context: string;
  kubernetes_enabled: boolean;
  kubernetes_dry_run: boolean;
}

export interface AutomationServicePolicy {
  service_name: string;
  enabled: boolean;
  allow_retry: boolean;
  allow_restart: boolean;
  allow_rollback: boolean;
  cooldown_seconds: number;
  max_attempts: number;
  health_check_count: number;
  health_check_interval_seconds: number;
}

export interface AutomationRunItem {
  id: number;
  incident_id: number;
  incident_code: string | null;
  service_name: string | null;
  provider: string;
  repository: string;
  pipeline_id: string;
  external_pipeline_id: string | null;
  action: string;
  status: string;
  reason: string;
  health_check_passed: boolean | null;
  execution_attempted: boolean;
  compensated: boolean | null;
  human_confirmed: boolean;
  dry_run: boolean;
  target_namespace: string | null;
  target_deployment: string | null;
  plan_json: string | null;
  started_at: string;
}

export async function fetchSystemAutomationSettings(): Promise<AutomationSettings> {
  const res = await fetch(`${API_BASE}/system/automation`);
  if (!res.ok) throw new Error('Failed to fetch automation settings');
  return res.json();
}

export async function updateSystemAutomationSettings(enabled: boolean): Promise<AutomationSettings> {
  const res = await fetch(`${API_BASE}/system/automation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update automation settings');
  }
  return res.json();
}

export async function updateAutomationTarget(data: {
  provider: 'github' | 'gitlab' | 'kubernetes';
  repository: string;
  health_check_urls: string[];
  gitlab_api_url?: string;
  kube_namespace?: string;
  kube_deployment?: string;
  kube_context?: string;
}): Promise<AutomationSettings> {
  const res = await fetch(`${API_BASE}/system/automation/target`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to save automation target');
  }
  return res.json();
}

export async function updateAutomationEmergencyStop(enabled: boolean): Promise<{ emergency_stop: boolean }> {
  const res = await fetch(`${API_BASE}/system/automation/emergency-stop`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to change emergency stop');
  return res.json();
}

export async function updateKubernetesAutomation(enabled: boolean, dryRun: boolean): Promise<{
  kubernetes_enabled: boolean;
  kubernetes_dry_run: boolean;
}> {
  const res = await fetch(`${API_BASE}/system/automation/kubernetes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, dry_run: dryRun }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update Kubernetes automation settings');
  }
  return res.json();
}

export async function fetchAutomationPolicies(): Promise<AutomationServicePolicy[]> {
  const res = await fetch(`${API_BASE}/system/automation/policies`);
  if (!res.ok) throw new Error('Failed to fetch service automation policies');
  return res.json();
}

export async function updateAutomationPolicy(
  serviceName: string,
  policy: Omit<AutomationServicePolicy, 'service_name'>,
): Promise<AutomationServicePolicy> {
  const res = await fetch(`${API_BASE}/system/automation/policies/${encodeURIComponent(serviceName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  });
  if (!res.ok) throw new Error('Failed to update service automation policy');
  return res.json();
}

export async function fetchAutomationRuns(): Promise<AutomationRunItem[]> {
  const res = await fetch(`${API_BASE}/system/automation/runs`);
  if (!res.ok) throw new Error('Failed to fetch automation runs');
  return res.json();
}

export async function confirmAutomationLearning(runId: number, notes?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/system/automation/runs/${runId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error('Could not confirm the automation result');
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  return res.json();
}

export async function fetchDeployments(serviceName?: string): Promise<Deployment[]> {
  const url = serviceName ? `${API_BASE}/deployments?service_name=${serviceName}` : `${API_BASE}/deployments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch deployments');
  return res.json();
}

export async function fetchDeploymentDetail(id: number): Promise<Deployment> {
  const res = await fetch(`${API_BASE}/deployments/${id}`);
  if (!res.ok) throw new Error('Failed to fetch deployment detail');
  return res.json();
}

export async function fetchIncidents(status?: string): Promise<Incident[]> {
  const url = status ? `${API_BASE}/incidents?status=${status}` : `${API_BASE}/incidents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncidentDetail(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch incident detail');
  return res.json();
}

export async function runInvestigation(incidentId: number): Promise<{
  status: string;
  incident: Incident;
  diagnosis: any;
  stage_logs: StageLog[];
  recalled_memories: any[];
  historical_corrections: any[];
  historical_resolutions: any[];
}> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to execute agent investigation');
  return res.json();
}

export async function submitHumanCorrection(
  incidentId: number,
  data: {
    engineer_name: string;
    correction_text: string;
    actual_root_cause: string;
    suggested_action?: string;
  }
): Promise<{
  status: string;
  message: string;
  incident: Incident;
  learning_summary?: string;
  stage_logs: StageLog[];
}> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/correction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incident_id: incidentId, ...data })
  });
  if (!res.ok) throw new Error('Failed to submit human correction');
  return res.json();
}

export async function applyResolution(
  incidentId: number,
  remediationAction: string
): Promise<{ status: string; incident: Incident }> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/resolution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incident_id: incidentId, remediation_action: remediationAction, success: true })
  });
  if (!res.ok) throw new Error('Failed to record resolution');
  return res.json();
}

export async function fetchMemories(params?: { service?: string; memory_type?: string; fingerprint?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params?.service) query.append('service', params.service);
  if (params?.memory_type) query.append('memory_type', params.memory_type);
  if (params?.fingerprint) query.append('fingerprint', params.fingerprint);
  
  const res = await fetch(`${API_BASE}/memory?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch memories');
  return res.json();
}

export async function fetchFailurePatterns(): Promise<FailurePattern[]> {
  const res = await fetch(`${API_BASE}/failure-patterns`);
  if (!res.ok) throw new Error('Failed to fetch failure patterns');
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/system/status`);
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
}

export async function simulateDeployment(data: {
  service_name: string;
  environment: string;
  change_type: string;
  fail_deployment: boolean;
  author: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/deployments/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to simulate deployment');
  return res.json();
}

// Integrations APIs
export async function fetchIntegrations(): Promise<IntegrationInfo[]> {
  const res = await fetch(`${API_BASE}/integrations`);
  if (!res.ok) throw new Error('Failed to fetch integrations');
  return res.json();
}

export async function getOAuthUrl(provider: string): Promise<{ authorization_url: string }> {
  const res = await fetch(`${API_BASE}/integrations/${provider}/auth-url`);
  if (!res.ok) throw new Error(`Failed to get OAuth URL for ${provider}`);
  return res.json();
}

export async function submitOAuthCallback(provider: string, code: string): Promise<any> {
  const res = await fetch(`${API_BASE}/integrations/${provider}/oauth-callback?code=${encodeURIComponent(code)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to connect ${provider}`);
  return res.json();
}

export async function connectIntegration(data: {
  provider: string;
  token: string;
  gitlab_url?: string;
  account_name?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/integrations/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to connect ${data.provider}`);
  }
  return res.json();
}

export async function disconnectIntegration(provider: string): Promise<any> {
  const res = await fetch(`${API_BASE}/integrations/${provider}/disconnect`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to disconnect ${provider}`);
  return res.json();
}

export async function syncIntegration(provider: string): Promise<any> {
  const res = await fetch(`${API_BASE}/integrations/${provider}/sync`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to sync ${provider}`);
  return res.json();
}

// Repositories APIs
export async function fetchRepositories(): Promise<RepositoryInfo[]> {
  const res = await fetch(`${API_BASE}/repositories`);
  if (!res.ok) throw new Error('Failed to fetch repositories');
  return res.json();
}

export async function discoverRepositories(provider: string = 'github'): Promise<any> {
  const res = await fetch(`${API_BASE}/repositories/discover?provider=${provider}`);
  if (!res.ok) throw new Error(`Failed to discover repositories for ${provider}`);
  return res.json();
}

export async function onboardRepository(data: {
  provider: string;
  external_repo_id: string;
  name: string;
  full_name: string;
  monitored_branch: string;
  environment: string;
  enable_monitoring: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/repositories/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to onboard repository');
  return res.json();
}

// Audit Logs API
export async function fetchAuditLogs(): Promise<AuditLogItem[]> {
  const res = await fetch(`${API_BASE}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

// Pipelines API
export async function fetchPipelines(params?: {
  repository?: string;
  status?: string;
  branch?: string;
}): Promise<PipelinesResponse> {
  const query = new URLSearchParams();
  if (params?.repository) query.append('repository', params.repository);
  if (params?.status) query.append('status', params.status);
  if (params?.branch) query.append('branch', params.branch);

  const res = await fetch(`${API_BASE}/pipelines?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch pipeline workflow runs');
  return res.json();
}

// Automation & Recovery API
export async function fetchAutomationStatus(): Promise<any> {
  const res = await fetch(`${API_BASE}/automation/status`);
  if (!res.ok) throw new Error('Failed to fetch automation status');
  return res.json();
}

export async function fetchAutomationDashboard(): Promise<AutomationDashboardData> {
  const res = await fetch(`${API_BASE}/automation/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch automation dashboard');
  return res.json();
}

export async function fetchAutomationActions(params?: {
  status?: string;
  action_type?: string;
  incident_id?: number;
  limit?: number;
}): Promise<AutomationAction[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.action_type) query.append('action_type', params.action_type);
  if (params?.incident_id) query.append('incident_id', params.incident_id.toString());
  if (params?.limit) query.append('limit', params.limit.toString());

  const res = await fetch(`${API_BASE}/automation/actions?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch automation actions');
  return res.json();
}

export async function fetchAutomationAction(id: number): Promise<AutomationAction> {
  const res = await fetch(`${API_BASE}/automation/actions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch automation action #${id}`);
  return res.json();
}

export async function approveAutomationAction(
  id: number,
  approvedBy: string = 'SRE On-Call',
  reason?: string
): Promise<{ status: string; action: AutomationAction }> {
  const res = await fetch(`${API_BASE}/automation/actions/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true, approved_by: approvedBy, reason })
  });
  if (!res.ok) throw new Error('Failed to approve automation action');
  return res.json();
}

export async function rejectAutomationAction(
  id: number,
  approvedBy: string = 'SRE On-Call',
  reason?: string
): Promise<{ status: string; action: AutomationAction }> {
  const res = await fetch(`${API_BASE}/automation/actions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: false, approved_by: approvedBy, reason })
  });
  if (!res.ok) throw new Error('Failed to reject automation action');
  return res.json();
}

export async function submitAutomationFeedback(
  id: number,
  feedback: 'appropriate' | 'inappropriate' | 'neutral',
  notes?: string
): Promise<{ status: string; action: AutomationAction }> {
  const res = await fetch(`${API_BASE}/automation/actions/${id}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback, notes })
  });
  if (!res.ok) throw new Error('Failed to submit automation feedback');
  return res.json();
}

export async function simulateAutomation(
  scenario: string,
  dryRun: boolean = false,
  serviceName?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/automation/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, dry_run: dryRun, service_name: serviceName })
  });
  if (!res.ok) throw new Error('Failed to execute automation simulation');
  return res.json();
}

export async function fetchAutomationSettings(): Promise<AutomationPolicy> {
  const res = await fetch(`${API_BASE}/automation/settings`);
  if (!res.ok) throw new Error('Failed to fetch automation settings');
  return res.json();
}

export async function updateAutomationSettings(
  policy: Partial<AutomationPolicy>
): Promise<AutomationPolicy> {
  const res = await fetch(`${API_BASE}/automation/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy)
  });
  if (!res.ok) throw new Error('Failed to update automation settings');
  return res.json();
}

export interface PostMortemData {
  incident_code: string;
  title: string;
  service: string;
  environment: string;
  severity: string;
  status: string;
  mttr_seconds: number;
  root_cause: string;
  remediation_applied: string;
  failure_fingerprint?: string;
  timeline: Array<{
    id: number;
    incident_id: number;
    event_type: string;
    stage_name?: string;
    summary: string;
    details?: string;
    created_at: string;
  }>;
  markdown_report: string;
}

export interface TeamsCardData {
  incident_code: string;
  channel: string;
  action_code: string;
  adaptive_card: Record<string, any>;
}

export async function fetchIncidentPostMortem(incidentId: number): Promise<PostMortemData> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/post-mortem`);
  if (!res.ok) throw new Error('Failed to fetch incident post-mortem');
  return res.json();
}

export async function fetchIncidentTeamsCard(incidentId: number): Promise<TeamsCardData> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/teams-card`);
  if (!res.ok) throw new Error('Failed to fetch incident war room card');
  return res.json();
}


