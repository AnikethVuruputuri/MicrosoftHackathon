import { useState } from 'react';
import { PageHeader } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Settings, Plug, FileText, Shield } from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'security', label: 'Security', icon: Shield },
] as const;

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your OpsMemory configuration"
      />

      <div className="flex gap-6">
        {/* Settings sidebar */}
        <nav className="w-48 space-y-0.5 flex-shrink-0">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <button
            onClick={() => navigate('/integrations')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors text-left"
          >
            <Plug className="h-4 w-4" />
            Integrations
          </button>
          <button
            onClick={() => navigate('/settings/audit')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors text-left"
          >
            <FileText className="h-4 w-4" />
            Audit Log
          </button>
        </nav>

        {/* Content area */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">Organization</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Organization Name</label>
                    <input
                      type="text"
                      defaultValue="Acme Corporation"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Environment</label>
                    <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Production</option>
                      <option>Staging</option>
                      <option>Development</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Memory Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">Auto-retain investigation results</span>
                      <p className="text-xs text-gray-500">Automatically store successful investigation outcomes in organizational memory</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">Learn from human corrections</span>
                      <p className="text-xs text-gray-500">Store engineer corrections to improve future investigations</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">Pipeline failure alerts</span>
                      <p className="text-xs text-gray-500">Get notified when a monitored pipeline fails</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <div>
                      <span className="text-sm text-gray-900">New pattern detection</span>
                      <p className="text-xs text-gray-500">Alert when a new failure pattern is identified</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">API Keys</h3>
                <p className="text-sm text-gray-500 mb-4">Manage API keys for programmatic access to OpsMemory.</p>
                <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                  Generate API Key
                </button>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Webhook Secrets</h3>
                <p className="text-sm text-gray-500">Webhook secrets are managed per integration. Go to Integrations to configure webhook verification.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
