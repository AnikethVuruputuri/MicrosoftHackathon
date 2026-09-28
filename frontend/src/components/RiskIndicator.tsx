import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  riskLevel: string;
  riskReason?: string;
}

export const RiskIndicator: React.FC<Props> = ({ riskLevel, riskReason }) => {
  const level = (riskLevel || 'low').toLowerCase();

  const config = (() => {
    switch (level) {
      case 'critical':
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          iconColor: 'text-red-500',
          icon: ShieldAlert,
          label: 'High Risk',
        };
      case 'medium':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          iconColor: 'text-amber-500',
          icon: AlertTriangle,
          label: 'Medium Risk',
        };
      default:
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          iconColor: 'text-emerald-500',
          icon: ShieldCheck,
          label: 'Low Risk',
        };
    }
  })();

  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', config.bg, config.border)}>
      <div className={cn('p-1.5 rounded', config.bg)}>
        <Icon className={cn('w-4 h-4', config.iconColor)} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-gray-500">Risk Assessment:</span>
          <span className={cn('text-xs font-semibold', config.text)}>{config.label}</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {riskReason || 'No historical failure pattern associations identified for this change signature.'}
        </p>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 font-mono">
          <Info className="w-3 h-3" />
          <span>Derived from previous deployment outcomes in organizational memory</span>
        </div>
      </div>
    </div>
  );
};
