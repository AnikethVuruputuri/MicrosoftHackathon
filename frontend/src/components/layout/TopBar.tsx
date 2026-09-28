import { useLocation } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TopBarProps {
  className?: string;
}

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm text-gray-500">Overview</span>;
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = seg
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300">/</span>}
            <span className={cn(isLast ? 'text-gray-900 font-medium' : 'text-gray-500')}>
              {label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

export function TopBar({ className }: TopBarProps) {
  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-60 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20',
        className
      )}
    >
      <Breadcrumbs />

      <div className="flex items-center gap-3">
        {/* Search trigger */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
          onClick={() => {/* TODO: open search modal */}}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <kbd className="hidden sm:inline text-[10px] font-mono text-gray-400 bg-white border border-gray-200 rounded px-1 py-0.5">Ctrl K</kbd>
        </button>

        {/* Environment badge */}
        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          Demo
        </span>

        {/* Notifications */}
        <button className="relative text-gray-400 hover:text-gray-600 transition-colors p-1">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
