import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Settings, Plug, FileText, Shield, RefreshCw } from 'lucide-react';
import {
  confirmAutomationLearning,
  fetchAutomationPolicies,
  fetchAutomationRuns,
  fetchAutomationSettings,
  updateAutomationEmergencyStop,
  updateKubernetesAutomation,
  updateAutomationPolicy,
  updateAutomationSettings,
  updateAutomationTarget,
  type AutomationRunItem,
  type AutomationServicePolicy,
  type AutomationSettings,
} from '../services/api';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'security', label: 'Security', icon: Shield },
] as const;

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [servicePolicies, setServicePolicies] = useState<AutomationServicePolicy[]>([]);
  const [automationRuns, setAutomationRuns] = useState<AutomationRunItem[]>([]);
  const [automationError, setAutomationError] = useState('');
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingService, setSavingService] = useState('');
  const [confirmingRun, setConfirmingRun] = useState<number | null>(null);
  const [provider, setProvider] = useState<'github' | 'gitlab' | 'kubernetes'>('github');
  const [repository, setRepository] = useState('');
  const [healthCheckUrl, setHealthCheckUrl] = useState('');
  const [gitlabApiUrl, setGitlabApiUrl] = useState('https://gitlab.com/api/v4');
  const [kubeNamespace, setKubeNamespace] = useState('');
  const [kubeDeployment, setKubeDeployment] = useState('');
  const [kubeContext, setKubeContext] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([fetchAutomationSettings(), fetchAutomationPolicies(), fetchAutomationRuns()])
      .then(([value, policies, runs]) => {
        setAutomation(value);
        setServicePolicies(policies);
        setAutomationRuns(runs);
        if (value.provider === 'github' || value.provider === 'gitlab' || value.provider === 'kubernetes') setProvider(value.provider);
        setRepository(value.repository);
        setHealthCheckUrl(value.health_check_urls?.join('\n') || value.health_check_url);
        if (value.gitlab_api_url) setGitlabApiUrl(value.gitlab_api_url);
        setKubeNamespace(value.kube_namespace);
        setKubeDeployment(value.kube_deployment);
        setKubeContext(value.kube_context);
      })
      .catch(() => setAutomationError('Could not load automation settings.'));
  }, []);

  async function toggleAutomation() {
    if (!automation || savingAutomation) return;
    setSavingAutomation(true);
    setAutomationError('');
    try {
      setAutomation(await updateAutomationSettings(!automation.enabled));
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'Could not update automation settings.');
    } finally {
      setSavingAutomation(false);
    }
  }

  async function saveAutomationTarget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTarget(true);
    setAutomationError('');
    try {
      setAutomation(await updateAutomationTarget({
        provider,
        repository: repository.trim(),
        health_check_urls: healthCheckUrl.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        gitlab_api_url: provider === 'gitlab' ? gitlabApiUrl.trim() : undefined,
        kube_namespace: provider === 'kubernetes' ? kubeNamespace.trim() : undefined,
        kube_deployment: provider === 'kubernetes' ? kubeDeployment.trim() : undefined,
        kube_context: provider === 'kubernetes' ? kubeContext.trim() : undefined,
      }));
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'Could not save automation target.');
    } finally {
      setSavingTarget(false);
    }
  }

  async function toggleEmergencyStop() {
    if (!automation || savingAutomation) return;
    setSavingAutomation(true);
    setAutomationError('');
    try {
      const result = await updateAutomationEmergencyStop(!automation.emergency_stop);
      const refreshed = await fetchAutomationSettings();
      setAutomation({ ...refreshed, emergency_stop: result.emergency_stop });
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'Could not change emergency stop.');
    } finally {
      setSavingAutomation(false);
    }
  }

  async function saveKubernetesSafety(enabled: boolean, dryRun: boolean) {
    if (!automation || savingAutomation) return;
    if (!dryRun && automation.kubernetes_dry_run && !window.confirm('Live Kubernetes restart or rollback may change running workloads. Continue with dry-run disabled?')) return;
    setSavingAutomation(true);
    setAutomationError('');
    try {
      await updateKubernetesAutomation(enabled, dryRun);
      setAutomation(await fetchAutomationSettings());
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'Could not update Kubernetes safety settings.');
    } finally {
      setSavingAutomation(false);
    }
  }

  async function saveServicePolicy(serviceName: string, patch: Partial<AutomationServicePolicy>) {
    const current = servicePolicies.find((policy) => policy.service_name === serviceName);
    if (!current) return;
    setSavingService(serviceName);
    setAutomationError('');
    try {
      const updated = await updateAutomationPolicy(serviceName, {
        enabled: patch.enabled ?? current.enabled,
        allow_retry: patch.allow_retry ?? current.allow_retry,
        allow_restart: patch.allow_restart ?? current.allow_restart,
        allow_rollback: patch.allow_rollback ?? current.allow_rollback,
        cooldown_seconds: patch.cooldown_seconds ?? current.cooldown_seconds,
        max_attempts: patch.max_attempts ?? current.max_attempts,
        health_check_count: patch.health_check_count ?? current.health_check_count,
        health_check_interval_seconds: patch.health_check_interval_seconds ?? current.health_check_interval_seconds,
      });
      setServicePolicies((items) => items.map((item) => item.service_name === serviceName ? updated : item));
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'Could not save service policy.');
    } finally {
      setSavingService('');
    }
  }

  async function confirmRun(runId: number) {
    setConfirmingRun(runId);
    setAutomationError('');
    try {
      await confirmAutomationLearning(runId);
      setAutomationRuns(await fetchAutomationRuns());
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'Could not confirm automation learning.');
    } finally {
      setConfirmingRun(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your OpsMemory configuration"
      />

      <div className="flex gap-6">
        {/* Settings sidebar */}
        <nav className="w-48 space-y-0.5 flex-shrink-0">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <button
            onClick={() => navigate('/integrations')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors text-left"
          >
            <Plug className="h-4 w-4" />
            Integrations
          </button>
          <button
            onClick={() => navigate('/settings/audit')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors text-left"
          >
            <FileText className="h-4 w-4" />
            Audit Log
          </button>
        </nav>

        {/* Content area */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">Organization</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Organization Name</label>
                    <input
                      type="text"
                      defaultValue="Acme Corporation"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Environment</label>
                    <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Production</option>
                      <option>Staging</option>
                      <option>Development</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Automate</h3>
                    <p className="mt-1 max-w-xl text-xs text-gray-500">
                      Allow bounded unattended retries for known low- or medium-severity failures. Limits are configurable per service; higher-risk actions still require approval.
                    </p>
                    {automation && (
                      <p className={`mt-2 text-xs ${automation.ready ? 'text-green-700' : 'text-amber-700'}`}>
                        {automation.message}
                      </p>
                    )}
                    {automationError && <p role="alert" className="mt-2 text-xs text-red-700">{automationError}</p>}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Automate low- and medium-severity incidents"
                    aria-checked={automation?.enabled ?? false}
                    disabled={!automation || savingAutomation}
                    onClick={toggleAutomation}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${automation?.enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${automation?.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <form onSubmit={saveAutomationTarget} className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900">{provider === 'kubernetes' ? 'Kubernetes workload and health checks' : 'Retry target and health checks'}</h3>
                <p className="mt-1 mb-4 max-w-2xl text-xs text-gray-500">
                  {provider === 'kubernetes'
                    ? 'Cluster access uses an in-cluster service account or KUBECONFIG; credentials are not stored here. Restart and rollback require per-service approval in the policy table.'
                    : 'A retry is considered recovered only after the CI run succeeds and every HTTPS endpoint passes the configured observations.'}
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm text-gray-600">
                    CI provider
                    <select value={provider} onChange={(event) => setProvider(event.target.value as 'github' | 'gitlab')} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                      <option value="github">GitHub Actions</option>
                      <option value="gitlab">GitLab CI</option>
                      <option value="kubernetes">Kubernetes</option>
                    </select>
                  </label>
                  <label className="block text-sm text-gray-600">
                    {provider === 'kubernetes' ? 'Source repository mapping' : 'Repository'}
                    <input required value={repository} onChange={(event) => setRepository(event.target.value)} placeholder={provider === 'gitlab' ? 'group/project' : 'owner/repository'} className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                  </label>
                  {provider === 'kubernetes' && (
                    <>
                      <label className="block text-sm text-gray-600">
                        Namespace
                        <input required value={kubeNamespace} onChange={(event) => setKubeNamespace(event.target.value)} placeholder="production" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                      </label>
                      <label className="block text-sm text-gray-600">
                        Deployment name
                        <input required value={kubeDeployment} onChange={(event) => setKubeDeployment(event.target.value)} placeholder="checkout-api" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                      </label>
                      <label className="block text-sm text-gray-600 md:col-span-2">
                        Kubeconfig context (optional)
                        <input value={kubeContext} onChange={(event) => setKubeContext(event.target.value)} placeholder="Uses the current context when empty" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                      </label>
                    </>
                  )}
                  <label className="block text-sm text-gray-600 md:col-span-2">
                    HTTPS health-check URLs, one per line, up to five
                    <textarea required rows={3} value={healthCheckUrl} onChange={(event) => setHealthCheckUrl(event.target.value)} placeholder={'https://service.example.com/health/ready\nhttps://service.example.com/health/dependencies'} className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                  </label>
                  {provider === 'gitlab' && (
                    <label className="block text-sm text-gray-600 md:col-span-2">
                      GitLab API base URL
                      <input type="url" value={gitlabApiUrl} onChange={(event) => setGitlabApiUrl(event.target.value)} className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900" />
                    </label>
                  )}
                </div>
                <button type="submit" disabled={savingTarget} className="mt-4 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                  {savingTarget ? 'Saving...' : 'Save retry target'}
                </button>
              </form>

              {provider === 'kubernetes' && (
                <section className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-medium text-gray-900">Kubernetes execution safety</h3>
                  <p className="mt-1 mb-4 text-xs text-gray-500">Dry-run is on by default. A dry run shows the planned workload change without patching the cluster.</p>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between gap-4 text-sm text-gray-700">
                      <span>Enable Kubernetes actions</span>
                      <input type="checkbox" checked={automation?.kubernetes_enabled ?? false} disabled={!automation || savingAutomation} onChange={(event) => saveKubernetesSafety(event.target.checked, automation?.kubernetes_dry_run ?? true)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    </label>
                    <label className="flex items-center justify-between gap-4 text-sm text-gray-700">
                      <span>Dry-run only, no cluster mutations</span>
                      <input type="checkbox" checked={automation?.kubernetes_dry_run ?? true} disabled={!automation || savingAutomation} onChange={(event) => saveKubernetesSafety(automation?.kubernetes_enabled ?? false, event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    </label>
                  </div>
                </section>
              )}

              <section className="border-t border-gray-100 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Emergency stop</h3>
                    <p className="mt-1 text-xs text-gray-500">Block new automatic remediation across the organization. Jobs already running may need provider-side cancellation.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Emergency stop for automatic remediation"
                    aria-checked={automation?.emergency_stop ?? false}
                    disabled={!automation || savingAutomation}
                    onClick={toggleEmergencyStop}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${automation?.emergency_stop ? 'bg-red-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${automation?.emergency_stop ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </section>

              <section className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900">Service policies</h3>
                <p className="mt-1 mb-4 text-xs text-gray-500">Tune eligibility, cooldown, retry limits, and sustained health checks per service.</p>
                {servicePolicies.length === 0 ? (
                  <p className="text-sm text-gray-500">No services are registered yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1020px] text-left text-xs">
                      <thead className="border-b border-gray-200 text-gray-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Service</th>
                          <th className="py-2 px-2 font-medium">Automation</th>
                          <th className="py-2 px-2 font-medium">Retry</th>
                          <th className="py-2 px-2 font-medium">Restart</th>
                          <th className="py-2 px-2 font-medium">Rollback</th>
                          <th className="py-2 px-2 font-medium">Cooldown</th>
                          <th className="py-2 px-2 font-medium">Attempts</th>
                          <th className="py-2 px-2 font-medium">Health probes</th>
                          <th className="py-2 pl-2 font-medium">Interval</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {servicePolicies.map((policy) => (
                          <tr key={policy.service_name}>
                            <td className="py-3 pr-3 font-medium text-gray-900">{policy.service_name}</td>
                            <td className="py-3 px-2">
                              <input
                                type="checkbox"
                                checked={policy.enabled}
                                disabled={savingService === policy.service_name}
                                aria-label={`Enable automation for ${policy.service_name}`}
                                onChange={(event) => saveServicePolicy(policy.service_name, { enabled: event.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-3 px-2"><input type="checkbox" checked={policy.allow_retry} disabled={savingService === policy.service_name} aria-label={`Allow retry for ${policy.service_name}`} onChange={(event) => saveServicePolicy(policy.service_name, { allow_retry: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" /></td>
                            <td className="py-3 px-2"><input type="checkbox" checked={policy.allow_restart} disabled={savingService === policy.service_name || provider !== 'kubernetes'} title={provider === 'kubernetes' ? 'Allow restart' : 'Select Kubernetes as the target first'} aria-label={`Allow Kubernetes restart for ${policy.service_name}`} onChange={(event) => saveServicePolicy(policy.service_name, { allow_restart: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" /></td>
                            <td className="py-3 px-2"><input type="checkbox" checked={policy.allow_rollback} disabled={savingService === policy.service_name || provider !== 'kubernetes'} title={provider === 'kubernetes' ? 'Allow rollback' : 'Select Kubernetes as the target first'} aria-label={`Allow Kubernetes rollback for ${policy.service_name}`} onChange={(event) => saveServicePolicy(policy.service_name, { allow_rollback: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" /></td>
                            <td className="py-3 px-2">
                              <select value={policy.cooldown_seconds} onChange={(event) => saveServicePolicy(policy.service_name, { cooldown_seconds: Number(event.target.value) })} className="rounded border border-gray-200 bg-white px-2 py-1 text-gray-700">
                                <option value={0}>Off</option><option value={300}>5 min</option><option value={900}>15 min</option><option value={1800}>30 min</option><option value={3600}>1 hour</option>
                              </select>
                            </td>
                            <td className="py-3 px-2">
                              <select value={policy.max_attempts} onChange={(event) => saveServicePolicy(policy.service_name, { max_attempts: Number(event.target.value) })} className="rounded border border-gray-200 bg-white px-2 py-1 text-gray-700">
                                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                              </select>
                            </td>
                            <td className="py-3 px-2">
                              <select value={policy.health_check_count} onChange={(event) => saveServicePolicy(policy.service_name, { health_check_count: Number(event.target.value) })} className="rounded border border-gray-200 bg-white px-2 py-1 text-gray-700">
                                {[1, 2, 3, 5, 10].map((count) => <option key={count} value={count}>{count}</option>)}
                              </select>
                            </td>
                            <td className="py-3 pl-2">
                              <select value={policy.health_check_interval_seconds} onChange={(event) => saveServicePolicy(policy.service_name, { health_check_interval_seconds: Number(event.target.value) })} className="rounded border border-gray-200 bg-white px-2 py-1 text-gray-700">
                                {[0, 5, 10, 30, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-gray-900">Automation runs</h3>
                  <button type="button" title="Refresh automation runs" aria-label="Refresh automation runs" onClick={() => fetchAutomationRuns().then(setAutomationRuns).catch(() => setAutomationError('Could not refresh automation runs.'))} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 divide-y divide-gray-100">
                  {automationRuns.length === 0 ? (
                    <p className="py-3 text-sm text-gray-500">No automation runs recorded.</p>
                  ) : automationRuns.map((run) => (
                    <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {run.service_name || 'Unknown service'} · {run.action} · <span className="capitalize">{run.status}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {run.incident_code || `Incident ${run.incident_id}`} · {run.provider} · {run.provider === 'kubernetes' ? `${run.target_namespace || 'unknown'}/${run.target_deployment || 'unknown'}` : `pipeline ${run.external_pipeline_id || run.pipeline_id}`} · {run.dry_run ? 'dry run, no change made' : `health ${run.health_check_passed === null ? 'not run' : run.health_check_passed ? 'passed' : 'failed'}`}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">{run.reason}</p>
                        {run.dry_run && run.plan_json && (
                          <pre className="mt-2 max-w-2xl overflow-x-auto rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-950">{JSON.stringify(JSON.parse(run.plan_json), null, 2)}</pre>
                        )}
                      </div>
                      {run.status === 'succeeded' && !run.human_confirmed && (
                        <button type="button" disabled={confirmingRun === run.id} onClick={() => confirmRun(run.id)} className="flex-shrink-0 rounded border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                          {confirmingRun === run.id ? 'Saving...' : 'Confirm recovery'}
                        </button>
                      )}
                      {run.human_confirmed && <span className="text-xs font-medium text-emerald-700">Learning confirmed</span>}
                    </div>
                  ))}
                </div>
              </section>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Memory Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">Auto-retain investigation results</span>
                      <p className="text-xs text-gray-500">Automatically store successful investigation outcomes in organizational memory</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">Learn from human corrections</span>
                      <p className="text-xs text-gray-500">Store engineer corrections to improve future investigations</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">Pipeline failure alerts</span>
                      <p className="text-xs text-gray-500">Get notified when a monitored pipeline fails</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">New pattern detection</span>
                      <p className="text-xs text-gray-500">Alert when a new failure pattern is identified</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">API Keys</h3>
                <p className="text-sm text-gray-500 mb-4">Manage API keys for programmatic access to OpsMemory.</p>
                <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                  Generate API Key
                </button>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Webhook Secrets</h3>
                <p className="text-sm text-gray-500">Webhook secrets are managed per integration. Go to Integrations to configure webhook verification.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
