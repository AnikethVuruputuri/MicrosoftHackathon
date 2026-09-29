import { useLocation, Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import devLogo from '../../dev-logo.png';
import {
  LayoutDashboard,
  GitBranch,
  Workflow,
  Rocket,
  AlertTriangle,
  Brain,
  ShieldCheck,
  Plug,
  Settings,
  X,
} from 'lucide-react';

const MAIN_NAV = [
  { label: 'Overview', path: '/overview', icon: LayoutDashboard },
  { label: 'Repositories', path: '/repositories', icon: GitBranch },
  { label: 'Pipelines', path: '/pipelines', icon: Workflow },
  { label: 'Deployments', path: '/deployments', icon: Rocket },
  { label: 'Incidents', path: '/incidents', icon: AlertTriangle },
  { label: 'Automation', path: '/automation', icon: ShieldCheck },
  { label: 'Memory', path: '/memory', icon: Brain },
];

const SYSTEM_NAV = [
  { label: 'Integrations', path: '/integrations', icon: Plug },
  { label: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/overview') return location.pathname === '/' || location.pathname === '/overview';
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 w-[232px] bg-white border-r border-[#E4E9F0] flex flex-col z-30 transition-transform duration-200 ease-in-out',
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#E4E9F0]">
        <Link to="/overview" className="flex items-center gap-2.5 group" onClick={onClose}>
          <img
            src={devLogo}
            alt="OpsMemory"
            className="h-7 w-7 object-contain rounded-md shadow-xs group-hover:scale-105 transition-transform"
          />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-[#111827] tracking-tight leading-tight">
              OpsMemory
            </span>
            <span className="text-[10px] font-medium text-[#7A8699] tracking-wider uppercase">
              DevOps Intelligence
            </span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-[#7A8699] hover:text-[#111827] rounded-md hover:bg-[#F8FAFC] transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Navigation Group */}
      <div className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        <div>
          <span className="px-2.5 text-[10px] font-bold text-[#7A8699] uppercase tracking-wider block mb-1.5">
            Main
          </span>
          <nav className="space-y-0.5">
            {MAIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-120',
                    active
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold shadow-[0_1px_2px_rgba(37,99,235,0.06)]'
                      : 'text-[#5B667A] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                      active ? 'text-[#2563EB]' : 'text-[#7A8699]'
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* System Navigation Group */}
        <div>
          <span className="px-2.5 text-[10px] font-bold text-[#7A8699] uppercase tracking-wider block mb-1.5">
            System
          </span>
          <nav className="space-y-0.5">
            {SYSTEM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-120',
                    active
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold shadow-[0_1px_2px_rgba(37,99,235,0.06)]'
                      : 'text-[#5B667A] hover:text-[#111827] hover:bg-[#F8FAFC]'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                      active ? 'text-[#2563EB]' : 'text-[#7A8699]'
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* System Status Footer */}
      <div className="p-3 border-t border-[#E4E9F0] bg-[#FAFBFC]">
        <div className="flex items-center justify-between text-xs text-[#5B667A] px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A36A] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A36A]"></span>
            </span>
            <span className="font-medium text-[#111827]">Engine Online</span>
          </div>
          <span className="font-mono text-[10px] text-[#7A8699]">v2.4-prod</span>
        </div>
      </div>
    </aside>
  );
}
