import React, { useState, useEffect } from 'react';
import { AuditLogItem } from '../types';
import { fetchAuditLogs } from '../services/api';
import { Shield, Search } from 'lucide-react';

// Reusable components for the light theme
const PageHeader: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-gray-200 mb-6">
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
        <Shield className="w-6 h-6" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>('');

  useEffect(() => {
    fetchAuditLogs()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l => 
    !filterText || 
    l.action.toLowerCase().includes(filterText.toLowerCase()) || 
    l.resource_type.toLowerCase().includes(filterText.toLowerCase()) ||
    l.actor.toLowerCase().includes(filterText.toLowerCase()) ||
    (l.details && l.details.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto pb-10">
      
      <PageHeader 
        title="Audit Log" 
        description="Immutable historical record of integration connections, incident investigations, engineer corrections, and Hindsight memory retentions."
      />

      {/* Filter Bar */}
      <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search audit actions, actors, or resources..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    Loading audit logs...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors text-sm">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {log.actor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase">{log.resource_type}</span>
                        <span className="text-gray-900 font-medium">{log.resource_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-md truncate">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
