import React from 'react';
import { cn } from '../../lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 sm:p-12 text-center', className)}>
      <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E4E9F0] flex items-center justify-center text-[#7A8699] mb-3.5 shadow-xs">
        {icon || <Inbox className="h-6 w-6 stroke-[1.5]" />}
      </div>
      <h3 className="text-sm font-semibold text-[#111827] mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-[#5B667A] max-w-md leading-relaxed mb-4">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
