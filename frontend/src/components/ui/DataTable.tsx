import { useState } from 'react';
import { cn } from '../../lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  className,
  compact = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (data.length === 0) {
    return (
      <div className={cn('bg-white border border-[#E4E9F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white border border-[#E4E9F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E4E9F0]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-[11px] font-semibold text-[#5B667A] uppercase tracking-wider select-none whitespace-nowrap',
                    compact ? 'px-3 py-2.5' : 'px-4 py-3',
                    col.sortable && 'cursor-pointer hover:text-[#111827] transition-colors',
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3 w-3 text-[#2563EB]" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-[#2563EB]" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E9F0]">
            {data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                className={cn(
                  'bg-white transition-colors duration-100',
                  onRowClick ? 'cursor-pointer hover:bg-[#F8FAFC]' : 'hover:bg-[#FAFBFC]'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'text-sm text-[#111827] align-middle',
                      compact ? 'px-3 py-2' : 'px-4 py-3',
                      col.className
                    )}
                  >
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
