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
  PipelineRun
} from '../types';

const API_BASE = '/api';

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
