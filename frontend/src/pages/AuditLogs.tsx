import React, { useState, useEffect } from 'react';
import { AuditLogItem } from '../types';
import { fetchAuditLogs } from '../services/api';
import { PageHeader, FilterBar, DataTable, StatusBadge, TableSkeleton } from '../components/ui';
import { ShieldCheck, User, Clock, FileText } from 'lucide-react';

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

  const filtered = logs.filter(
    (l) =>
      !filterText ||
      l.action.toLowerCase().includes(filterText.toLowerCase()) ||
      l.resource_type.toLowerCase().includes(filterText.toLowerCase()) ||
      l.actor.toLowerCase().includes(filterText.toLowerCase()) ||
      (l.details && l.details.toLowerCase().includes(filterText.toLowerCase()))
  );

  const getActionBadgeType = (action: string) => {
    if (action.includes('approve') || action.includes('connect')) return 'success';
    if (action.includes('reject') || action.includes('fail') || action.includes('disconnect')) return 'failure';
    if (action.includes('memory') || action.includes('hindsight')) return 'learning';
    return 'info';
  };

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp (UTC)',
      render: (log: AuditLogItem) => (
        <span className="font-mono text-xs text-[#5B667A]">
          {new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19)}
        </span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor / Identity',
      render: (log: AuditLogItem) => (
        <div className="flex items-center gap-1.5 font-semibold text-[#111827] text-xs">
          <User className="w-3.5 h-3.5 text-[#7A8699]" />
          <span>{log.actor}</span>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Audit Action',
      render: (log: AuditLogItem) => (
        <StatusBadge
          status={getActionBadgeType(log.action)}
          label={log.action.replace(/_/g, ' ')}
          size="sm"
        />
      ),
    },
    {
      key: 'resource',
      label: 'Target Resource',
      render: (log: AuditLogItem) => (
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-[#7A8699] tracking-wider">
            {log.resource_type}
          </span>
          <span className="font-mono text-xs text-[#111827] font-medium">{log.resource_id}</span>
        </div>
      ),
    },
    {
      key: 'details',
      label: 'Audit Trace & Metadata',
      render: (log: AuditLogItem) => (
        <span className="text-xs text-[#5B667A] line-clamp-1 max-w-md" title={log.details || ''}>
          {log.details || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Ledger"
        description="Immutable cryptographic record of automation triggers, human corrections, policy approvals, and Hindsight memory retentions."
        badge={
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A36A] bg-[#ECFDF3] border border-[#A6F4C5] px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            Append-Only Verified
          </span>
        }
      />

      <FilterBar
        searchValue={filterText}
        onSearchChange={setFilterText}
        searchPlaceholder="Filter audit actions, actors, or resources..."
      />

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(log) => log.id}
          emptyTitle="No audit log entries found"
          emptyDescription="There are no audit events matching your current search query."
        />
      )}
    </div>
  );
};
