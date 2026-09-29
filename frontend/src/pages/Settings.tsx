import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Settings, Plug, FileText, Shield, ShieldCheck, Check, Save } from 'lucide-react';
import { fetchAutomationSettings, updateAutomationSettings } from '../services/api';
import { AutomationPolicy } from '../types';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'automation', label: 'Automation & Recovery', icon: ShieldCheck },
  { id: 'security', label: 'Security', icon: Shield },
] as const;

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [policy, setPolicy] = useState<AutomationPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAutomationSettings()
      .then(setPolicy)
      .catch(console.error)
      .finally(() => setPolicyLoading(false));
  }, []);

  const handleSavePolicy = async () => {
    if (!policy) return;
    try {
      setSavingPolicy(true);
      const updated = await updateAutomationSettings(policy);
      setPolicy(updated);
      setSavedMsg('Automation policy updated successfully.');
      setTimeout(() => setSavedMsg(null), 3500);
    } catch (err) {
      console.error('Failed to update policy:', err);
    } finally {
      setSavingPolicy(false);
    }
  };

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

          {activeTab === 'automation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">Safe Automation & Self-Recovery Policy</h3>
                <p className="text-xs text-gray-500">Configure global safety guardrails, blast-radius constraints, and approval requirements.</p>
              </div>

              {savedMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  {savedMsg}
                </div>
              )}

              {policyLoading ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading automation policy...</div>
              ) : policy ? (
                <div className="space-y-5">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                    <label className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">Enable Automation Subsystem</span>
                        <p className="text-xs text-gray-500">Master safety switch. When disabled, no automated actions can execute.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={policy.enabled}
                        onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    <div className="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Execution Mode</label>
                        <select
                          value={policy.mode}
                          onChange={(e) => setPolicy({ ...policy, mode: e.target.value as any })}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md bg-white text-gray-800"
                        >
                          <option value="approval_required">Approval Required (Safest)</option>
                          <option value="dry_run">Dry-Run (Simulate Only)</option>
                          <option value="autonomous">Autonomous (Auto-executes approved tiers)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Dry-Run Mode</label>
                        <select
                          value={policy.dry_run ? 'yes' : 'no'}
                          onChange={(e) => setPolicy({ ...policy, dry_run: e.target.value === 'yes' })}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md bg-white text-gray-800"
                        >
                          <option value="no">Real Execution (If permitted)</option>
                          <option value="yes">Dry-Run Only (Always simulated)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action Quotas & Cooldowns */}
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Guardrails & Blast-Radius Rules</h4>
                    
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-gray-600 mb-1 font-medium">Max Attempts/Incident</label>
                        <input
                          type="number"
                          value={policy.max_attempts_per_incident}
                          onChange={(e) => setPolicy({ ...policy, max_attempts_per_incident: parseInt(e.target.value) || 2 })}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1 font-medium">Retry Cooldown (sec)</label>
                        <input
                          type="number"
                          value={policy.retry_cooldown_seconds}
                          onChange={(e) => setPolicy({ ...policy, retry_cooldown_seconds: parseInt(e.target.value) || 300 })}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1 font-medium">Restart Cooldown (sec)</label>
                        <input
                          type="number"
                          value={policy.restart_cooldown_seconds}
                          onChange={(e) => setPolicy({ ...policy, restart_cooldown_seconds: parseInt(e.target.value) || 600 })}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 space-y-2.5 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={policy.allow_retry}
                          onChange={(e) => setPolicy({ ...policy, allow_retry: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Allow automated pipeline retries for transient failures</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={policy.allow_restart}
                          onChange={(e) => setPolicy({ ...policy, allow_restart: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Allow service restarts for connection pool / memory exhaustion</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={policy.rollback_approval_required}
                          onChange={(e) => setPolicy({ ...policy, rollback_approval_required: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Require human confirmation for deployment rollbacks (Recommended)</span>
                      </label>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Allowed Environments</label>
                      <input
                        type="text"
                        value={policy.allowed_environments}
                        onChange={(e) => setPolicy({ ...policy, allowed_environments: e.target.value })}
                        placeholder="staging, development, production"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSavePolicy}
                      disabled={savingPolicy}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingPolicy ? 'Saving...' : 'Save Automation Policy'}
                    </button>
                  </div>
                </div>
              ) : null}
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
