import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, change, changeLabel, icon, className }: MetricCardProps) {
  const trendColor = change === undefined ? '' : change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-gray-500';
  const TrendIcon = change === undefined ? null : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</span>
        {change !== undefined && TrendIcon && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium mb-0.5', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(change)}%
            {changeLabel && <span className="text-gray-400 ml-1">{changeLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
