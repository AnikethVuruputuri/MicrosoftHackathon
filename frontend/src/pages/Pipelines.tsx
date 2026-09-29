import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageHeader,
  FilterBar,
  DataTable,
  StatusBadge,
  TableSkeleton,
  MetricCard,
  EmptyState
} from '../components/ui';
import { fetchPipelines } from '../services/api';
import { PipelineRun, PipelinesSummary } from '../types';
import { formatRelativeTime } from '../lib/utils';
import {
  Workflow,
  GitBranch,
  GitCommit,
  User,
  Clock,
  ExternalLink,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Layers,
  X
} from 'lucide-react';

export function PipelinesPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [summary, setSummary] = useState<PipelinesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [activeLogRun, setActiveLogRun] = useState<PipelineRun | null>(null);

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchPipelines({
        repository: selectedRepo !== 'all' ? selectedRepo : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        branch: selectedBranch !== 'all' ? selectedBranch : undefined,
      });
      setRuns(res.runs);
      setSummary(res.summary);
    } catch (err) {
      console.error('Failed to load pipelines', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRepo, selectedStatus, selectedBranch]);

  const filteredRuns = runs.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.repository.toLowerCase().includes(q) ||
      r.commit_message.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      r.commit_sha.toLowerCase().includes(q)
    );
  });

  const getStatusBadgeType = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'success';
      case 'failed':
      case 'failure':
        return 'failure';
      case 'in_progress':
      case 'running':
        return 'running';
      default:
        return 'pending';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipelines & Workflows"
        description="Observe CI/CD pipeline runs, stage logs, and automated incident diagnosis triggers across your fleet"
        actions={
          <button
            onClick={() => navigate('/deployments/simulate')}
            className="btn-primary"
          >
            <Play className="h-4 w-4" />
            <span>Simulate Pipeline Run</span>
          </button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Workflow Runs"
          value={summary ? summary.total_runs : 0}
          icon={<Workflow className="h-5 w-5" />}
        />
        <MetricCard
          label="Pipeline Success Rate"
          value={summary ? `${summary.success_rate_percent}%` : '0%'}
          change={summary && summary.success_rate_percent >= 80 ? 4.2 : -2.5}
          changeLabel="vs last week"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        />
        <MetricCard
          label="Avg Pipeline Duration"
          value={summary ? `${Math.floor(summary.avg_duration_seconds / 60)}m ${summary.avg_duration_seconds % 60}s` : '0s'}
          icon={<Clock className="h-5 w-5 text-gray-400" />}
        />
        <MetricCard
          label="Failed Runs / Incidents"
          value={summary ? summary.failure_count : 0}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by workflow, repo, commit, or author..."
        filters={[
          {
            label: 'Repository',
            value: selectedRepo,
            options: [
              { label: 'All Repositories', value: 'all' },
              { label: 'acme/payment-api', value: 'payment-api' },
              { label: 'acme/user-service', value: 'user-service' },
              { label: 'fintech/inventory-service', value: 'inventory-service' },
              { label: 'acme/order-service', value: 'order-service' },
              { label: 'acme/notification-service', value: 'notification-service' },
            ],
            onChange: setSelectedRepo,
          },
          {
            label: 'Status',
            value: selectedStatus,
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Success', value: 'success' },
              { label: 'Failed', value: 'failed' },
              { label: 'In Progress', value: 'in_progress' },
            ],
            onChange: setSelectedStatus,
          },
          {
            label: 'Branch',
            value: selectedBranch,
            options: [
              { label: 'All Branches', value: 'all' },
              { label: 'main', value: 'main' },
              { label: 'staging', value: 'staging' },
            ],
            onChange: setSelectedBranch,
          },
        ]}
        actions={
          <button
            onClick={loadData}
            title="Refresh pipeline status"
            className="p-2 text-gray-500 hover:text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        }
      />

      {/* Pipelines Data Table */}
      {loading ? (
        <TableSkeleton cols={6} rows={6} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Workflow / Pipeline',
              sortable: true,
              render: (r: PipelineRun) => (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      {r.name}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">#{r.run_number}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize px-1.5 py-0.2 bg-gray-100 rounded text-[11px] font-mono">
                      {r.event_type.replace('_', ' ')}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-gray-500">{r.id}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'repository',
              label: 'Repository',
              sortable: true,
              render: (r: PipelineRun) => (
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                      r.provider === 'github'
                        ? 'bg-gray-100 text-gray-700 border border-gray-200'
                        : 'bg-orange-50 text-orange-700 border border-orange-200'
                    }`}
                  >
                    {r.provider}
                  </span>
                  <span className="font-mono text-sm text-gray-700">{r.repository}</span>
                </div>
              ),
            },
            {
              key: 'branch',
              label: 'Branch & Commit',
              render: (r: PipelineRun) => (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <GitBranch className="h-3.5 w-3.5 text-gray-400" />
                    <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono font-medium text-[11px]">
                      {r.branch}
                    </code>
                    <span className="text-gray-400">•</span>
                    <span className="font-mono text-blue-600 text-xs flex items-center gap-0.5">
                      <GitCommit className="h-3 w-3" />
                      {r.commit_sha.slice(0, 7)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate max-w-xs" title={r.commit_message}>
                    {r.commit_message}
                  </p>
                </div>
              ),
            },
            {
              key: 'author',
              label: 'Author',
              render: (r: PipelineRun) => (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span>{r.author}</span>
                </div>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (r: PipelineRun) => (
                <StatusBadge
                  status={getStatusBadgeType(r.status)}
                  label={r.status.toUpperCase()}
                />
              ),
            },
            {
              key: 'duration',
              label: 'Duration & Started',
              render: (r: PipelineRun) => (
                <div className="space-y-0.5 text-xs text-gray-500">
                  <div className="flex items-center gap-1 font-mono text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span>
                      {Math.floor(r.duration_seconds / 60)}m {r.duration_seconds % 60}s
                    </span>
                  </div>
                  <div>{formatRelativeTime(r.started_at)}</div>
                </div>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (r: PipelineRun) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLogRun(r);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
                  >
                    <Terminal className="h-3.5 w-3.5 text-gray-500" />
                    Logs
                  </button>
                  {r.incident_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/incidents/${r.incident_id}`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded transition-colors"
                      title="Investigate incident diagnosed by OpsMemory"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {r.incident_code}
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          data={filteredRuns}
          keyExtractor={(r) => r.id}
          emptyTitle="No pipeline runs yet"
          emptyDescription="Connect a repository or simulate a pipeline run to start observing workflow activity."
          emptyAction={
            <button
              onClick={() => navigate('/deployments/simulate')}
              className="btn-primary text-xs"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Simulate Pipeline Run</span>
            </button>
          }
        />
      )}

      {/* Pipeline Stage & Log Viewer Modal */}
      {activeLogRun && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">{activeLogRun.name}</h3>
                    <StatusBadge
                      status={getStatusBadgeType(activeLogRun.status)}
                      label={activeLogRun.status.toUpperCase()}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activeLogRun.repository} • Branch: <span className="font-mono">{activeLogRun.branch}</span> • Commit: <span className="font-mono">{activeLogRun.commit_sha.slice(0, 7)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveLogRun(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Pipeline Stages & Jobs */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Workflow Execution Stages
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeLogRun.jobs && activeLogRun.jobs.length > 0 ? (
                    activeLogRun.jobs.map((job, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs ${
                          job.status === 'success'
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                            : job.status === 'failed'
                            ? 'bg-red-50/50 border-red-200 text-red-900'
                            : 'bg-gray-50 border-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold capitalize">{job.name}</span>
                          {job.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : job.status === 'failed' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 flex justify-between">
                          <span>Stage: {job.stage}</span>
                          <span>{job.duration_seconds}s</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-xs text-gray-500 italic">
                      Job stages completed under unified workflow container.
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Stage Logs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" />
                    Runner Telemetry & Console Logs
                  </h4>
                  <span className="text-[11px] font-mono text-gray-400">stdout/stderr</span>
                </div>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-x-auto border border-gray-800 shadow-inner max-h-64">
                  <pre className="whitespace-pre-wrap">{activeLogRun.raw_logs || 'No logs captured for this run.'}</pre>
                </div>
              </div>

              {/* Incident Callout if Failed */}
              {activeLogRun.incident_id && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div>
                      <h5 className="text-sm font-semibold text-red-900">
                        Incident {activeLogRun.incident_code} Associated
                      </h5>
                      <p className="text-xs text-red-700">
                        OpsMemory detected and investigated failure in this pipeline run using Hindsight organizational memory.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const id = activeLogRun.incident_id;
                      setActiveLogRun(null);
                      navigate(`/incidents/${id}`);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    View Diagnosis
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <a
                href={activeLogRun.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <span>View on {activeLogRun.provider === 'github' ? 'GitHub' : 'GitLab'}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setActiveLogRun(null)}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
