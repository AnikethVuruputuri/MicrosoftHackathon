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
  ShieldAlert,
  ShieldCheck,
  Info,
  Clock
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader title="Overview" description="Operational intelligence and recent system activity." />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          Failed to load overview data. {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const currentDep = data.current_deployment;
  const demo = data.demo_before_after;

  const getRiskBadge = (level: string) => {
    const l = (level || 'low').toLowerCase();
    if (l === 'critical' || l === 'high') {
      return { bg: 'bg-red-50 border-red-200 text-red-700', icon: ShieldAlert, label: 'HIGH RISK' };
    }
    if (l === 'medium') {
      return { bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: AlertTriangle, label: 'MEDIUM RISK' };
    }
    return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: ShieldCheck, label: 'LOW RISK' };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Overview" 
        description="Operational intelligence and recent system activity." 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Deployments"
          value={data.learning_metrics.total_deployments}
          icon={<Layers className="w-5 h-5 text-gray-400" />}
        />
        <MetricCard
          label="Recorded Incidents"
          value={data.learning_metrics.total_incidents}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        />
        <MetricCard
          label="Human Corrections"
          value={data.learning_metrics.human_corrections}
          icon={<UserCheck className="w-5 h-5 text-blue-500" />}
        />
        <MetricCard
          label="Hindsight Memories"
          value={data.learning_metrics.hindsight_memories_retained}
          icon={<Brain className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {currentDep && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <h3 className="text-sm font-semibold text-gray-900">Current Deployment Overview</h3>
                </div>
                <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                  Release #{currentDep.deployment_number}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div>
                  <span className="text-xs text-gray-500 font-medium block mb-1">Service</span>
                  <span className="text-sm font-semibold text-gray-900">{currentDep.service_name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block mb-1">Environment</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{currentDep.environment}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block mb-1">Commit</span>
                  <div className="flex items-center gap-1 text-sm font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 w-fit">
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>{currentDep.commit_sha}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium block mb-1">Status</span>
                  <StatusBadge status={currentDep.status} size="sm" />
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-500 font-medium block mb-2">Commit Message</span>
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 font-mono">
                  {currentDep.commit_message}
                </div>
              </div>

              {(() => {
                const badge = getRiskBadge(currentDep.risk_level);
                const RiskIcon = badge.icon;
                return (
                  <div className={`mt-6 flex items-start gap-4 p-4 rounded-xl border ${badge.bg}`}>
                    <div className="mt-0.5">
                      <RiskIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-80">Historical Risk Indicator</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 shadow-sm border border-black/5">
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium opacity-90">
                        {currentDep.risk_reason || "No historical failure pattern associations identified for this change signature."}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs opacity-70">
                        <Info className="w-3.5 h-3.5" />
                        <span>Derived from previous deployment outcomes in organizational memory</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {demo && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">OpsMemory Learning Progression</h3>
                </div>
                <span className="text-xs font-mono bg-white border border-gray-200 px-2 py-1 rounded text-gray-600">
                  FINGERPRINT: {demo.fingerprint}
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-6">
                  <span className="font-semibold text-gray-900">Scenario:</span> {demo.scenario}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                        <span className="text-xs font-bold text-gray-600">1</span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">Initial State (Before Learning)</h4>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
                      <p className="text-gray-500 text-xs mb-1.5 uppercase font-semibold tracking-wide">AI Suggestion</p>
                      <p className="text-gray-900">{demo.before_learning.ai_initial}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
                      <p className="text-blue-700 text-xs mb-1.5 uppercase font-semibold tracking-wide flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" /> Engineer Correction
                      </p>
                      <p className="text-blue-900">{demo.before_learning.engineer_correction}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center border border-blue-200">
                        <span className="text-xs font-bold text-blue-700">2</span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">Current State (After Learning)</h4>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-sm">
                      <p className="text-emerald-700 text-xs mb-1.5 uppercase font-semibold tracking-wide flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5" /> Hindsight Memory Recalled
                      </p>
                      <p className="text-emerald-900">{demo.after_learning.ai_recalled}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
                      <p className="text-gray-500 text-xs mb-1.5 uppercase font-semibold tracking-wide">New AI Recommendation</p>
                      <p className="text-gray-900">{demo.after_learning.ai_recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="space-y-6">
          
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900">Recent Incidents</h3>
              </div>
              <button 
                onClick={() => navigate('/incidents')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {data.recent_incidents.map((inc) => (
                <div 
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group block"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-mono text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                      {inc.incident_code}
                    </span>
                    <StatusBadge status={inc.status} size="sm" />
                  </div>
                  <p className="text-sm text-gray-900 font-medium mb-2 line-clamp-1">{inc.title}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-mono">{inc.service_name}</span>
                    {inc.retained_in_hindsight && (
                      <span className="text-emerald-700 flex items-center gap-1 font-medium bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                        <Brain className="w-3 h-3" />
                        Retained
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-gray-900">Resolution Effectiveness</h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500 uppercase">Org Data</span>
            </div>
            <div className="p-4 space-y-4">
              {data.historical_effectiveness.map((eff, idx) => (
                <div key={idx} className="text-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-gray-900">{eff.remediation_action}</span>
                    <span className={`font-mono text-xs font-bold ${
                      eff.success_rate_percent >= 80 ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {eff.success_rate_percent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        eff.success_rate_percent >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${eff.success_rate_percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>{eff.success_count} success / {eff.failure_count} failed</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {eff.avg_recovery_time_minutes}m avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
