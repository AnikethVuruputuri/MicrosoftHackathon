import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, AlertTriangle, Brain, GitBranch, Menu, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SearchModal } from '../SearchModal';
import { LiveDemoModal } from '../LiveDemoModal';

interface TopBarProps {
  className?: string;
  onMenuToggle?: () => void;
}

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-semibold text-[#111827]">Overview</span>;
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs sm:text-sm">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = seg
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[#D5DDE8]">/</span>}
            <span
              className={cn(
                isLast
                  ? 'text-[#111827] font-semibold'
                  : 'text-[#5B667A] hover:text-[#111827] transition-colors hidden sm:inline'
              )}
            >
              {label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

export function TopBar({ className, onMenuToggle }: TopBarProps) {
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
      icon: AlertTriangle,
      iconColor: 'text-[#D92D3A] bg-[#FFF1F2]',
      action: () => {
        setIsNotificationsOpen(false);
        navigate('/incidents/1');
      },
    },
    {
      id: 'n2',
      title: 'Hindsight Memory Retained',
      description: 'Engineering correction for INC-095 stored in org memory bank',
      time: '2h ago',
      icon: Brain,
      iconColor: 'text-[#6D5CE7] bg-[#F3F0FF]',
      action: () => {
        setIsNotificationsOpen(false);
        navigate('/memory');
      },
    },
    {
      id: 'n3',
      title: 'Webhook Synchronized',
      description: 'GitHub Actions delivery completed for acme/payment-api #101',
      time: '3h ago',
      icon: GitBranch,
      iconColor: 'text-[#2563EB] bg-[#EFF6FF]',
      action: () => {
        setIsNotificationsOpen(false);
        navigate('/pipelines');
      },
    },
  ];

  return (
    <>
      <header
        className={cn(
          'fixed top-0 right-0 left-0 md:left-[232px] h-14 bg-white border-b border-[#E4E9F0] flex items-center justify-between px-4 sm:px-6 z-20 transition-all duration-200',
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="md:hidden p-1.5 -ml-1 text-[#5B667A] hover:text-[#111827] rounded-md hover:bg-[#F8FAFC] transition-colors"
              aria-label="Toggle navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Breadcrumbs />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 h-8 text-xs sm:text-sm text-[#5B667A] bg-[#F8FAFC] border border-[#E4E9F0] rounded-lg hover:border-[#D5DDE8] hover:bg-[#F1F4F9] transition-all cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            title="Global search across all items (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-[#7A8699]" />
            <span className="hidden sm:inline font-normal text-[#5B667A]">Search...</span>
            <kbd className="hidden md:inline text-[10px] font-mono font-medium text-[#7A8699] bg-white border border-[#E4E9F0] rounded px-1.5 py-0.2 shadow-2xs">
              Ctrl K
            </kbd>
          </button>

          {/* Live Evaluation Trigger */}
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg shadow-xs transition-all cursor-pointer"
            title="Launch Interactive Hackathon Demo & Benchmarks"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-200" />
            <span className="hidden xs:inline sm:inline">Evaluation Arena</span>
          </button>

          {/* Safe Policy State Badge */}
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-medium text-[#16A36A] bg-[#ECFDF3] border border-[#A6F4C5] px-2.5 py-0.5 rounded-full select-none">
            <ShieldCheck className="h-3 w-3" />
            Policy Engine Active
          </span>

          {/* Notifications Trigger & Popover */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative text-[#5B667A] hover:text-[#111827] transition-colors p-1.5 rounded-lg hover:bg-[#F8FAFC]"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 bg-[#D92D3A] rounded-full ring-2 ring-white" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E4E9F0] rounded-xl shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-[#E4E9F0] flex items-center justify-between bg-[#F8FAFC]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#111827]">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono bg-[#EFF6FF] text-[#2563EB] px-1.5 py-0.2 rounded-full font-bold border border-[#BFDBFE]">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => setUnreadCount(0)}
                      className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[#E4E9F0] max-h-80 overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={n.action}
                        className="p-3 hover:bg-[#F8FAFC] cursor-pointer transition-colors flex items-start gap-3"
                      >
                        <div className={`p-2 rounded-lg flex-shrink-0 ${n.iconColor}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#111827] truncate">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-[#7A8699] font-mono ml-2 whitespace-nowrap">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-xs text-[#5B667A] mt-0.5 line-clamp-2 leading-relaxed">
                            {n.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-[#E4E9F0] bg-[#FAFBFC] text-center">
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      navigate('/settings');
                    }}
                    className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium"
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
