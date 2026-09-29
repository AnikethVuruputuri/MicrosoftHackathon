import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, AlertTriangle, Brain, GitBranch, Check, X, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SearchModal } from '../SearchModal';
import { LiveDemoModal } from '../LiveDemoModal';
import { Sparkles, Zap } from 'lucide-react';

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Listen for Ctrl+K / Cmd+K globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  const notifications = [
    {
      id: 'n1',
      title: 'Active Incident INC-101',
      description: 'Database pool exhaustion detected on payment-api production rollout',
      time: '15m ago',
      type: 'incident',
      icon: AlertTriangle,
      iconColor: 'text-red-600 bg-red-50',
      action: () => {
        setIsNotificationsOpen(false);
        navigate('/incidents/1');
      }
    },
    {
      id: 'n2',
      title: 'Hindsight Memory Retained',
      description: 'Engineering correction for INC-095 stored in org memory bank',
      time: '2h ago',
      type: 'memory',
      icon: Brain,
      iconColor: 'text-purple-600 bg-purple-50',
      action: () => {
        setIsNotificationsOpen(false);
        navigate('/memory');
      }
    },
    {
      id: 'n3',
      title: 'Webhook Synchronized',
      description: 'GitHub Actions delivery completed for acme/payment-api #101',
      time: '3h ago',
      type: 'system',
      icon: GitBranch,
      iconColor: 'text-blue-600 bg-blue-50',
      action: () => {
        setIsNotificationsOpen(false);
        navigate('/pipelines');
      }
    }
  ];

  return (
    <>
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
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:border-gray-300 transition-all cursor-pointer shadow-xs"
            title="Global search across all items (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500 font-normal">Search...</span>
            <kbd className="hidden sm:inline text-[10px] font-mono text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5 shadow-2xs">
              Ctrl K
            </kbd>
          </button>

          {/* Live Demo Arena trigger button for Hackathon judges & presenters */}
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-md shadow-xs shadow-indigo-200 transition-all cursor-pointer animate-pulse hover:animate-none"
            title="Launch 2-Minute Interactive Hackathon Demo & Benchmarks"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Live Demo Arena</span>
          </button>

          {/* Environment badge */}
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full select-none">
            Demo
          </span>

          {/* Notifications Trigger & Popover */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-md hover:bg-gray-100"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => setUnreadCount(0)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={n.action}
                        className="p-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3"
                      >
                        <div className={`p-2 rounded-lg flex-shrink-0 ${n.iconColor}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 truncate">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono ml-2 whitespace-nowrap">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      navigate('/settings/audit');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View audit ledger →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette / Search Dialog */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Live Demo Sandbox & Presentation Walkthrough */}
      <LiveDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </>
  );
}
