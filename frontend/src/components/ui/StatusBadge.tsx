import { cn } from '../../lib/utils';
import { STATUS_COLORS } from '../../lib/constants';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, label, size = 'sm', className }: StatusBadgeProps) {
  const normalizedStatus = (status || 'pending').toLowerCase().replace(/\s+/g, '_');
  const colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.pending;
  const displayLabel =
    label ||
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <span className={cn('rounded-full flex-shrink-0', colors.dot, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
