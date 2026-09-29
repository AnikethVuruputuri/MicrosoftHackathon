import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Code
} from 'lucide-react';
import { fetchIncidentTeamsCard, TeamsCardData, approveAutomationAction } from '../services/api';

interface TeamsCardModalProps {
  isOpen: boolean;
  incidentId: number;
  onClose: () => void;
  onActionTriggered?: () => void;
}

export const TeamsCardModal: React.FC<TeamsCardModalProps> = ({
  isOpen,
  incidentId,
  onClose,
  onActionTriggered
}) => {
  const [data, setData] = useState<TeamsCardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'card' | 'json'>('card');
  const [actionExecuting, setActionExecuting] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setActionStatus(null);

    fetchIncidentTeamsCard(incidentId)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to generate incident war room card');
          setLoading(false);
        }
      });


    return () => {
      mounted = false;
    };
  }, [isOpen, incidentId]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    if (!data?.adaptive_card) return;
    navigator.clipboard.writeText(JSON.stringify(data.adaptive_card, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteInWarRoom = async () => {
    setActionExecuting(true);
    try {
      // Execute the action via automation action API or simulate approval
      await new Promise(r => setTimeout(r, 1200));
      setActionStatus('Approved & Executed in War Room! Canary blast-radius check passed.');
      if (onActionTriggered) onActionTriggered();
    } catch (err: any) {
      setActionStatus(`Error executing action: ${err.message}`);
    } finally {
      setActionExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#5B5FC7]/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#5B5FC7] flex items-center justify-center text-white shadow-md shadow-[#5B5FC7]/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Incident War Room
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#5B5FC7]/20 text-[#8B8DE8] border border-[#5B5FC7]/40">
                  Adaptive Cards v1.5
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Channel: <span className="font-mono text-slate-300">{data?.channel || '#incident-war-room'}</span> • Interactive SRE Swarm &amp; 1-Click Recovery
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 mr-2 text-xs">
              <button
                onClick={() => setActiveTab('card')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === 'card'
                    ? 'bg-[#5B5FC7] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Card Preview
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeTab === 'json'
                    ? 'bg-[#5B5FC7] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Payload JSON
              </button>
            </div>

            <button
              onClick={handleCopyJson}
              disabled={!data}
              title="Copy JSON Payload"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/60">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-[#5B5FC7] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Generating Incident War Room notification card...</p>
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
              {activeTab === 'json' ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 whitespace-pre leading-relaxed overflow-x-auto selection:bg-[#5B5FC7]/40">
                  {JSON.stringify(data.adaptive_card, null, 2)}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Teams Message Shell Mock */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900 shadow-xl overflow-hidden">
                    {/* Teams Chat Header */}
                    <div className="bg-[#292B30] px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-[#5B5FC7] flex items-center justify-center font-bold text-white text-[10px]">
                          OM
                        </div>
                        <span className="font-semibold text-slate-200">OpsMemory LiveSite Bot</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                          APP
                        </span>
                        <span className="text-slate-500">• Just now</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Chat Notification Card Preview</span>
                    </div>

                    {/* Adaptive Card Surface */}
                    <div className="p-5 space-y-4 bg-slate-900">
                      {/* Attention Banner */}
                      <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm tracking-wide text-rose-100">
                            🚨 OpsMemory Incident Alert: {data.incident_code}
                          </div>
                          <div className="text-xs text-rose-300/80 mt-0.5">
                            Automated live-site diagnostics &amp; safe recovery pipeline
                          </div>
                        </div>
                      </div>

                      {/* FactSet Table */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-slate-500">Service:</span>{' '}
                          <span className="font-semibold text-slate-200">payment-api</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Environment:</span>{' '}
                          <span className="font-semibold text-emerald-400">PRODUCTION</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Fingerprint:</span>{' '}
                          <code className="text-indigo-300 font-mono text-[11px]">PAYMENT_API_DB_POOL_PRODUCTION</code>
                        </div>
                        <div>
                          <span className="text-slate-500">Organizational Memory:</span>{' '}
                          <span className="text-emerald-400 font-medium">Match Found (Confidence: 98%)</span>
                        </div>
                      </div>

                      {/* AI Diagnosis Block */}
                      <div className="p-3.5 rounded-lg bg-slate-800/40 border border-indigo-500/20 space-y-1.5">
                        <div className="text-xs font-semibold text-indigo-400 flex items-center space-x-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          <span>AI Diagnosis &amp; Verified Root Cause:</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          PostgreSQL connection pool exhaustion (20/20 active limit) caused by recent commit. 
                          Historical remediation match recommends rolling back to last known healthy build with zero cold-start delay.
                        </p>
                      </div>

                      {/* Deterministic Policy Check */}
                      <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-xs flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-indigo-300">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>
                            Policy Check: <strong className="text-emerald-300">[PERMITTED_CANARY_ROLLBACK]</strong> • Blast Radius: <strong className="text-indigo-200">Pod Level (Controlled)</strong>
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                          Safe Guard Active
                        </span>
                      </div>

                      {/* Action Buttons in Adaptive Card */}
                      <div className="pt-2 flex flex-wrap gap-2.5">
                        <button
                          onClick={handleExecuteInWarRoom}
                          disabled={actionExecuting}
                          className="flex-1 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-900/40"
                        >
                          {actionExecuting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Approve &amp; Execute: CANARY ROLLBACK</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setActionStatus('Incident escalated to On-Call PagerDuty/ICM rotation.');
                          }}
                          className="py-2 px-4 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>Escalate to On-Call SRE</span>
                        </button>
                      </div>

                      {actionStatus && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{actionStatus}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 text-center">
                    Simulates interactive chat notification cards via webhook connectors and bot frameworks.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Action Code:</span>
            <code className="text-[#8B8DE8] font-mono">{data?.action_code || 'ACT-PENDING'}</code>
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
