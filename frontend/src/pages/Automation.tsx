import { useState, useEffect } from 'react';
import {
  PageHeader,
  MetricCard,
  DataTable,
  StatusBadge,
  TableSkeleton,
  EmptyState
} from '../components/ui';
import {
  fetchAutomationDashboard,
  approveAutomationAction,
  rejectAutomationAction,
  submitAutomationFeedback,
  simulateAutomation
} from '../services/api';
import {
  AutomationDashboardData,
  AutomationAction
} from '../types';
import { formatRelativeTime } from '../lib/utils';
import {
  ShieldAlert,
  Play,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Info,
  ExternalLink,
  Lock,
  Flame
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Automation() {
  const [data, setData] = useState<AutomationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [selectedAction, setSelectedAction] = useState<AutomationAction | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const res = await fetchAutomationDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load automation dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      setApprovingId(id);
      await approveAutomationAction(id, 'SRE On-Call', 'Verified by operator via Automation Console');
      await loadData();
    } catch (err) {
      console.error('Error approving action:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setApprovingId(id);
      await rejectAutomationAction(id, 'SRE On-Call', 'Rejected by operator');
      await loadData();
    } catch (err) {
      console.error('Error rejecting action:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleFeedback = async (id: number, feedback: 'appropriate' | 'inappropriate') => {
    try {
      await submitAutomationFeedback(id, feedback, `Marked as ${feedback} in Automation Console`);
      setFeedbackSuccess(`Recorded feedback as '${feedback}'. Retained to Hindsight memory.`);
      setTimeout(() => setFeedbackSuccess(null), 4000);
      await loadData();
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  const handleRunSimulation = async (scenarioKey: string) => {
    try {
      setSimulating(scenarioKey);
      setSimulationResult(null);
      const res = await simulateAutomation(scenarioKey, dryRun);
      setSimulationResult(res);
      await loadData();
    } catch (err) {
      console.error('Error running simulation:', err);
    } finally {
      setSimulating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Safe Automation & Recovery"
          description="Autonomous self-healing, blast-radius policy engine, and approval gates"
        />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  const metrics = data?.metrics || {
    total_actions: 0,
    successful_recoveries: 0,
    awaiting_approval: 0,
    prevented_or_blocked: 0,
    avg_recovery_seconds: 24
  };

  const pending = data?.pending_actions || [];
  const recent = data?.recent_actions || [];
  const policy = data?.policy;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safe Automation & Self-Recovery"
        description="Deterministic policy-guarded remediation, cooldown loop protections, and verifiable health recovery."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDryRun(!dryRun)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                dryRun
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              {dryRun ? 'Dry-Run Active (Simulated)' : 'Dry-Run Mode: OFF'}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              Configure Policy
            </button>
          </div>
        }
      />

      {/* Closed-Loop Safety Flow Architecture */}
      <div className="card-enterprise p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B667A]">
            Autonomous Safety & Execution Architecture
          </span>
          <span className="text-[11px] text-[#2563EB] font-semibold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Deterministic Policy Gate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-center">
            <div className="text-[10px] font-bold text-[#2563EB] uppercase mb-0.5">1. AI Proposes</div>
            <div className="text-xs font-bold text-[#111827]">Diagnoses Signature</div>
            <div className="text-[11px] text-[#5B667A] mt-0.5">Suggests recovery action</div>
          </div>
          <div className="bg-[#FFF8E6] border border-[#FDE68A] rounded-lg p-3 text-center">
            <div className="text-[10px] font-bold text-[#D99100] uppercase mb-0.5">2. Policy Validates</div>
            <div className="text-xs font-bold text-[#111827]">Blast Radius Check</div>
            <div className="text-[11px] text-[#5B667A] mt-0.5">Cooldown & env limits</div>
          </div>
          <div className="bg-[#F8FAFC] border border-[#E4E9F0] rounded-lg p-3 text-center">
            <div className="text-[10px] font-bold text-[#5B667A] uppercase mb-0.5">3. Execution</div>
            <div className="text-xs font-bold text-[#111827]">Deterministic Run</div>
            <div className="text-[11px] text-[#5B667A] mt-0.5">Safe auto-run or human gate</div>
          </div>
          <div className="bg-[#ECFDF3] border border-[#A6F4C5] rounded-lg p-3 text-center">
            <div className="text-[10px] font-bold text-[#16A36A] uppercase mb-0.5">4. Health Verified</div>
            <div className="text-xs font-bold text-[#111827]">Probe Confirmation</div>
            <div className="text-[11px] text-[#5B667A] mt-0.5">Ensures no cascading failure</div>
          </div>
          <div className="bg-[#F3F0FF] border border-[#DDD6FE] rounded-lg p-3 text-center">
            <div className="text-[10px] font-bold text-[#6D5CE7] uppercase mb-0.5">5. Memory Retained</div>
            <div className="text-xs font-bold text-[#111827]">Hindsight Learned</div>
            <div className="text-[11px] text-[#5B667A] mt-0.5">Persistent org memory bank</div>
          </div>
        </div>
      </div>

      {/* Global Safety State Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white border border-[#E4E9F0] rounded-xl text-xs text-[#5B667A] gap-2 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`h-2.5 w-2.5 rounded-full ${policy?.enabled ? 'bg-[#16A36A]' : 'bg-[#7A8699]'}`} />
          <span className="font-semibold text-[#111827]">Subsystem Policy Mode:</span>
          <span className="capitalize font-mono px-2 py-0.5 bg-[#F8FAFC] border border-[#E4E9F0] rounded text-[#111827] font-medium">
            {policy?.mode ? policy.mode.replace('_', ' ') : 'Approval Required'}
          </span>
          <span className="text-[#D5DDE8]">|</span>
          <span>Max Attempts/Incident: <strong className="text-[#111827]">{policy?.max_attempts_per_incident || 2}</strong></span>
          <span className="text-[#D5DDE8]">|</span>
          <span>Environments: <strong className="text-[#111827]">{policy?.allowed_environments || 'staging, production'}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-[#5B667A]">
          <Info className="h-3.5 w-3.5 text-[#2563EB] flex-shrink-0" />
          <span>LLM proposes actions; Deterministic Policy Engine strictly decides execution.</span>
        </div>
      </div>

      {feedbackSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-emerald-600" />
          {feedbackSuccess}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Total Automations"
          value={metrics.total_actions}
          icon={<RotateCcw className="h-5 w-5" />}
        />
        <MetricCard
          label="Recoveries Succeeded"
          value={metrics.successful_recoveries}
          icon={<RefreshCw className="h-5 w-5 text-emerald-600" />}
        />
        <MetricCard
          label="Awaiting Approval"
          value={metrics.awaiting_approval}
          icon={<ShieldAlert className={`h-5 w-5 ${metrics.awaiting_approval > 0 ? 'text-amber-600' : 'text-gray-400'}`} />}
          className={metrics.awaiting_approval > 0 ? 'border-amber-300 bg-amber-50/30' : ''}
        />
        <MetricCard
          label="Guardrail Prevented"
          value={metrics.prevented_or_blocked}
          icon={<Flame className="h-5 w-5 text-rose-500" />}
        />
        <MetricCard
          label="Avg Recovery Time"
          value={`${metrics.avg_recovery_seconds}s`}
          icon={<Clock className="h-5 w-5 text-blue-600" />}
        />
      </div>

      {/* Pending Approvals Section */}
      {pending.length > 0 && (
        <div className="bg-white border-2 border-amber-400 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Pending SRE Approvals ({pending.length})
              </h2>
            </div>
            <span className="text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full font-medium">
              Action Required
            </span>
          </div>
          <p className="text-xs text-gray-600">
            The policy engine has gated the following high-risk or production recovery actions. Review policy reasons and approve or reject.
          </p>

          <div className="divide-y divide-gray-100 border border-gray-200 rounded-md">
            {pending.map((item) => (
              <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded">
                      {item.action_code}
                    </span>
                    <span className="uppercase text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {item.action_type}
                    </span>
                    <span className="text-xs font-medium text-gray-600">
                      Target: <code className="bg-gray-200 px-1 rounded">{item.target}</code>
                    </span>
                    <span className="text-xs text-gray-500">
                      Env: <strong>{item.environment}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium">
                    Reason: {item.reason}
                  </p>
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                    Policy Gate: {item.policy_reason}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    disabled={approvingId === item.id}
                    onClick={() => handleReject(item.id)}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-white border border-rose-300 rounded hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    disabled={approvingId === item.id}
                    onClick={() => handleApprove(item.id)}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Approve & Execute
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Simulation Scenarios */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Interactive Benchmark Scenarios
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Simulate standard self-recovery situations to verify deterministic blast-radius checks and learning retention.
            </p>
          </div>
          <span className="text-xs font-mono text-gray-500">
            Mode: {dryRun ? 'DRY-RUN (Simulated)' : 'LIVE POLICY'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Scenario A */}
          <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-900">Scenario A</span>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  LOW RISK
                </span>
              </div>
              <h3 className="text-xs font-semibold text-gray-800">Transient CI Failure</h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Flaky Docker push timeout in CI. Agent suggests pipeline retry; Policy verifies retry quota and triggers re-run.
              </p>
            </div>
            <button
              disabled={simulating !== null}
              onClick={() => handleRunSimulation('scenario_a_retry')}
              className="w-full py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {simulating === 'scenario_a_retry' ? 'Simulating...' : 'Run Scenario A'}
            </button>
          </div>

          {/* Scenario B */}
          <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-900">Scenario B</span>
                <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  CONTROLLED
                </span>
              </div>
              <h3 className="text-xs font-semibold text-gray-800">Service Memory Leak</h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Worker pool exhausted. Agent proposes controlled rolling restart; Policy enforces cooldown timer and attempt limits.
              </p>
            </div>
            <button
              disabled={simulating !== null}
              onClick={() => handleRunSimulation('scenario_b_restart')}
              className="w-full py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {simulating === 'scenario_b_restart' ? 'Simulating...' : 'Run Scenario B'}
            </button>
          </div>

          {/* Scenario C */}
          <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-900">Scenario C</span>
                <span className="text-[10px] font-semibold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                  HIGH RISK
                </span>
              </div>
              <h3 className="text-xs font-semibold text-gray-800">Schema Lock Rollback</h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                504s after database migration. High risk rollback proposed; Policy strictly gates execution behind human approval.
              </p>
            </div>
            <button
              disabled={simulating !== null}
              onClick={() => handleRunSimulation('scenario_c_rollback')}
              className="w-full py-1.5 text-xs font-medium text-rose-700 bg-white border border-rose-200 rounded hover:bg-rose-50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {simulating === 'scenario_c_rollback' ? 'Simulating...' : 'Run Scenario C'}
            </button>
          </div>

          {/* Scenario D */}
          <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-900">Scenario D</span>
                <span className="text-[10px] font-semibold bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded">
                  NO ACTION
                </span>
              </div>
              <h3 className="text-xs font-semibold text-gray-800">Ambiguous Incident</h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Conflicting log traces & low confidence. Policy enforces explicit NO-ACTION rule to avoid worsening degradation.
              </p>
            </div>
            <button
              disabled={simulating !== null}
              onClick={() => handleRunSimulation('scenario_d_noaction')}
              className="w-full py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              {simulating === 'scenario_d_noaction' ? 'Simulating...' : 'Run Scenario D'}
            </button>
          </div>
        </div>

        {/* Simulation Output Banner */}
        {simulationResult && (
          <div className="mt-3 p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-900">
                {simulationResult.scenario}
              </span>
              <span className="font-mono text-[11px] text-blue-700">
                Action: {simulationResult.recommendation.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-700">
              {simulationResult.outcome_summary}
            </p>
            {simulationResult.action && (
              <div className="bg-white p-2.5 rounded border border-blue-100 font-mono text-[11px] text-gray-600 flex flex-wrap gap-4">
                <span>Code: <strong>{simulationResult.action.action_code}</strong></span>
                <span>Policy: <strong>{simulationResult.action.policy_result}</strong></span>
                <span>Status: <strong>{simulationResult.action.status}</strong></span>
                <span>Dry-Run: <strong>{simulationResult.action.is_dry_run ? 'YES' : 'NO'}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History DataTable */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Recovery Action Log & Feedback
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Audit history of every evaluated recovery action, health verification outcome, and human validation.
          </p>
        </div>

        <DataTable
          columns={[
            {
              key: 'action_code',
              label: 'Action Code',
              sortable: true,
              render: (a: AutomationAction) => (
                <span className="font-mono font-semibold text-xs text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedAction(a)}>
                  {a.action_code}
                </span>
              )
            },
            {
              key: 'action_type',
              label: 'Action Type',
              sortable: true,
              render: (a: AutomationAction) => {
                const colors: Record<string, string> = {
                  retry: 'bg-blue-100 text-blue-800',
                  restart: 'bg-purple-100 text-purple-800',
                  rollback: 'bg-rose-100 text-rose-800',
                  no_action: 'bg-gray-100 text-gray-700'
                };
                return (
                  <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${colors[a.action_type] || 'bg-gray-100 text-gray-700'}`}>
                    {a.action_type}
                  </span>
                );
              }
            },
            {
              key: 'target',
              label: 'Target',
              render: (a: AutomationAction) => (
                <div className="text-xs">
                  <div className="font-medium text-gray-900">{a.target || a.repository || 'Service'}</div>
                  <div className="text-[11px] text-gray-400 capitalize">{a.environment}</div>
                </div>
              )
            },
            {
              key: 'risk_level',
              label: 'Risk Tier',
              render: (a: AutomationAction) => {
                const map: Record<string, 'success' | 'warning' | 'failure' | 'info'> = {
                  low: 'success',
                  controlled: 'info',
                  high: 'warning',
                  very_high: 'failure'
                };
                return <StatusBadge status={map[a.risk_level] || 'info'} label={a.risk_level.toUpperCase()} />;
              }
            },
            {
              key: 'status',
              label: 'Execution Status',
              render: (a: AutomationAction) => {
                const map: Record<string, 'success' | 'failure' | 'warning' | 'running' | 'pending'> = {
                  succeeded: 'success',
                  failed: 'failure',
                  awaiting_approval: 'warning',
                  running: 'running',
                  blocked: 'failure',
                  no_action: 'pending',
                  rejected: 'pending'
                };
                return <StatusBadge status={map[a.status] || 'pending'} label={a.status.replace('_', ' ')} />;
              }
            },
            {
              key: 'verification_status',
              label: 'Health Verified',
              render: (a: AutomationAction) => (
                <span className={`text-xs font-medium ${a.verification_status === 'healthy' ? 'text-emerald-700' : a.verification_status === 'failed' ? 'text-rose-700' : 'text-gray-500'}`}>
                  {a.verification_status}
                </span>
              )
            },
            {
              key: 'recovery_time',
              label: 'Duration',
              render: (a: AutomationAction) => (
                <span className="text-xs text-gray-600 font-mono">
                  {a.recovery_time_seconds ? `${a.recovery_time_seconds}s` : '--'}
                </span>
              )
            },
            {
              key: 'feedback',
              label: 'Was Appropriate?',
              render: (a: AutomationAction) => (
                <div className="flex items-center gap-1.5">
                  {a.human_feedback ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${a.human_feedback === 'appropriate' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {a.human_feedback}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        title="Mark appropriate"
                        onClick={() => handleFeedback(a.id, 'appropriate')}
                        className="p-1 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600 transition-colors"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Mark inappropriate"
                        onClick={() => handleFeedback(a.id, 'inappropriate')}
                        className="p-1 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600 transition-colors"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            },
            {
              key: 'created_at',
              label: 'When',
              render: (a: AutomationAction) => (
                <span className="text-xs text-gray-500">
                  {formatRelativeTime(a.created_at)}
                </span>
              )
            }
          ]}
          data={recent}
          keyExtractor={(a) => a.id}
          emptyTitle="No automation actions yet"
          emptyDescription="Automated recovery actions will appear here when an incident is detected or benchmark simulation is run."
        />
      </div>

      {/* Action Detail Drawer / Modal */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600">{selectedAction.action_code}</span>
                <h3 className="text-base font-semibold text-gray-900 capitalize">
                  {selectedAction.action_type} on {selectedAction.target}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-md">
              <div><strong>Status:</strong> {selectedAction.status}</div>
              <div><strong>Policy Decision:</strong> {selectedAction.policy_result}</div>
              <div><strong>Risk Tier:</strong> {selectedAction.risk_level.toUpperCase()}</div>
              <div><strong>Environment:</strong> {selectedAction.environment}</div>
              <div><strong>Health Verified:</strong> {selectedAction.verification_status}</div>
              <div><strong>Dry-Run Mode:</strong> {selectedAction.is_dry_run ? 'YES' : 'NO'}</div>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-gray-800">Trigger Reason:</span>
              <p className="text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200">
                {selectedAction.reason}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-gray-800">Deterministic Policy Evaluation:</span>
              <p className="text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200">
                {selectedAction.policy_reason || 'Safety criteria verified.'}
              </p>
            </div>

            {selectedAction.execution_details && (
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-gray-800">Execution Details:</span>
                <pre className="p-2 bg-gray-900 text-gray-100 rounded text-[11px] overflow-x-auto">
                  {selectedAction.execution_details}
                </pre>
              </div>
            )}

            {selectedAction.verification_details && (
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-gray-800">Verification Metrics:</span>
                <pre className="p-2 bg-gray-900 text-gray-100 rounded text-[11px] overflow-x-auto">
                  {selectedAction.verification_details}
                </pre>
              </div>
            )}

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setSelectedAction(null)}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
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
