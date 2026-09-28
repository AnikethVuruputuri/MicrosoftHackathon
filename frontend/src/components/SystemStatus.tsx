import React from 'react';
import { SystemStatus as SystemStatusType } from '../types';
import { Server, Cpu, Database, Brain, GitBranch } from 'lucide-react';

interface Props {
  status: SystemStatusType | null;
}

export const SystemStatus: React.FC<Props> = ({ status }) => {
  if (!status) return null;

  return (
    <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center space-x-2 text-slate-400 font-mono text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SYSTEM OBSERVABILITY:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-mono text-[11px]">
          {/* Backend */}
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Backend:</span>
            <span className="text-emerald-400 font-medium">{status.backend}</span>
          </div>

          {/* Groq LLM */}
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Groq ({status.groq_model.split('-')[0]}):</span>
            <span className={`px-1.5 py-0.2 rounded font-semibold ${
              status.groq_mode === 'REAL' 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}>
              {status.groq_mode}
            </span>
          </div>

          {/* Hindsight Long-term Memory */}
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Brain className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Hindsight ({status.hindsight_bank}):</span>
            <span className={`px-1.5 py-0.2 rounded font-semibold ${
              status.hindsight_mode === 'REAL' 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
            }`}>
              {status.hindsight_mode}
            </span>
          </div>

          {/* Database */}
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Database:</span>
            <span className="text-emerald-400 font-medium">{status.database_type}</span>
          </div>

          {/* GitHub */}
          <div className="flex items-center space-x-1.5 text-slate-300">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">CI/CD:</span>
            <span className="text-slate-300">{status.github_mode}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
