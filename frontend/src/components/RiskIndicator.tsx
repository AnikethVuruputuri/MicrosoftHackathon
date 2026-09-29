import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, AlertOctagon, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { RISK_LEVELS } from '../lib/constants';

interface Props {
  riskLevel: string;
  riskReason?: string;
  className?: string;
  compact?: boolean;
}

export const RiskIndicator: React.FC<Props> = ({
  riskLevel,
  riskReason,
  className,
  compact = false,
}) => {
  const level = (riskLevel || 'low').toLowerCase() as keyof typeof RISK_LEVELS;
  const config = RISK_LEVELS[level] || RISK_LEVELS.low;

  const Icon =
    level === 'critical'
      ? AlertOctagon
      : level === 'high'
      ? ShieldAlert
      : level === 'medium'
      ? AlertTriangle
      : ShieldCheck;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
          config.bg,
          config.color,
          config.border,
          className
        )}
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border',
        config.bg,
        config.border,
        className
      )}
    >
      <div className={cn('p-1 rounded-md bg-white/80 border', config.border, 'flex-shrink-0 mt-0.5')}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B667A]">
            Historical Risk Assessment
          </span>
          <span
            className={cn(
              'text-[10px] font-bold px-1.5 py-0.2 rounded-full border bg-white/90',
              config.color,
              config.border
            )}
          >
            {config.label}
          </span>
        </div>
        <p className="text-xs text-[#111827] font-medium leading-relaxed">
          {riskReason || 'No historical failure pattern associations identified for this change signature.'}
        </p>
        <div className="flex items-center gap-1 text-[11px] text-[#7A8699] mt-1.5">
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>Derived from previous deployment outcomes in organizational memory</span>
        </div>
      </div>
    </div>
  );
};
