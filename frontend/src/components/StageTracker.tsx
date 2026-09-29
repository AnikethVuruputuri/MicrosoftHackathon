import React, { useState } from 'react';
import { StageLog } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Brain, 
  Fingerprint, 
  FolderDown, 
  Terminal, 
  History, 
  Cpu, 
  FileText, 
  ShieldCheck, 
  UserCheck, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  stageLogs: StageLog[];
  isInvestigating: boolean;
}

export const StageTracker: React.FC<Props> = ({ stageLogs, isInvestigating }) => {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const ALL_STAGES = [
    { id: 'load_incident', name: '1. Load Context', desc: 'Incident & commit metadata', icon: FolderDown },
    { id: 'generate_fingerprint', name: '2. Fingerprint', desc: 'Deterministic hash engine', icon: Fingerprint },
    { id: 'recall_memory', name: '3. Hindsight Recall', desc: 'Vector similarity search', icon: Brain },
    { id: 'collect_evidence', name: '4. Live Logs', desc: 'Ingest stack trace & diffs', icon: Terminal },
    { id: 'check_historical_corrections', name: '5. Corrections', desc: 'Inspect past engineer overrides', icon: History },
    { id: 'analyze_incident', name: '6. LLM Reasoning', desc: 'Synthesize hypotheses', icon: Cpu },
    { id: 'generate_diagnosis', name: '7. Diagnosis', desc: 'Formulate root cause', icon: FileText },
    { id: 'evaluate_automation_policy', name: '8. Safety Policy', desc: 'Deterministic risk evaluation', icon: ShieldCheck },
    { id: 'resolution', name: '9. Recovery Gate', desc: 'Action execution & approval', icon: UserCheck },
    { id: 'retain_learning', name: '10. Retain Memory', desc: 'Update Hindsight memory layer', icon: Sparkles },
  ];

  const completedMap = new Map<string, StageLog>();
  stageLogs.forEach((log) => {
    completedMap.set(log.stage, log);
    // Also map common aliases
    if (log.stage === 'collect_current_evidence') completedMap.set('collect_evidence', log);
    if (log.stage === 'evaluate_automation') completedMap.set('evaluate_automation_policy', log);
    if (log.stage === 'human_correction') completedMap.set('resolution', log);
  });

  const activeLog = selectedStage ? completedMap.get(selectedStage) : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            LangGraph Investigation & Safety Engine
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
            {stageLogs.length} / {ALL_STAGES.length} Nodes Finished
          </span>
          {isInvestigating && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Executing Graph...
            </span>
          )}
        </div>
      </div>

      {/* Visual Pipeline Nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {ALL_STAGES.map((stage, idx) => {
          const log = completedMap.get(stage.id);
          const isCompleted = !!log;
          const isCurrent = isInvestigating && idx === stageLogs.length;
          const Icon = stage.icon;
          const isSelected = selectedStage === stage.id;

          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(isSelected ? null : stage.id)}
              className={cn(
                'p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer',
                isCompleted
                  ? isSelected
                    ? 'bg-emerald-100/60 border-emerald-400 ring-2 ring-emerald-400/30'
                    : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                  : isCurrent
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/20 animate-pulse'
                  : 'bg-gray-50/60 border-gray-200 hover:border-gray-300 text-gray-400'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center',
                  isCompleted ? 'bg-emerald-100 text-emerald-700' : isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-300" />
                )}
              </div>

              <div>
                <span className={cn(
                  'text-[11px] font-bold block truncate',
                  isCompleted ? 'text-gray-900' : isCurrent ? 'text-blue-900' : 'text-gray-500'
                )}>
                  {stage.name}
                </span>
                <span className="text-[10px] text-gray-500 block truncate">
                  {stage.desc}
                </span>
              </div>

              {isCompleted && (
                <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-emerald-700">
                  <span>Click details</span>
                  {isSelected ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Stage Detail Drawer */}
      {activeLog && (
        <div className="mt-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-700" />
              Node Stage Output: {activeLog.title || activeLog.stage}
            </span>
            <span className="font-mono text-[10px] bg-white border border-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-semibold uppercase">
              {activeLog.status}
            </span>
          </div>
          <p className="text-gray-700 font-mono text-[11px] leading-relaxed bg-white/80 p-2.5 rounded-lg border border-emerald-100">
            {activeLog.summary || JSON.stringify(activeLog, null, 2)}
          </p>
        </div>
      )}
    </div>
  );
};
