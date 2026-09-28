import { cn } from '../../lib/utils';
import { STATUS_COLORS, type StatusType } from '../../lib/constants';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, label, size = 'sm', className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as StatusType;
  const colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.pending;
  const displayLabel = label || status;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        colors.bg,
        colors.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
    >
      <span className={cn('rounded-full', colors.dot, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      {displayLabel}
    </span>
  );
}
