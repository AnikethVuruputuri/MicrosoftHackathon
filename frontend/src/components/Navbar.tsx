import React from 'react';
import devLogo from '../dev-logo.png';
import { 
  Brain, 
  Layers, 
  AlertTriangle, 
  Cpu, 
  Flame, 
  PlayCircle,
  Activity,
  Radio,
  Shield,
  Building2,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedOrg?: string;
  selectedEnv?: string;
  onSelectOrg?: (org: string) => void;
  onSelectEnv?: (env: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  setCurrentTab,
  selectedOrg = 'Acme Corporation',
  selectedEnv = 'Production',
  onSelectOrg,
  onSelectEnv
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Activity },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'deployments', label: 'Deployments', icon: Layers },
    { id: 'integrations', label: 'Integrations', icon: Radio },
    { id: 'memory', label: 'Memory Explorer', icon: Brain },
    { id: 'patterns', label: 'Failure Patterns', icon: Flame },
    { id: 'audit', label: 'Audit Trail', icon: Shield },
    { id: 'simulate', label: 'Simulate Release', icon: PlayCircle },
  ];

  return (
    <header className="border-b border-[#30363d] bg-[#161b22] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
            <img src={devLogo} alt="OpsMemory Logo" className="h-8 w-8 rounded-md object-contain" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-base text-slate-100 tracking-tight">OpsMemory</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  LangGraph + Hindsight
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-none hidden sm:block">
                Organizational memory for CI/CD
              </p>
            </div>
          </div>

          {/* Org & Environment Selectors */}
          <div className="hidden md:flex items-center space-x-2 text-xs font-mono">
            <div className="flex items-center space-x-1.5 bg-[#0d1117] px-2.5 py-1 rounded border border-[#30363d] text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{selectedOrg}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-[#0d1117] px-2.5 py-1 rounded border border-[#30363d] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{selectedEnv}</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#21262d] text-white border border-[#30363d] shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#1c2128]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </div>
    </header>
  );
};
