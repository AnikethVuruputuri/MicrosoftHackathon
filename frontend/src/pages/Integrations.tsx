import React, { useState, useEffect } from 'react';
import { IntegrationInfo, RepositoryInfo } from '../types';
import {
  fetchIntegrations,
  fetchRepositories,
  discoverRepositories,
  onboardRepository,
  disconnectIntegration,
  syncIntegration,
  connectIntegration
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
  Key,
  ExternalLink,
  X,
  AlertCircle,
  Radio,
  Lock,
  Layers,
  Inbox
} from 'lucide-react';

export const Integrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // In-app Connection Modal state
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [connectProvider, setConnectProvider] = useState<'github' | 'gitlab'>('github');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [gitlabUrlInput, setGitlabUrlInput] = useState<string>('https://gitlab.com');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Onboard Repository Modal state
  const [showOnboardModal, setShowOnboardModal] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab'>('github');
  const [discoveredRepos, setDiscoveredRepos] = useState<any[]>([]);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [selectedRepoFull, setSelectedRepoFull] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [selectedEnv, setSelectedEnv] = useState<string>('production');
  const [enableMonitoring, setEnableMonitoring] = useState<boolean>(true);
  const [onboarding, setOnboarding] = useState<boolean>(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

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

  const openConnectModal = (provider: 'github' | 'gitlab') => {
    setConnectProvider(provider);
    setTokenInput('');
    setConnectError(null);
    setShowConnectModal(true);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    try {
      setConnecting(true);
      setConnectError(null);
      const res = await connectIntegration({
        provider: connectProvider,
        token: tokenInput.trim(),
        gitlab_url: connectProvider === 'gitlab' ? gitlabUrlInput : undefined
      });
      setMessage({ type: 'success', text: res.message });
      setShowConnectModal(false);
      setTokenInput('');
      await loadAll();
    } catch (err: any) {
      setConnectError(err.message || `Failed to connect ${connectProvider}`);
    } finally {
      setConnecting(false);
    }
  };

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

  const openOnboardModal = async (provider: 'github' | 'gitlab') => {
    setSelectedProvider(provider);
    setShowOnboardModal(true);
    setDiscovering(true);
    setDiscoverError(null);
    setDiscoveredRepos([]);

    try {
      const disc = await discoverRepositories(provider);
      if (disc.connected === false) {
        setDiscoverError(disc.message || `${provider} is not connected. Please connect first.`);
      } else {
        setDiscoveredRepos(disc.repositories || []);
        if (disc.repositories && disc.repositories.length > 0) {
          setSelectedRepoFull(disc.repositories[0].full_name);
          setSelectedBranch(disc.repositories[0].default_branch || 'main');
        }
      }
    } catch (e: any) {
      setDiscoverError(e.message || 'Failed to fetch repositories.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoFull) return;

    try {
      setOnboarding(true);
      const repoObj = discoveredRepos.find((r) => r.full_name === selectedRepoFull) || {
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
    return integrations.find((i) => i.provider === p);
  };

  const githubIntg = getIntegrationByProvider('github');
  const gitlabIntg = getIntegrationByProvider('gitlab');

  const isGhConnected = githubIntg?.status === 'connected';
  const isGlConnected = gitlabIntg?.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">DevOps Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect source control providers directly from the application to ingest webhooks, observe workflow runs, and retain organizational memory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isGhConnected || isGlConnected) && (
            <button
              onClick={() => openOnboardModal(isGhConnected ? 'github' : 'gitlab')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Add Repository
            </button>
          )}
        </div>
      </div>

      {/* Alert / Flash Message */}
      {message && (
        <div
          className={`p-3.5 rounded-lg flex items-center justify-between border text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2-Column Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GITHUB CARD */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 flex items-center justify-center text-gray-900 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">GitHub Actions CI/CD</h2>
                <span className="text-xs text-gray-500">Source Control & Workflow Provider</span>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                isGhConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isGhConnected ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
              {isGhConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Connected Account
              </span>
              <span className="font-semibold text-gray-900 font-mono">
                {isGhConnected && githubIntg?.account_name ? `@${githubIntg.account_name}` : 'Not connected'}
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Webhook Verification
              </span>
              <span className="font-semibold text-gray-900 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>HMAC-SHA256</span>
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Monitored Repos
              </span>
              <span className="font-semibold text-blue-600 font-mono">
                {repositories.filter((r) => r.provider === 'github').length} Repositories
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Memory Learning
              </span>
              <span className="font-semibold text-purple-600 flex items-center gap-1 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hindsight Active</span>
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            {isGhConnected ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync('github')}
                    disabled={syncingProvider === 'github'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        syncingProvider === 'github' ? 'animate-spin text-blue-600' : 'text-gray-500'
                      }`}
                    />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={() => openOnboardModal('github')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Repo</span>
                  </button>
                </div>
                <button
                  onClick={() => handleDisconnect('github')}
                  className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <span className="text-xs text-gray-500">Connect using Personal Access Token</span>
                <button
                  onClick={() => openConnectModal('github')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Connect GitHub</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* GITLAB CARD */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 flex items-center justify-center text-orange-600 bg-orange-50 rounded-lg border border-orange-200">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.6 9.57l-.03-.08-3.41-8.73a.81.81 0 00-.31-.38.83.83 0 00-.91 0 .82.82 0 00-.32.38L16.2 7.5H7.8L5.38.76a.82.82 0 00-.32-.38.83.83 0 00-.91 0 .81.81 0 00-.31.38L.43 9.49l-.03.08a5.75 5.75 0 001.99 6.64l.05.04.09.06 7.42 5.56 2.05 1.54 2.05-1.54 7.42-5.56.09-.06.05-.04a5.75 5.75 0 001.99-6.64z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">GitLab CI/CD Pipelines</h2>
                <span className="text-xs text-gray-500">Source Control & GitLab Runner Provider</span>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                isGlConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isGlConnected ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
              {isGlConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Connected Account
              </span>
              <span className="font-semibold text-gray-900 font-mono">
                {isGlConnected && gitlabIntg?.account_name ? `@${gitlabIntg.account_name}` : 'Not connected'}
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Webhook Token
              </span>
              <span className="font-semibold text-gray-900 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Secret Token Verified</span>
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Monitored Projects
              </span>
              <span className="font-semibold text-blue-600 font-mono">
                {repositories.filter((r) => r.provider === 'gitlab').length} Projects
              </span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
              <span className="text-[11px] text-gray-400 uppercase font-medium block">
                Memory Learning
              </span>
              <span className="font-semibold text-purple-600 flex items-center gap-1 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hindsight Active</span>
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            {isGlConnected ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync('gitlab')}
                    disabled={syncingProvider === 'gitlab'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        syncingProvider === 'gitlab' ? 'animate-spin text-blue-600' : 'text-gray-500'
                      }`}
                    />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={() => openOnboardModal('gitlab')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Project</span>
                  </button>
                </div>
                <button
                  onClick={() => handleDisconnect('gitlab')}
                  className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <span className="text-xs text-gray-500">Connect using GitLab Access Token</span>
                <button
                  onClick={() => openConnectModal('gitlab')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Connect GitLab</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monitored Repositories & Pipeline Observer Section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Monitored Repositories & Pipeline Observers
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Source code repositories with real-time webhook ingestion and Hindsight learning enabled.
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded">
            {repositories.length} Active Services
          </span>
        </div>

        {repositories.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-900 mb-1">No repositories monitored yet</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
              Connect your GitHub or GitLab account above using an in-app Personal Access Token, then click 'Add Repository' to select repositories to monitor.
            </p>
            <button
              onClick={() => openConnectModal('github')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <Key className="h-3.5 w-3.5" />
              Connect Provider Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-medium text-[11px]">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Repository / Project</th>
                  <th className="px-4 py-3">Monitored Branch</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Pipeline Ingestion</th>
                  <th className="px-4 py-3">Memory State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {repositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold uppercase text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] ${
                          repo.provider === 'github'
                            ? 'bg-gray-100 text-gray-700 border-gray-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}
                      >
                        {repo.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 font-mono">
                      {repo.full_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      <span className="inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                        <GitBranch className="w-3 h-3 text-gray-400" />
                        {repo.monitored_branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-600 capitalize">
                      {repo.environment}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        ACTIVE
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded font-mono bg-purple-50 text-purple-700 border border-purple-200">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        LEARNING
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IN-APP CONNECT MODAL (No .env needed) */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Connect {connectProvider === 'github' ? 'GitHub' : 'GitLab'} Account
                  </h3>
                  <p className="text-xs text-gray-500">In-app connection without editing .env</p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="p-6 space-y-4">
              {connectError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{connectError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {connectProvider === 'github'
                    ? 'GitHub Personal Access Token (classic or fine-grained)'
                    : 'GitLab Personal Access Token'}
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    connectProvider === 'github'
                      ? 'ghp_xxxxxxxxxxxxxxxxxxxx'
                      : 'glpat-xxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  {connectProvider === 'github' ? (
                    <>
                      Requires <code className="bg-gray-100 px-1 py-0.5 rounded">repo</code> and{' '}
                      <code className="bg-gray-100 px-1 py-0.5 rounded">workflow</code> scopes.{' '}
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,workflow,read:user"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline font-medium"
                      >
                        Generate token on GitHub →
                      </a>
                    </>
                  ) : (
                    <>
                      Requires <code className="bg-gray-100 px-1 py-0.5 rounded">api</code> and{' '}
                      <code className="bg-gray-100 px-1 py-0.5 rounded">read_repository</code> scopes.{' '}
                      <a
                        href="https://gitlab.com/-/user_settings/personal_access_tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline font-medium"
                      >
                        Generate token on GitLab →
                      </a>
                    </>
                  )}
                </p>
              </div>

              {connectProvider === 'gitlab' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GitLab Instance URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={gitlabUrlInput}
                    onChange={(e) => setGitlabUrlInput(e.target.value)}
                    placeholder="https://gitlab.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setTokenInput('demo')}
                  className="text-xs text-gray-500 hover:text-blue-600 underline"
                  title="Connect with offline mock credentials"
                >
                  Quick Demo Token
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={connecting || !tokenInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors shadow-xs"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Validating Token...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Connect Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONBOARD REPOSITORY MODAL */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Onboard Repository to OpsMemory
                </h3>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {discoverError ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>{discoverError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowOnboardModal(false);
                    openConnectModal(selectedProvider);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs shadow-xs"
                >
                  Connect {selectedProvider.toUpperCase()} Account
                </button>
              </div>
            ) : discovering ? (
              <div className="py-10 text-center space-y-2">
                <RefreshCw className="h-6 w-6 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs text-gray-500">Discovering repositories from your account...</p>
              </div>
            ) : (
              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Provider:
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openOnboardModal('github')}
                      className={`flex-1 py-1.5 rounded font-mono font-medium border text-xs ${
                        selectedProvider === 'github'
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      GitHub
                    </button>
                    <button
                      type="button"
                      onClick={() => openOnboardModal('gitlab')}
                      className={`flex-1 py-1.5 rounded font-mono font-medium border text-xs ${
                        selectedProvider === 'gitlab'
                          ? 'bg-blue-50 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      GitLab
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Select Discovered Repository:
                  </label>
                  {discoveredRepos.length === 0 ? (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                      No repositories found. Ensure your token has access to your repositories.
                    </div>
                  ) : (
                    <select
                      value={selectedRepoFull}
                      onChange={(e) => {
                        setSelectedRepoFull(e.target.value);
                        const repo = discoveredRepos.find((r) => r.full_name === e.target.value);
                        if (repo?.default_branch) setSelectedBranch(repo.default_branch);
                      }}
                      className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    >
                      {discoveredRepos.map((r) => (
                        <option key={r.external_id || r.full_name} value={r.full_name}>
                          {r.full_name} ({r.default_branch || 'main'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Monitored Branch:
                    </label>
                    <input
                      type="text"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Target Environment:
                    </label>
                    <select
                      value={selectedEnv}
                      onChange={(e) => setSelectedEnv(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    >
                      <option value="production">production</option>
                      <option value="staging">staging</option>
                      <option value="development">development</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="enable_mon"
                    checked={enableMonitoring}
                    onChange={(e) => setEnableMonitoring(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enable_mon" className="text-[11px] text-gray-700 font-medium">
                    Enable continuous webhook event ingestion & Hindsight memory retention
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-3 py-1.5 rounded bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboarding || discoveredRepos.length === 0}
                    className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 text-xs shadow-xs"
                  >
                    {onboarding ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Onboard Repository</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
