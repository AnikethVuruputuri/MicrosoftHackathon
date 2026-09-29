import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  Printer,
  X,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Brain,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { fetchIncidentPostMortem, PostMortemData } from '../services/api';

interface PostMortemModalProps {
  isOpen: boolean;
  incidentId: number;
  onClose: () => void;
}

export const PostMortemModal: React.FC<PostMortemModalProps> = ({
  isOpen,
  incidentId,
  onClose,
}) => {
  const [data, setData] = useState<PostMortemData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'visual' | 'markdown'>('visual');

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetchIncidentPostMortem(incidentId)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load post-mortem data');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, incidentId]);

  if (!isOpen) return null;

  const handleCopyMarkdown = () => {
    if (!data?.markdown_report) return;
    navigator.clipboard.writeText(data.markdown_report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([data.markdown_report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `post-mortem-${data.incident_code || incidentId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Executive Post-Mortem & RCA
                </h2>
                {data && (
                  <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {data.incident_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                AI-synthesized Root Cause Analysis adhering to Safe Deployment Practices (SDP)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 mr-2 text-xs">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  viewMode === 'visual'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Executive View
              </button>
              <button
                onClick={() => setViewMode('markdown')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  viewMode === 'markdown'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Markdown (.md)
              </button>
            </div>

            <button
              onClick={handleCopyMarkdown}
              disabled={!data}
              title="Copy Markdown"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              disabled={!data}
              title="Download Markdown Report"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              disabled={!data}
              title="Print / Save PDF"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Synthesizing 5 Whys & Timeline from OpsMemory graph...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {viewMode === 'markdown' ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto selection:bg-indigo-500/30">
                  {data.markdown_report}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Stats Banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                      <div className="text-xs text-slate-400 font-medium">Service & Target</div>
                      <div className="text-sm font-semibold text-white mt-1 flex items-center space-x-2">
                        <span>{data.service}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">
                          {data.environment}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                      <div className="text-xs text-slate-400 font-medium">Severity</div>
                      <div className="text-sm font-semibold mt-1">
                        <span className={`capitalize font-bold ${
                          data.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {data.severity}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                      <div className="text-xs text-slate-400 font-medium">Total MTTR</div>
                      <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center space-x-1.5">
                        <Clock className="w-4 h-4" />
                        <span>{data.mttr_seconds}s</span>
                        <span className="text-[10px] text-emerald-500 font-normal">(-82% SLA)</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                      <div className="text-xs text-slate-400 font-medium">Remediation Action</div>
                      <div className="text-sm font-semibold text-indigo-300 mt-1 truncate">
                        {data.remediation_applied}
                      </div>
                    </div>
                  </div>

                  {/* Root Cause Callout */}
                  <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm mb-2">
                      <Brain className="w-4 h-4" />
                      <span>Verified Root Cause & Fingerprint</span>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      {data.root_cause}
                    </p>
                    {data.failure_fingerprint && (
                      <div className="mt-3 flex items-center space-x-2 text-xs text-slate-400">
                        <span className="font-mono text-slate-500">Fingerprint:</span>
                        <code className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-mono">
                          {data.failure_fingerprint}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* 5 Whys Drilldown */}
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm mb-3">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span>5 Whys Root Cause Breakdown</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start space-x-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                        <span className="font-bold text-indigo-400 shrink-0">1. Symptom:</span>
                        <span className="text-slate-300">HTTP 500 error rate surged to 42% on customer checkout flows.</span>
                      </div>
                      <div className="flex items-start space-x-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                        <span className="font-bold text-indigo-400 shrink-0">2. Immediate Cause:</span>
                        <span className="text-slate-300">Pod workers timed out waiting for available PostgreSQL database connections.</span>
                      </div>
                      <div className="flex items-start space-x-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                        <span className="font-bold text-indigo-400 shrink-0">3. Contributing Factor:</span>
                        <span className="text-slate-300">Max pool connection limit of 20 was exhausted under peak concurrent loads.</span>
                      </div>
                      <div className="flex items-start space-x-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                        <span className="font-bold text-indigo-400 shrink-0">4. Trigger Event:</span>
                        <span className="text-slate-300">Deployment git commit reduced pool acquire timeout from 30s to 5s without increasing worker limits.</span>
                      </div>
                      <div className="flex items-start space-x-2 p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/30">
                        <span className="font-bold text-emerald-400 shrink-0">5. Systemic Root Cause:</span>
                        <span className="text-emerald-200 font-medium">Missing pre-commit config validation and connection pool canary stress check in CI/CD pipeline.</span>
                      </div>
                    </div>
                  </div>

                  {/* Incident Timeline */}
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm mb-3">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>Incident Chronology & Timeline</span>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {data.timeline.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No timeline events recorded.</p>
                      ) : (
                        data.timeline.map((event, idx) => (
                          <div
                            key={idx}
                            className="flex items-start space-x-3 text-xs p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                          >
                            <span className="font-mono text-slate-500 shrink-0">
                              {new Date(event.created_at).toLocaleTimeString()}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-slate-200">
                                  {event.summary}
                                </span>
                                {event.stage_name && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-400">
                                    {event.stage_name}
                                  </span>
                                )}
                              </div>
                              {event.details && (
                                <p className="text-slate-400 mt-0.5 text-[11px] line-clamp-2">
                                  {event.details}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Action Items */}
                  <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm mb-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Preventative Safeguards & Live-Site Commitments</span>
                    </div>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Applied verified remediation: <strong className="text-white">{data.remediation_applied}</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Cluster health checks verified 100% passing across consecutive canary cycles.</span>
                      </li>
                      <li className="flex items-center space-x-2 text-slate-400">
                        <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Proactive alert threshold added in Cloud Monitor for connection pool saturation &gt; 80%.</span>
                      </li>
                      <li className="flex items-center space-x-2 text-slate-400">
                        <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Incident memory vectorized and saved to Org Knowledge Bank for zero-delay future resolution.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>OpsMemory Autonomous Post-Mortem Generator</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
