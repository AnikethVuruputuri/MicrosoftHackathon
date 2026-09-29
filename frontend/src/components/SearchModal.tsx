import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Workflow,
  GitBranch,
  Rocket,
  AlertTriangle,
  Brain,
  Plug,
  Settings,
  Shield,
  ShieldCheck,
  Play,
  FileCode,
  Flame,
  ArrowRight,
  X
} from 'lucide-react';

interface SearchItem {
  id: string;
  category: 'Navigation' | 'Incidents' | 'Repositories' | 'Actions';
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

const SEARCH_DATABASE: SearchItem[] = [
  // Navigation
  { id: 'nav-overview', category: 'Navigation', title: 'Overview', description: 'System KPIs, active release overview, learning showcase', path: '/overview', icon: LayoutDashboard },
  { id: 'nav-pipelines', category: 'Navigation', title: 'Pipelines & Workflows', description: 'CI/CD workflow executions, stage logs, and runner status', path: '/pipelines', icon: Workflow },
  { id: 'nav-repositories', category: 'Navigation', title: 'Repositories', description: 'Monitored GitHub and GitLab code repositories', path: '/repositories', icon: GitBranch },
  { id: 'nav-deployments', category: 'Navigation', title: 'Deployments & Risk Ledger', description: 'Production deployment records and risk assessments', path: '/deployments', icon: Rocket },
  { id: 'nav-incidents', category: 'Navigation', title: 'Incidents Queue', description: 'Pipeline failures and autonomous SRE investigations', path: '/incidents', icon: AlertTriangle },
  { id: 'nav-automation', category: 'Navigation', title: 'Safe Automation & Self-Recovery', description: 'Autonomous self-healing, blast-radius policy engine, and approval gates', path: '/automation', icon: ShieldCheck, badge: 'New' },
  { id: 'nav-memory', category: 'Navigation', title: 'Hindsight Memory Explorer', description: 'Organizational knowledge bank and natural language reflection', path: '/memory', icon: Brain },
  { id: 'nav-patterns', category: 'Navigation', title: 'Mined Failure Patterns', description: 'Catalog of recurring failure signatures and proven fixes', path: '/memory/patterns', icon: Flame },
  { id: 'nav-integrations', category: 'Navigation', title: 'Integrations & Observers', description: 'GitHub App, GitLab OAuth, and webhook listeners', path: '/integrations', icon: Plug },
  { id: 'nav-settings', category: 'Navigation', title: 'System Settings', description: 'Organization configuration, memory retention parameters', path: '/settings', icon: Settings },
  { id: 'nav-audit', category: 'Navigation', title: 'Audit Trail', description: 'Immutable compliance ledger of all operator and agent actions', path: '/settings/audit', icon: Shield },
  { id: 'nav-simulate', category: 'Navigation', title: 'Simulate Release Rollout', description: 'Trigger synthetic deployments to verify risk evaluation', path: '/deployments/simulate', icon: Play },

  // Incidents
  { id: 'inc-101', category: 'Incidents', title: 'INC-101: payment-api DB pool exhaustion', description: 'Active critical incident: Redis timeout followed by pool exhaustion', path: '/incidents/1', icon: AlertTriangle, badge: 'Critical' },
  { id: 'inc-095', category: 'Incidents', title: 'INC-095: user-service JWT_SECRET missing', description: 'Auth middleware panic on missing environment vault mapping', path: '/incidents', icon: AlertTriangle, badge: 'Resolved' },
  { id: 'inc-088', category: 'Incidents', title: 'INC-088: payment-api checkout 500 spike', description: 'PostgreSQL connection pool exhaustion resolved by scaling pool to 100', path: '/incidents', icon: AlertTriangle, badge: 'Resolved' },
  { id: 'inc-082', category: 'Incidents', title: 'INC-082: order-service queue timeout', description: 'Database connection pool exhaustion on order table during flash sale', path: '/incidents', icon: AlertTriangle, badge: 'Resolved' },
  { id: 'inc-076', category: 'Incidents', title: 'INC-076: notification-service httpx crash loop', description: 'Incompatible async HTTP client sub-dependency resolved via rollback', path: '/incidents', icon: AlertTriangle, badge: 'Resolved' },
  { id: 'inc-068', category: 'Incidents', title: 'INC-068: inventory-service row lock deadlock', description: 'Concurrency collision on warehouse stock reservations', path: '/incidents', icon: AlertTriangle, badge: 'Resolved' },

  // Repositories & Services
  { id: 'repo-payment', category: 'Repositories', title: 'acme/payment-api', description: 'Tier-1 core payment gateway with PostgreSQL pool & Redis cache', path: '/repositories', icon: GitBranch, badge: 'GitHub' },
  { id: 'repo-user', category: 'Repositories', title: 'acme/user-service', description: 'Tier-1 user authentication, JWT verification, session manager', path: '/repositories', icon: GitBranch, badge: 'GitHub' },
  { id: 'repo-inventory', category: 'Repositories', title: 'fintech/inventory-service', description: 'Tier-2 real-time warehouse stock tracking and lock manager', path: '/repositories', icon: GitBranch, badge: 'GitLab' },
  { id: 'repo-order', category: 'Repositories', title: 'acme/order-service', description: 'Tier-1 order placement, cart calculation, fulfillment sync', path: '/repositories', icon: GitBranch, badge: 'GitHub' },
  { id: 'repo-notify', category: 'Repositories', title: 'acme/notification-service', description: 'Tier-2 push alerts, transactional emails, SMS worker fleet', path: '/repositories', icon: GitBranch, badge: 'GitHub' },

  // Quick Actions
  { id: 'act-sim', category: 'Actions', title: 'Simulate Release Failure', description: 'Test OpsMemory LangGraph investigation on synthetic failure', path: '/deployments/simulate', icon: Play },
  { id: 'act-connect', category: 'Actions', title: 'Connect New Repository', description: 'Onboard GitHub or GitLab repo with automated webhook listener', path: '/integrations', icon: Plug },
  { id: 'act-reflect', category: 'Actions', title: 'Ask Hindsight Memory', description: 'Query historical incident solutions using organizational memory', path: '/memory', icon: Brain },
];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredItems = SEARCH_DATABASE.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }).slice(0, 10);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: SearchItem) => {
    onClose();
    navigate(item.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 border-b border-gray-200">
          <Search className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, incidents, repositories, or actions... (Esc to close)"
            className="w-full py-4 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No results found for "<span className="font-semibold text-gray-700">{query}</span>"
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-md flex-shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.title}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                                item.badge === 'Critical'
                                  ? 'bg-red-100 text-red-700'
                                  : item.badge === 'GitHub'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 pl-2">
                      <span className="text-[11px] font-mono uppercase text-gray-400 hidden sm:inline">
                        {item.category}
                      </span>
                      <ArrowRight className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px]">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px]">esc</kbd>
              Close
            </span>
          </div>
          <span className="font-mono text-gray-400">OpsMemory Quick Switcher</span>
        </div>
      </div>
    </div>
  );
}
