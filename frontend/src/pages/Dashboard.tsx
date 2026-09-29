import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../types';
import { fetchDashboard } from '../services/api';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import {
  Layers,
  AlertTriangle,
  Brain,
  UserCheck,
  ArrowUpRight,
  GitCommit,
  TrendingUp,
  ShieldCheck,
  Clock,
  Zap,
  Sparkles,
  DollarSign,
  CheckCircle2,
  Info,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { LiveDemoModal } from '../components/LiveDemoModal';
import { RiskIndicator } from '../components/RiskIndicator';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchDashboard();
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description="Operational intelligence, automated recovery health, and recent system activity."
        />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[#D92D3A] text-sm font-medium">
        Failed to load overview data. {error}
      </div>
    );
  }

  if (!data) return null;

  const currentDep = data.current_deployment;
  const demo = data.demo_before_after;

  return (
    <div className="space-y-6">
      {/* Page Title & Top Actions */}
      <PageHeader
        title="Overview"
        description="Continuous operational intelligence: AI proposes, deterministic policy engine gates, and verified human corrections are retained as organizational memory."
        actions={
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="btn-primary"
            title="Launch interactive walkthrough and benchmarks"
          >
            <Sparkles className="w-4 h-4 text-blue-100" />
            <span>Live Evaluation Arena</span>
          </button>
        }
      />

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Deployments"
          value={data.learning_metrics.total_deployments}
          icon={<Layers className="w-5 h-5 text-[#7A8699]" />}
          subtitle="Monitored across fleet"
        />
        <MetricCard
          label="Recorded Incidents"
          value={data.learning_metrics.total_incidents}
          icon={<AlertTriangle className="w-5 h-5 text-[#D99100]" />}
          subtitle="Auto-classified & fingerprinted"
        />
        <MetricCard
          label="Human Corrections"
          value={data.learning_metrics.human_corrections}
          icon={<UserCheck className="w-5 h-5 text-[#2563EB]" />}
          subtitle="Engineer resolutions ingested"
        />
        <MetricCard
          label="Hindsight Memories"
          value={data.learning_metrics.hindsight_memories_retained}
          icon={<Brain className="w-5 h-5 text-[#6D5CE7]" />}
          subtitle="Persistent org knowledge"
        />
      </div>

      {/* Premium Light Enterprise Intelligence Hero Panel */}
      <div className="bg-gradient-to-br from-[#EFF6FF] via-[#F8FAFC] to-[#F3F0FF] rounded-2xl p-6 border border-[#BFDBFE] shadow-[0_1px_3px_rgba(37,99,235,0.06)] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E4E9F0]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20 px-2.5 py-0.5 rounded-full">
                Operational Intelligence
              </span>
              <span className="text-xs font-medium text-[#5B667A]">
                Autonomous Recovery & Closed-Loop Learning
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
              Autonomous Recovery & Organizational Learning
            </h2>
            <p className="text-xs sm:text-sm text-[#5B667A] mt-1 max-w-3xl leading-relaxed">
              When an outage occurs, OpsMemory recalls verified engineer corrections from Hindsight memory, evaluates blast radius through a deterministic policy gate, and executes recovery in seconds.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/automation')}
              className="btn-secondary text-xs"
            >
              Policy Rules
            </button>
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="btn-primary text-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Interactive Benchmarks</span>
            </button>
          </div>
        </div>

        {/* 4 Unified Executive KPI Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div className="bg-white border border-[#E4E9F0] rounded-xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-[#5B667A] block mb-1">Mean Time to Resolution</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#16A36A] tabular-nums">24 secs</span>
              <span className="text-xs text-[#7A8699] line-through tabular-nums">42 mins</span>
            </div>
            <div className="mt-2 text-[11px] text-[#16A36A] flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>99% MTTR reduction on repeats</span>
            </div>
          </div>

          <div className="bg-white border border-[#E4E9F0] rounded-xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-[#5B667A] block mb-1">Safe Auto-Remediation</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#2563EB] tabular-nums">82%</span>
              <span className="text-xs text-[#5B667A]">of repeat incidents</span>
            </div>
            <div className="mt-2 text-[11px] text-[#2563EB] flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Deterministic policy-gated</span>
            </div>
          </div>

          <div className="bg-white border border-[#E4E9F0] rounded-xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-[#5B667A] block mb-1">SRE Firefighting Saved</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#D99100] tabular-nums">148 hrs</span>
              <span className="text-xs text-[#5B667A]">/ month</span>
            </div>
            <div className="mt-2 text-[11px] text-[#D99100] flex items-center gap-1 font-semibold">
              <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Zero 2 AM alerts on known repeats</span>
            </div>
          </div>

          <div className="bg-white border border-[#E4E9F0] rounded-xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-[#5B667A] block mb-1">Estimated Cost Saved</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#6D5CE7] tabular-nums">$124,000+</span>
            </div>
            <div className="mt-2 text-[11px] text-[#6D5CE7] flex items-center gap-1 font-semibold">
              <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Tier-1 downtime avoidance</span>
            </div>
          </div>
        </div>

        {/* Side-by-Side Comparison: Without Memory vs With OpsMemory */}
        <div className="mt-5 pt-4 border-t border-[#E4E9F0] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5 bg-white/90 border border-[#FECDD3] rounded-lg p-3">
            <span className="text-[#D92D3A] font-bold uppercase text-[10px] bg-[#FFF1F2] border border-[#FECDD3] px-2 py-0.5 rounded flex-shrink-0">
              Without Memory
            </span>
            <span className="text-[#5B667A] leading-relaxed">
              Every outage starts from zero. Engineers rediscover the same DB connection limits and flaky configurations repeatedly.
            </span>
          </div>
          <div className="flex items-start gap-2.5 bg-white/90 border border-[#A6F4C5] rounded-lg p-3">
            <span className="text-[#16A36A] font-bold uppercase text-[10px] bg-[#ECFDF3] border border-[#A6F4C5] px-2 py-0.5 rounded flex-shrink-0">
              With OpsMemory
            </span>
            <span className="text-[#111827] font-medium leading-relaxed">
              OpsMemory retains engineer corrections in Hindsight. Subsequent failure signatures trigger instant, policy-verified recovery.
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Current Deployment & Learning Progression vs Side Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Current Deployment Overview */}
          {currentDep && (
            <div className="card-enterprise p-5">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E9F0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB] animate-pulse" />
                  <h3 className="text-sm font-bold text-[#111827]">Current Deployment Overview</h3>
                </div>
                <span className="text-xs font-mono font-medium text-[#5B667A] bg-[#F8FAFC] px-2 py-1 rounded-md border border-[#E4E9F0]">
                  Release #{currentDep.deployment_number}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div>
                  <span className="text-[11px] text-[#7A8699] font-medium uppercase tracking-wider block mb-1">Service</span>
                  <span className="text-sm font-semibold text-[#111827]">{currentDep.service_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#7A8699] font-medium uppercase tracking-wider block mb-1">Environment</span>
                  <span className="text-sm font-medium text-[#111827] capitalize">{currentDep.environment}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#7A8699] font-medium uppercase tracking-wider block mb-1">Commit</span>
                  <div className="flex items-center gap-1 text-xs font-mono text-[#5B667A] bg-[#F8FAFC] px-2 py-1 rounded border border-[#E4E9F0] w-fit">
                    <GitCommit className="w-3.5 h-3.5 text-[#7A8699]" />
                    <span>{currentDep.commit_sha}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-[#7A8699] font-medium uppercase tracking-wider block mb-1">Status</span>
                  <StatusBadge status={currentDep.status} size="sm" />
                </div>
              </div>

              <div className="mb-5">
                <span className="text-[11px] text-[#7A8699] font-medium uppercase tracking-wider block mb-1.5">Commit Signature</span>
                <div className="text-xs text-[#111827] bg-[#F8FAFC] p-3 rounded-lg border border-[#E4E9F0] font-mono leading-relaxed">
                  {currentDep.commit_message}
                </div>
              </div>

              {/* Historical Risk Indicator */}
              <RiskIndicator
                riskLevel={currentDep.risk_level}
                riskReason={currentDep.risk_reason}
              />
            </div>
          )}

          {/* OpsMemory Learning Progression (Before vs After) */}
          {demo && (
            <div className="card-enterprise overflow-hidden">
              <div className="border-b border-[#E4E9F0] bg-[#F8FAFC] px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#6D5CE7]" />
                  <h3 className="text-sm font-bold text-[#111827]">OpsMemory Learning Progression</h3>
                </div>
                <span className="text-xs font-mono text-[#5B667A] bg-white border border-[#E4E9F0] px-2 py-0.5 rounded">
                  FINGERPRINT: {demo.fingerprint}
                </span>
              </div>

              <div className="p-5">
                <p className="text-xs sm:text-sm text-[#5B667A] mb-5">
                  <span className="font-semibold text-[#111827]">Observed Incident:</span> {demo.scenario}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Step 1: Initial State */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-[#F1F4F9] flex items-center justify-center border border-[#E4E9F0]">
                        <span className="text-[10px] font-bold text-[#5B667A]">1</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                        Initial State (Before Learning)
                      </h4>
                    </div>
                    <div className="bg-[#F8FAFC] border border-[#E4E9F0] rounded-lg p-3.5 text-xs">
                      <p className="text-[#7A8699] text-[10px] uppercase font-bold tracking-wide mb-1">
                        Naive AI Proposal
                      </p>
                      <p className="text-[#111827]">{demo.before_learning.ai_initial}</p>
                    </div>
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3.5 text-xs">
                      <p className="text-[#2563EB] text-[10px] uppercase font-bold tracking-wide flex items-center gap-1.5 mb-1">
                        <UserCheck className="w-3.5 h-3.5" /> Engineer Override (Ground Truth)
                      </p>
                      <p className="text-[#111827] font-medium">{demo.before_learning.engineer_correction}</p>
                    </div>
                  </div>

                  {/* Step 2: After Learning */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-[#F3F0FF] flex items-center justify-center border border-[#DDD6FE]">
                        <span className="text-[10px] font-bold text-[#6D5CE7]">2</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                        Current State (With Hindsight)
                      </h4>
                    </div>
                    <div className="bg-[#F3F0FF] border border-[#DDD6FE] rounded-lg p-3.5 text-xs">
                      <p className="text-[#6D5CE7] text-[10px] uppercase font-bold tracking-wide flex items-center gap-1.5 mb-1">
                        <Brain className="w-3.5 h-3.5" /> Recalled Engineering Memory
                      </p>
                      <p className="text-[#111827] font-medium">{demo.after_learning.ai_recalled}</p>
                    </div>
                    <div className="bg-[#ECFDF3] border border-[#A6F4C5] rounded-lg p-3.5 text-xs">
                      <p className="text-[#16A36A] text-[10px] uppercase font-bold tracking-wide flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified Recovery Action
                      </p>
                      <p className="text-[#111827] font-medium">{demo.after_learning.ai_recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Incidents & Resolution Effectiveness */}
        <div className="space-y-6">
          {/* Recent Incidents Card */}
          <div className="card-enterprise overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E4E9F0] bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D99100]" />
                <h3 className="text-sm font-bold text-[#111827]">Recent Incidents</h3>
              </div>
              <button
                onClick={() => navigate('/incidents')}
                className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1 transition-colors"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-[#E4E9F0]">
              {data.recent_incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="p-3.5 hover:bg-[#F8FAFC] cursor-pointer transition-colors group block"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-semibold text-[#2563EB] group-hover:underline">
                      {inc.incident_code}
                    </span>
                    <StatusBadge status={inc.status} size="sm" />
                  </div>
                  <p className="text-xs sm:text-sm text-[#111827] font-medium line-clamp-1 mb-2">
                    {inc.title}
                  </p>
                  <div className="flex items-center justify-between text-xs text-[#5B667A]">
                    <span className="font-mono text-[11px]">{inc.service_name}</span>
                    {inc.retained_in_hindsight && (
                      <span className="text-[#6D5CE7] flex items-center gap-1 text-[11px] font-semibold bg-[#F3F0FF] border border-[#DDD6FE] px-2 py-0.5 rounded-full">
                        <Brain className="w-3 h-3" />
                        Retained
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Resolution Effectiveness */}
          <div className="card-enterprise overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#E4E9F0] bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#16A36A]" />
                <h3 className="text-sm font-bold text-[#111827]">Resolution Effectiveness</h3>
              </div>
              <span className="text-[10px] font-mono text-[#7A8699] uppercase bg-white border border-[#E4E9F0] px-1.5 py-0.2 rounded">
                Org Ledger
              </span>
            </div>
            <div className="p-4 space-y-4">
              {data.historical_effectiveness.map((eff, idx) => (
                <div key={idx} className="text-xs sm:text-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-[#111827] truncate max-w-[180px]">
                      {eff.remediation_action}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        eff.success_rate_percent >= 80 ? 'text-[#16A36A]' : 'text-[#D99100]'
                      }`}
                    >
                      {eff.success_rate_percent}%
                    </span>
                  </div>
                  <div className="w-full bg-[#E4E9F0] h-1.5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        eff.success_rate_percent >= 80 ? 'bg-[#16A36A]' : 'bg-[#D99100]'
                      }`}
                      style={{ width: `${eff.success_rate_percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#7A8699]">
                    <span>
                      {eff.success_count} success / {eff.failure_count} failed
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-[#7A8699]" />
                      {eff.avg_recovery_time_minutes}m avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Demo Sandbox & Presentation Walkthrough */}
      <LiveDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  );
};
