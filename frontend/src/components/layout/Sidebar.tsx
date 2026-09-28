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
  Plug,
  Settings,
} from 'lucide-react';

const MAIN_NAV = [
  { label: 'Overview', path: '/overview', icon: LayoutDashboard },
  { label: 'Repositories', path: '/repositories', icon: GitBranch },
  { label: 'Pipelines', path: '/pipelines', icon: Workflow },
  { label: 'Deployments', path: '/deployments', icon: Rocket },
  { label: 'Incidents', path: '/incidents', icon: AlertTriangle },
  { label: 'Memory', path: '/memory', icon: Brain },
];

const SECONDARY_NAV = [
  { label: 'Integrations', path: '/integrations', icon: Plug },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/overview') return location.pathname === '/' || location.pathname === '/overview';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <Link to="/overview" className="flex items-center gap-2.5">
          <img src={devLogo} alt="OpsMemory" className="h-8 w-8 object-contain rounded-md" />
          <span className="text-base font-semibold text-gray-900 tracking-tight">OpsMemory</span>
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <div className="mb-2">
          <span className="px-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider">Main</span>
        </div>
        {MAIN_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Nav */}
      <div className="px-3 py-3 border-t border-gray-200 space-y-0.5">
        <div className="mb-2">
          <span className="px-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider">System</span>
        </div>
        {SECONDARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          System healthy
        </div>
      </div>
    </aside>
  );
}
