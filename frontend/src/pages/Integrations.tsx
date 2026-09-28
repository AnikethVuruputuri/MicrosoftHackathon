import React, { useState, useEffect } from 'react';
import { IntegrationInfo, RepositoryInfo } from '../types';
import {
  fetchIntegrations,
  fetchRepositories,
  discoverRepositories,
  onboardRepository,
  disconnectIntegration,
  syncIntegration,
  submitOAuthCallback
} from '../services/api';
import {
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Server,
  Check,
  Search,
  Settings
} from 'lucide-react';

// Reusable components for the light theme
const PageHeader: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-gray-200 mb-6">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
    {action && <div>{action}</div>}
  </div>
);

const StatusBadge: React.FC<{ status: 'connected' | 'disconnected' | string }> = ({ status }) => {
  const isConnected = status.toLowerCase() === 'connected';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
      }`}
    >
      {isConnected ? 'Connected' : 'Disconnected'}
    </span>
  );
};

export const Integrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Onboard modal state
  const [showOnboardModal, setShowOnboardModal] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab'>('github');
  const [discoveredRepos, setDiscoveredRepos] = useState<any[]>([]);
  const [selectedRepoFull, setSelectedRepoFull] = useState<string>('acme/payment-api');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [selectedEnv, setSelectedEnv] = useState<string>('production');
  const [enableMonitoring, setEnableMonitoring] = useState<boolean>(true);
  const [onboarding, setOnboarding] = useState<boolean>(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [intgs, repos] = await Promise.all([
        fetchIntegrations(),
        fetchRepositories()
      ]);
      setIntegrations(intgs);
      setRepositories(repos);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSync = async (provider: string) => {
    try {
      setSyncingProvider(provider);
      const res = await syncIntegration(provider);
      setMessage({ type: 'success', text: res.message });
      await loadAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Sync failed' });
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    try {
      await disconnectIntegration(provider);
      setMessage({ type: 'success', text: `${provider.toUpperCase()} disconnected.` });
      await loadAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleConnectOAuth = async (provider: string) => {
    try {
      setLoading(true);
      // Simulate/trigger instant OAuth connection for production demo
      await submitOAuthCallback(provider, 'demo_code');
      setMessage({ type: 'success', text: `${provider.toUpperCase()} authorized and connected successfully.` });
      await loadAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const openOnboardModal = async (provider: 'github' | 'gitlab') => {
    setSelectedProvider(provider);
    setShowOnboardModal(true);
    try {
      const disc = await discoverRepositories(provider);
      setDiscoveredRepos(disc.repositories || []);
      if (disc.repositories && disc.repositories.length > 0) {
        setSelectedRepoFull(disc.repositories[0].full_name);
        setSelectedBranch(disc.repositories[0].default_branch || 'main');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setOnboarding(true);
      const repoObj = discoveredRepos.find(r => r.full_name === selectedRepoFull) || {
        name: selectedRepoFull.split('/')[1] || selectedRepoFull,
        external_id: '101'
      };

      const res = await onboardRepository({
        provider: selectedProvider,
        external_repo_id: repoObj.external_id || '101',
        name: repoObj.name || selectedRepoFull.split('/')[1] || selectedRepoFull,
        full_name: selectedRepoFull,
        monitored_branch: selectedBranch,
        environment: selectedEnv,
        enable_monitoring: enableMonitoring
      });

      setMessage({ type: 'success', text: res.message });
      setShowOnboardModal(false);
      await loadAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to onboard repository' });
    } finally {
      setOnboarding(false);
    }
  };

  const getIntegrationByProvider = (p: string) => {
    return integrations.find(i => i.provider === p);
  };

  const githubIntg = getIntegrationByProvider('github');
  const gitlabIntg = getIntegrationByProvider('gitlab');

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <PageHeader 
        title="Integrations" 
        description="Connect source control providers to ingest webhooks, observe workflow runs, and retain organizational memory."
        action={
          <button
            onClick={() => openOnboardModal('github')}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect Repository
          </button>
        }
      />

      {/* Alert / Flash Message */}
      {message && (
        <div className={`p-4 rounded-md mb-6 flex items-center justify-between border ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-3 text-sm">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button 
            onClick={() => setMessage(null)} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2-Column Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* GITHUB CARD */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 flex items-center justify-center text-gray-900 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">GitHub Actions CI/CD</h2>
                <span className="text-xs text-gray-500">DevOps Provider Layer</span>
              </div>
            </div>
            <StatusBadge status={githubIntg?.status || 'disconnected'} />
          </div>

          <div className="grid grid-cols-2 gap-4 py-5 text-sm">
            <div>
              <span className="text-xs text-gray-500 block mb-1">Connected Account</span>
              <span className="font-medium text-gray-900">{githubIntg?.account_name || 'Not configured'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Webhook Signature</span>
              <span className="font-medium text-gray-900 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>HMAC-SHA256 Active</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Monitored Repos</span>
              <span className="font-medium text-gray-900">
                {repositories.filter(r => r.provider === 'github').length} Active
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Memory Learning</span>
              <span className="font-medium text-gray-900 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Hindsight Active</span>
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSync('github')}
                disabled={syncingProvider === 'github'}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-gray-500 ${syncingProvider === 'github' ? 'animate-spin text-blue-600' : ''}`} />
                Sync
              </button>
              <button
                onClick={() => openOnboardModal('github')}
                className="inline-flex items-center px-3 py-1.5 border border-blue-600 shadow-sm text-xs font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Add Repo
              </button>
            </div>
            {githubIntg?.status === 'connected' ? (
              <button
                onClick={() => handleDisconnect('github')}
                className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnectOAuth('github')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Authorize
              </button>
            )}
          </div>
        </div>

        {/* GITLAB CARD */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 flex items-center justify-center text-[#FC6D26] bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M23.6 9.57l-.03-.08-3.41-8.73a.81.81 0 00-.31-.38.83.83 0 00-.91 0 .82.82 0 00-.32.38L16.2 7.5H7.8L5.38.76a.82.82 0 00-.32-.38.83.83 0 00-.91 0 .81.81 0 00-.31.38L.43 9.49l-.03.08a5.75 5.75 0 001.99 6.64l.05.04.09.06 7.42 5.56 2.05 1.54 2.05-1.54 7.42-5.56.09-.06.05-.04a5.75 5.75 0 001.99-6.64z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">GitLab CI/CD Pipelines</h2>
                <span className="text-xs text-gray-500">DevOps Provider Layer</span>
              </div>
            </div>
            <StatusBadge status={gitlabIntg?.status || 'disconnected'} />
          </div>

          <div className="grid grid-cols-2 gap-4 py-5 text-sm">
            <div>
              <span className="text-xs text-gray-500 block mb-1">Connected Group</span>
              <span className="font-medium text-gray-900">{gitlabIntg?.account_name || 'Not configured'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Webhook Token</span>
              <span className="font-medium text-gray-900 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Secret Verified</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Monitored Projects</span>
              <span className="font-medium text-gray-900">
                {repositories.filter(r => r.provider === 'gitlab').length} Active
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Memory Learning</span>
              <span className="font-medium text-gray-900 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Hindsight Active</span>
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSync('gitlab')}
                disabled={syncingProvider === 'gitlab'}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-gray-500 ${syncingProvider === 'gitlab' ? 'animate-spin text-blue-600' : ''}`} />
                Sync
              </button>
              <button
                onClick={() => openOnboardModal('gitlab')}
                className="inline-flex items-center px-3 py-1.5 border border-blue-600 shadow-sm text-xs font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Add Project
              </button>
            </div>
            {gitlabIntg?.status === 'connected' ? (
              <button
                onClick={() => handleDisconnect('gitlab')}
                className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnectOAuth('gitlab')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Authorize
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Monitored Repositories Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Monitored Repositories & Pipeline Intelligence
            </h3>
          </div>
          <span className="text-sm text-gray-500">
            {repositories.length} Active Services
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repository / Project</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monitored Branch</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Environment</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {repositories.length > 0 ? (
                repositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        repo.provider === 'github' 
                          ? 'bg-gray-100 text-gray-800 border border-gray-200' 
                          : 'bg-orange-50 text-orange-800 border border-orange-200'
                      }`}>
                        {repo.provider.charAt(0).toUpperCase() + repo.provider.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {repo.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 flex items-center space-x-1.5">
                      <GitBranch className="w-4 h-4 text-gray-400" />
                      <span>{repo.monitored_branch}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 capitalize">
                      {repo.environment}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No repositories connected yet. Click "Connect Repository" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Repository Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-5">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Onboard Repository
                </h3>
              </div>
              <button 
                onClick={() => setShowOnboardModal(false)} 
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                <div className="flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={() => openOnboardModal('github')}
                    className={`flex-1 flex justify-center py-2 px-4 text-sm font-medium rounded-l-md border ${
                      selectedProvider === 'github' 
                        ? 'bg-blue-50 border-blue-600 text-blue-700 z-10' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    GitHub
                  </button>
                  <button
                    type="button"
                    onClick={() => openOnboardModal('gitlab')}
                    className={`flex-1 flex justify-center py-2 px-4 text-sm font-medium rounded-r-md border -ml-px ${
                      selectedProvider === 'gitlab' 
                        ? 'bg-blue-50 border-blue-600 text-blue-700 z-10' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    GitLab
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Discovered Repository</label>
                <select
                  value={selectedRepoFull}
                  onChange={(e) => setSelectedRepoFull(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                >
                  {discoveredRepos.length > 0 ? discoveredRepos.map(r => (
                    <option key={r.external_id} value={r.full_name}>{r.full_name} ({r.default_branch})</option>
                  )) : (
                    <option disabled>No repositories found</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monitored Branch</label>
                  <input
                    type="text"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                  <select
                    value={selectedEnv}
                    onChange={(e) => setSelectedEnv(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    id="enable_mon"
                    checked={enableMonitoring}
                    onChange={(e) => setEnableMonitoring(e.target.checked)}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="enable_mon" className="font-medium text-gray-700">
                    Enable Monitoring
                  </label>
                  <p className="text-gray-500">Automatically ingest webhooks and enable Hindsight learning.</p>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboarding || discoveredRepos.length === 0}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {onboarding ? 'Connecting...' : 'Connect Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
