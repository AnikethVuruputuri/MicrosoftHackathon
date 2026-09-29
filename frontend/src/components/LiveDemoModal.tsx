import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Activity,
  Zap,
  Clock,
  Sparkles,
  X,
  ExternalLink,
  ChevronRight,
  Flame,
  Check
} from 'lucide-react';
import { simulateAutomation } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveDemoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'walkthrough' | 'benchmarks'>('walkthrough');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPlayingAuto, setIsPlayingAuto] = useState<boolean>(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState<string | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isPlayingAuto) {
      timer = setTimeout(() => {
        if (currentStep < 4) {
          setCurrentStep((prev) => prev + 1);
        } else {
          setIsPlayingAuto(false);
        }
      }, 3500);
    }
    return () => clearTimeout(timer);
  }, [isPlayingAuto, currentStep]);

  if (!isOpen) return null;

  const handleRunBenchmark = async (scenarioKey: string) => {
    try {
      setBenchmarkLoading(scenarioKey);
      setBenchmarkResult(null);
      const res = await simulateAutomation(scenarioKey, false, 'payment-api');
      setBenchmarkResult(res);
    } catch (err) {
      console.error('Failed to run benchmark:', err);
    } finally {
      setBenchmarkLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-6 py-5 flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">OpsMemory Hackathon Presentation Arena</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-400/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  Live Evaluation
                </span>
              </div>
              <p className="text-xs text-blue-200/80">
                Demonstrating AI DevOps Incident Intelligence, Human Correction Retention, and Safe Autonomous Recovery
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/80 px-6 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('walkthrough')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'walkthrough'
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              The "Aha! Moment" Story (2-Minute Demo)
            </button>
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'benchmarks'
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Autonomous Policy Benchmarks (A-D)
            </button>
          </div>

          {activeTab === 'walkthrough' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsPlayingAuto(!isPlayingAuto);
                  if (!isPlayingAuto && currentStep === 4) setCurrentStep(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
                  isPlayingAuto
                    ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                    : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                {isPlayingAuto ? 'Auto-Playing Demo...' : 'Auto-Play Walkthrough'}
              </button>
              <button
                onClick={() => {
                  setIsPlayingAuto(false);
                  setCurrentStep(1);
                }}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                title="Reset to Step 1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'walkthrough' ? (
            <div className="space-y-6">
              {/* Step Tracker Pills */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { step: 1, title: 'Day 0: Failure', sub: 'Naive AI Diagnosis' },
                  { step: 2, title: 'Human Correction', sub: 'Retained to Hindsight' },
                  { step: 3, title: 'Day 30: Recurrence', sub: 'Learned Instant Recall' },
                  { step: 4, title: 'Safe Recovery', sub: 'Policy Gate & Verified Fix' }
                ].map((item) => (
                  <button
                    key={item.step}
                    onClick={() => {
                      setIsPlayingAuto(false);
                      setCurrentStep(item.step);
                    }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      currentStep === item.step
                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-sm'
                        : currentStep > item.step
                        ? 'border-emerald-200 bg-emerald-50/40 text-gray-700'
                        : 'border-gray-200 bg-gray-50/50 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        Step {item.step}
                      </span>
                      {currentStep > item.step ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-gray-900 leading-tight">{item.title}</div>
                    <div className="text-[11px] text-gray-500">{item.sub}</div>
                  </button>
                ))}
              </div>

              {/* Step 1 View */}
              {currentStep === 1 && (
                <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-amber-600" />
                      <h3 className="text-sm font-bold text-gray-900">
                        Phase 1: Initial Outage without Organizational Memory
                      </h3>
                    </div>
                    <span className="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                      INC-101 (Payment API)
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    A severe surge occurs during checkout. Alerts report <code className="text-amber-800 font-mono bg-amber-100/60 px-1 py-0.5 rounded">RedisConnectionTimeout: timed out after 500ms</code>. Standard AI models without memory inspect the symptoms in isolation:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        Standard AI Initial Diagnosis
                      </span>
                      <p className="text-xs text-gray-800 font-medium">
                        "Redis container cache crash. Recommend restarting Redis instance."
                      </p>
                      <div className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded p-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span><strong>Problem:</strong> Restarting Redis does not fix the issue! The outage continues for 45 minutes because the root cause was in PostgreSQL.</span>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          The Gap in Existing DevOps AI
                        </span>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          DevOps bots don't learn from mistakes. If this fails again tomorrow, the same useless recommendation will be made.
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        Proceed to Step 2: SRE Teaches the System <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 View */}
              {currentStep === 2 && (
                <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-bold text-gray-900">
                        Phase 2: Engineer Teaches OpsMemory via Correction Console
                      </h3>
                    </div>
                    <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                      Human-in-the-Loop Feedback
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    SRE Alex Rivera diagnoses the true cause: Redis connection timeouts were just a downstream casualty. The real bottleneck was <strong>PostgreSQL connection pool exhaustion (20/20 active limit)</strong>.
                  </p>

                  <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                          AR
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-900">Alex Rivera (Staff SRE)</span>
                          <span className="text-[10px] text-gray-500 block">Submitted Human Correction</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                        <Check className="w-3 h-3" /> Stored in Hindsight Memory
                      </span>
                    </div>

                    <div className="text-xs bg-gray-50 p-3 rounded border border-gray-200 font-mono text-gray-800">
                      "Redis is only a downstream symptom. PostgreSQL connection pool exhaustion is the real root cause. Suggested action: Increase DB pool size from 20 to 100."
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-500">
                        Fingerprint: <code className="font-bold text-gray-700">PAYMENT_API_DB_POOL_PRODUCTION</code>
                      </span>
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                      >
                        Fast Forward 30 Days (Test Recurrence) <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 View */}
              {currentStep === 3 && (
                <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-sm font-bold text-gray-900">
                        Phase 3: Recurring Incident ➔ Instant Learning Recall
                      </h3>
                    </div>
                    <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                      INC-127 (Day 30)
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    Weeks later, an identical surge hits <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono">payment-api</code>. Instead of starting from zero, LangGraph matches the fingerprint and pulls previous human corrections from Hindsight:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-emerald-300 rounded-lg p-4 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-bl">
                        Memory Powered
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                        OpsMemory Instant Diagnosis (98% Confidence)
                      </span>
                      <p className="text-xs text-gray-900 font-semibold">
                        "Root cause: PostgreSQL connection pool exhaustion (Verified from prior SRE Alex Rivera correction on INC-101)."
                      </p>
                      <p className="text-xs text-gray-600">
                        Recommended Fix: <strong>Increase DB pool size and execute safe controlled restart.</strong>
                      </p>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                          Impact on Mean Time to Resolution (MTTR)
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-emerald-600">24 secs</span>
                          <span className="text-xs text-gray-400 line-through">45 mins</span>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            -99% MTTR
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Zero engineers woken up at 2 AM. Fix is ready to apply.
                        </p>
                      </div>

                      <button
                        onClick={() => setCurrentStep(4)}
                        className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        Proceed to Step 4: Policy & Safe Recovery <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4 View */}
              {currentStep === 4 && (
                <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-sm font-bold text-gray-900">
                        Phase 4: Deterministic Policy Gate & Autonomous Verification
                      </h3>
                    </div>
                    <span className="text-xs font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                      Self-Recovery Lifecycle
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    OpsMemory never blindly executes commands in production. The deterministic policy engine checks environment risk, confidence thresholds, and cooldowns:
                  </p>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold block">Risk Level</span>
                        <span className="text-xs font-bold text-amber-600">CONTROLLED</span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold block">Policy Gate</span>
                        <span className="text-xs font-bold text-blue-600">APPROVAL REQUIRED</span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold block">Health Check</span>
                        <span className="text-xs font-bold text-emerald-600">3x VERIFIED</span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Action approved & executed: Service restored in 18s. Compensation not needed.</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                        ACT-2026-0012
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => {
                          onClose();
                          navigate('/automation');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                      >
                        Inspect in Automation Console <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          navigate('/overview');
                        }}
                        className="py-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                      >
                        Back to Overview Dashboard
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Benchmarks Tab */
            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                Trigger real-time deterministic policy evaluations against OpsMemory's safety engine. Each test evaluates risk, checks cooldown rules, simulates recovery, and updates organizational memory:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    key: 'scenario_a',
                    title: 'Scenario A: Transient CI Pipeline Failure',
                    action: 'Retry Run',
                    risk: 'LOW RISK',
                    riskColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                    desc: 'Flaky Docker network timeout. Evaluates low-risk auto-retry with zero approval requirement.'
                  },
                  {
                    key: 'scenario_b',
                    title: 'Scenario B: Service Memory Leak / RSS Limit',
                    action: 'Controlled Restart',
                    risk: 'CONTROLLED',
                    riskColor: 'text-amber-700 bg-amber-50 border-amber-200',
                    desc: 'Pod reaches 96% memory limit. Enforces 15-minute cooldown timer and health check verification.'
                  },
                  {
                    key: 'scenario_c',
                    title: 'Scenario C: Bad Schema Migration in Production',
                    action: 'Rollback Deployment',
                    risk: 'HIGH RISK',
                    riskColor: 'text-rose-700 bg-rose-50 border-rose-200',
                    desc: 'Destructive schema issue. Enforces strict human approval gate before triggering rollback.'
                  },
                  {
                    key: 'scenario_d',
                    title: 'Scenario D: Ambiguous / Unknown Symptom',
                    action: 'Safe No-Action',
                    risk: 'SAFE STOP',
                    riskColor: 'text-gray-700 bg-gray-100 border-gray-300',
                    desc: 'Low confidence / unverified hypothesis. Halts automation and escalates safely to human SRE.'
                  }
                ].map((sc) => (
                  <div key={sc.key} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-300 transition-all shadow-sm">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sc.riskColor}`}>
                          {sc.risk}
                        </span>
                        <span className="text-xs font-mono font-semibold text-gray-700">{sc.action}</span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 mb-1">{sc.title}</h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{sc.desc}</p>
                    </div>

                    <button
                      disabled={benchmarkLoading !== null}
                      onClick={() => handleRunBenchmark(sc.key)}
                      className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {benchmarkLoading === sc.key ? (
                        <span>Simulating Policy...</span>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" /> Run Benchmark Test
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {benchmarkResult && (
                <div className="mt-4 p-4 rounded-xl bg-gray-900 text-white font-mono text-xs space-y-2 border border-gray-800">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-emerald-400 font-bold">✓ Policy Engine Execution Result</span>
                    <span className="text-gray-400 text-[10px]">{benchmarkResult.scenario}</span>
                  </div>
                  <pre className="text-[11px] text-blue-300 whitespace-pre-wrap overflow-x-auto max-h-40">
                    {JSON.stringify(benchmarkResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OpsMemory Autonomous Safety & Learning Subsystem Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
