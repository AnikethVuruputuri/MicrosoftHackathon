import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  subtitle?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  className,
  subtitle,
}: MetricCardProps) {
  const trendColor =
    change === undefined
      ? ''
      : change > 0
      ? 'text-[#16A36A]'
      : change < 0
      ? 'text-[#D92D3A]'
      : 'text-[#7A8699]';
  const TrendIcon =
    change === undefined ? null : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'bg-white border border-[#E4E9F0] rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#D5DDE8] transition-all duration-150 flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[13px] font-medium text-[#5B667A] tracking-tight">{label}</span>
        {icon && <span className="text-[#7A8699] flex-shrink-0">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold text-[#111827] tracking-tight tabular-nums leading-none">
          {value}
        </span>
        {change !== undefined && TrendIcon && (
          <span className={cn('flex items-center gap-0.5 text-xs font-semibold', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(change)}%</span>
            {changeLabel && <span className="text-[#7A8699] ml-1 font-normal">{changeLabel}</span>}
          </span>
        )}
      </div>

      {subtitle && <p className="text-[11px] text-[#7A8699] mt-2 font-normal">{subtitle}</p>}
    </div>
  );
}
