import React from 'react';
import { StageLog } from '../types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  stageLogs: StageLog[];
  isInvestigating: boolean;
}

export const StageTracker: React.FC<Props> = ({ stageLogs, isInvestigating }) => {
  const ALL_STAGES = [
    { id: 'load_incident', name: '1. Load Incident' },
    { id: 'generate_fingerprint', name: '2. Generate Fingerprint' },
    { id: 'recall_memory', name: '3. Recall Memory' },
    { id: 'collect_current_evidence', name: '4. Collect Evidence' },
    { id: 'check_historical_corrections', name: '5. Check Corrections' },
    { id: 'analyze_incident', name: '6. LLM Reasoning' },
    { id: 'generate_diagnosis', name: '7. Diagnosis' },
    { id: 'human_review', name: '8. Engineer Review' },
    { id: 'resolution', name: '9. Resolution' },
    { id: 'retain_learning', name: '10. Retain Memory' },
  ];

  const completedMap = new Map<string, StageLog>();
  stageLogs.forEach((log) => {
    completedMap.set(log.stage, log);
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
          LangGraph Agent Pipeline
        </h3>
        <span className="text-xs text-gray-500 font-mono tabular-nums">
          {stageLogs.length} / {ALL_STAGES.length} completed
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {ALL_STAGES.map((stage, idx) => {
          const log = completedMap.get(stage.id);
          const isCompleted = !!log;
          const isCurrent = isInvestigating && idx === stageLogs.length;

          return (
            <div
              key={stage.id}
              className={cn(
                'p-2 rounded-md border text-xs transition-colors',
                isCompleted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isCurrent
                  ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-300'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                )}
                <span className="font-medium truncate text-[11px]">{stage.name}</span>
              </div>
              <div className="text-[10px] pl-5 font-mono">
                {isCompleted ? (
                  <span className="text-emerald-600">Done</span>
                ) : isCurrent ? (
                  <span className="text-blue-600">Running...</span>
                ) : (
                  <span className="text-gray-300">Pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
