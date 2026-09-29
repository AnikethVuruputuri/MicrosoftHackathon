import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Incident, 
  StageLog, 
  AgentDiagnosis, 
  HumanCorrection, 
  MemoryReference, 
  ResolutionEffectiveness,
  AutomationAction 
} from '../types';
import { 
  fetchIncidentDetail, 
  runInvestigation, 
  submitHumanCorrection, 
  applyResolution,
  fetchAutomationActions,
  approveAutomationAction,
  rejectAutomationAction,
  submitAutomationFeedback
} from '../services/api';
import { StageTracker } from '../components/StageTracker';
import { LearningTimeline } from '../components/LearningTimeline';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PageHeader } from '../components/ui/PageHeader';
import { 
  Brain, 
  Cpu, 
  UserCheck, 
  CheckCircle2, 
  Play, 
  Loader2, 
  ArrowLeft,
  Check,
  Terminal,
  Activity,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  RotateCcw
} from 'lucide-react';

export const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const incidentId = Number(id);

  const [data, setData] = useState<{
    incident: Incident;
    events: any[];
    diagnoses: AgentDiagnosis[];
    corrections: HumanCorrection[];
    memory_references: MemoryReference[];
    resolution_effectiveness: ResolutionEffectiveness[];
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [investigating, setInvestigating] = useState<boolean>(false);
  const [stageLogs, setStageLogs] = useState<StageLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [automationActions, setAutomationActions] = useState<AutomationAction[]>([]);
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  // Correction Form State
  const [showCorrectionForm, setShowCorrectionForm] = useState<boolean>(false);
  const [engineerName, setEngineerName] = useState<string>('SRE On-Call');
  const [correctionText, setCorrectionText] = useState<string>(
    'Redis is only a downstream symptom. The actual root cause is PostgreSQL connection pool exhaustion.'
  );
  const [actualRootCause, setActualRootCause] = useState<string>(
    'PostgreSQL connection pool exhaustion'
  );
  const [suggestedAction, setSuggestedAction] = useState<string>(
    'Increase DB pool size from 20 to 100'
  );

  const [retainedSuccessMsg, setRetainedSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (isNaN(incidentId)) return;
    try {
      setLoading(true);
      const res = await fetchIncidentDetail(incidentId);
      setData(res);
      const actions = await fetchAutomationActions({ incident_id: incidentId });
      setAutomationActions(actions);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load incident details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [incidentId]);

  const handleInvestigate = async () => {
    try {
      setInvestigating(true);
      setRetainedSuccessMsg(null);
      const result = await runInvestigation(incidentId);
      setStageLogs(result.stage_logs);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Investigation failed');
    } finally {
      setInvestigating(false);
    }
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInvestigating(true);
      const res = await submitHumanCorrection(incidentId, {
        engineer_name: engineerName,
        correction_text: correctionText,
        actual_root_cause: actualRootCause,
        suggested_action: suggestedAction
      });
      setStageLogs(res.stage_logs);
      setRetainedSuccessMsg(res.message);
      setShowCorrectionForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit correction');
    } finally {
      setInvestigating(false);
    }
  };

  const handleApplyResolution = async (action: string) => {
    try {
      setInvestigating(true);
      await applyResolution(incidentId, action);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to apply resolution');
    } finally {
      setInvestigating(false);
    }
  };

  const handleApproveAction = async (actionId: number) => {
    try {
      setActionProcessing(true);
      await approveAutomationAction(actionId, engineerName, 'Approved from Incident Console');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve automation action');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleRejectAction = async (actionId: number) => {
    try {
      setActionProcessing(true);
      await rejectAutomationAction(actionId, engineerName, 'Rejected from Incident Console');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reject automation action');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleFeedbackAction = async (actionId: number, feedback: 'appropriate' | 'inappropriate') => {
    try {
      await submitAutomationFeedback(actionId, feedback, 'Feedback from Incident Detail');
      setRetainedSuccessMsg(`Recorded '${feedback}' feedback in Hindsight memory.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    }
  };


  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="flex items-center space-x-2 font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading Incident Console...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const inc = data.incident;
  const latestDiagnosis = data.diagnoses.length > 0 ? data.diagnoses[0] : null;
  const latestCorrection = data.corrections.length > 0 ? data.corrections[0] : null;

  return (
    <div className="space-y-6">
      
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/incidents')}
            className="p-1.5 rounded-md bg-white text-gray-500 hover:text-gray-900 border border-gray-200 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-bold text-gray-900">{inc.incident_code}</span>
              <StatusBadge status={inc.severity} size="sm" />
              <StatusBadge status={inc.status} size="sm" />
            </div>
            <PageHeader title={inc.title} className="mt-1" />
          </div>
        </div>

        {/* Investigate Action Button */}
        <button
          onClick={handleInvestigate}
          disabled={investigating}
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-50 transition-all"
        >
          {investigating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing Agent...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Investigate</span>
            </>
          )}
        </button>
      </div>

      {/* Retained Alert Banner */}
      {retainedSuccessMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center space-x-2 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{retainedSuccessMsg} (Hindsight Organizational Memory Bank Updated)</span>
        </div>
      )}

      {/* LangGraph Stage Tracker */}
      <StageTracker stageLogs={stageLogs} isInvestigating={investigating} />

      {/* Incident Metadata & Failure Fingerprint */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <span className="text-[10px] font-mono text-gray-500 block uppercase">Target Service</span>
          <span className="text-sm font-semibold text-gray-900 font-mono mt-1 block">{inc.service_name}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <span className="text-[10px] font-mono text-gray-500 block uppercase">Environment</span>
          <span className="text-sm font-semibold text-gray-900 capitalize mt-1 block">{inc.environment}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm md:col-span-2">
          <span className="text-[10px] font-mono text-gray-500 block uppercase">Failure Fingerprint</span>
          <span className="text-sm font-bold text-gray-900 font-mono mt-1 block">
            {inc.failure_fingerprint || "PAYMENT_API_DB_POOL_PRODUCTION"}
          </span>
        </div>
      </div>

      {/* Main Investigation Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col (2/3): Current Evidence, AI Diagnosis & Human Review */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SECTION 1: CURRENT EVIDENCE */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Current Evidence (CI/CD Telemetry & Diffs)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-medium">
                LIVE TELEMETRY
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Symptoms Summary</span>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-md border border-gray-200">
                {inc.symptoms_summary}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Recent Commit Diff (config/database.yml)</span>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200 font-mono text-xs text-gray-800 overflow-x-auto">
                <div className="text-red-700 bg-red-50/50 px-1">- pool_size: 100</div>
                <div className="text-emerald-700 bg-emerald-50/50 px-1">+ pool_size: 20</div>
                <div className="text-red-700 bg-red-50/50 px-1">- timeout: 5000</div>
                <div className="text-emerald-700 bg-emerald-50/50 px-1">+ timeout: 500</div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Service & Pod Logs</span>
              <div className="bg-gray-50 rounded-md p-3 border border-gray-200 font-mono text-xs text-gray-600 overflow-x-auto space-y-1">
                <div>[payment-api.traffic] Incoming burst traffic: 1,420 req/sec across 24 checkout worker threads</div>
                <div>[payment-api.cache] RedisConnectionTimeout: Connection to redis.internal.net:6379 timed out after 500ms</div>
                <div>[payment-api.http] 504 Gateway Timeout on POST /v1/charges/authorize</div>
                <div className="text-amber-700">[payment-api.db] PoolAcquireTimeoutError: Queue pool limit of size 20 reached, max overflow reached</div>
                <div className="text-red-700 font-semibold">[payment-api.health] Readiness probe failed 3 consecutive times: HTTP 503</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: AI DIAGNOSIS & REASONING (Groq LLM) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Agent Investigation & Root Cause Synthesis
                </h3>
              </div>
              {latestDiagnosis && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Confidence: {Math.round(latestDiagnosis.confidence_score * 100)}%
                </span>
              )}
            </div>

            {latestDiagnosis ? (
              <div className="space-y-4 text-sm">
                
                <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1.5">AI Diagnosis</span>
                  <p className="text-gray-900 font-medium leading-relaxed">{latestDiagnosis.diagnosis_text}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1.5">Root Cause Hypothesis</span>
                    <p className="text-gray-900 font-medium">{latestDiagnosis.root_cause_hypothesis}</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-mono text-emerald-700 uppercase block mb-1.5 font-semibold">Recommended Action</span>
                    <p className="text-emerald-900 font-semibold">{latestDiagnosis.recommended_action}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-mono text-gray-500 uppercase block mb-1.5">Evidence Breakdown</span>
                  <p className="text-gray-700 leading-relaxed font-mono text-xs">{latestDiagnosis.evidence_summary}</p>
                </div>

                {/* Human in the loop Actions */}
                <div className="pt-4 mt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-[11px] font-mono text-gray-500 font-medium">HUMAN REVIEW & INTERVENTION</span>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleApplyResolution(latestDiagnosis.recommended_action)}
                      className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center space-x-2 transition-colors shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm & Apply Fix</span>
                    </button>

                    <button
                      onClick={() => setShowCorrectionForm(!showCorrectionForm)}
                      className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center space-x-2 transition-colors shadow-sm"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Correct AI Diagnosis</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <Cpu className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No investigation run yet. Click "Investigate" to execute agent.</p>
              </div>
            )}
          </div>

          {/* SAFE AUTOMATION & RECOVERY SECTION */}
          {automationActions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Safe Self-Recovery & Policy Engine
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/automation')}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Automation Console &rarr;
                </button>
              </div>

              {automationActions.map((act) => (
                <div key={act.id} className="p-3.5 bg-gray-50 border border-gray-200 rounded-md space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-800">{act.action_code}</span>
                      <span className="uppercase text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        {act.action_type}
                      </span>
                      <span className="text-xs text-gray-500">Tier: <strong>{act.risk_level.toUpperCase()}</strong></span>
                    </div>
                    <StatusBadge
                      status={
                        act.status === 'succeeded' ? 'success' :
                        act.status === 'awaiting_approval' ? 'warning' :
                        act.status === 'running' ? 'running' : 'failure'
                      }
                      label={act.status.replace('_', ' ')}
                    />
                  </div>

                  <p className="text-xs text-gray-700">
                    <strong>Reason:</strong> {act.reason}
                  </p>

                  <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                    <strong>Policy Verification:</strong> {act.policy_reason || act.policy_result}
                  </div>

                  {act.status === 'awaiting_approval' && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                      <button
                        disabled={actionProcessing}
                        onClick={() => handleRejectAction(act.id)}
                        className="px-3 py-1 text-xs font-medium text-rose-700 bg-white border border-rose-200 rounded hover:bg-rose-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={actionProcessing}
                        onClick={() => handleApproveAction(act.id)}
                        className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Approve & Execute
                      </button>
                    </div>
                  )}

                  {act.status === 'succeeded' && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Recovered in {act.recovery_time_seconds || 24}s (Health verified)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-[11px]">Was appropriate?</span>
                        {act.human_feedback ? (
                          <span className="font-semibold text-emerald-700 capitalize">{act.human_feedback}</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleFeedbackAction(act.id, 'appropriate')}
                              className="p-1 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFeedbackAction(act.id, 'inappropriate')}
                              className="p-1 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-600"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}


          {/* HUMAN CORRECTION FORM (Interactive Learning Trigger) */}
          {showCorrectionForm && (
            <div className="bg-white border-2 border-amber-200 rounded-lg p-5 shadow-md">
              <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-amber-100">
                <UserCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Engineer Correction Console (Teach OpsMemory)
                </h3>
              </div>

              <form onSubmit={handleSubmitCorrection} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Engineer Name / On-Call</label>
                  <input
                    type="text"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Engineer Correction Note</label>
                  <textarea
                    rows={2}
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual Root Cause</label>
                    <input
                      type="text"
                      value={actualRootCause}
                      onChange={(e) => setActualRootCause(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Suggested Remediation Action</label>
                    <input
                      type="text"
                      value={suggestedAction}
                      onChange={(e) => setSuggestedAction(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md p-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCorrectionForm(false)}
                    className="px-4 py-2 rounded-md bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={investigating}
                    className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    <Brain className="w-4 h-4" />
                    <span>Save Correction & Retain to Hindsight</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* HISTORICAL CORRECTIONS LIST */}
          {data.corrections.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-gray-100">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Recorded Engineer Corrections
                </h3>
              </div>

              <div className="space-y-4">
                {data.corrections.map((c, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{c.engineer_name}</span>
                      <span className="text-xs font-medium text-emerald-700 flex items-center space-x-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Retained in Hindsight</span>
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2 leading-relaxed">{c.correction_text}</p>
                    <div className="text-xs font-medium text-gray-500 bg-white p-2 rounded border border-gray-100">
                      Actual Root Cause: <span className="text-gray-900 font-semibold">{c.actual_root_cause}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Col (1/3): Recalled Memories & Learning Timeline */}
        <div className="space-y-6">
          
          {/* RECALLED HINDSIGHT MEMORIES (HISTORICAL MEMORY) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Historical Memory
                </h3>
              </div>
              <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-medium">
                HINDSIGHT
              </span>
            </div>

            {data.memory_references.length > 0 ? (
              <div className="space-y-4">
                {data.memory_references.map((m, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-semibold">
                        {m.memory_type}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        {Math.round(m.relevance_score * 100)}% Match
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed text-xs">
                      {m.content_snippet}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Run investigation to query Hindsight memory for matching fingerprints.
              </p>
            )}
          </div>

          {/* HISTORICAL RESOLUTION EFFECTIVENESS STATS */}
          {data.resolution_effectiveness && data.resolution_effectiveness.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Resolution Stats
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-gray-500">Historical</span>
              </div>

              <div className="space-y-3">
                {data.resolution_effectiveness.map((eff, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-gray-900 text-sm">{eff.remediation_action}</span>
                      <span className={`font-mono text-sm font-bold ${
                        eff.success_rate_percent >= 80 ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {eff.success_rate_percent}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{eff.success_count} success / {eff.failure_count} failed</span>
                      <span>Recovery: {eff.avg_recovery_time_minutes}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEARNING TIMELINE */}
          <LearningTimeline
            incidentCode={inc.incident_code}
            serviceName={inc.service_name}
            initialDiagnosis={inc.initial_diagnosis}
            engineerCorrection={inc.human_correction}
            rootCause={inc.confirmed_root_cause}
            remediation={inc.remediation_applied}
            retainedInHindsight={inc.retained_in_hindsight}
          />

        </div>

      </div>

    </div>
  );
};
