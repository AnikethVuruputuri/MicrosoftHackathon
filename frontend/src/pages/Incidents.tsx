import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident } from '../types';
import { fetchIncidents } from '../services/api';
import { PageHeader, FilterBar, DataTable, StatusBadge, TableSkeleton } from '../components/ui';
import { formatRelativeTime } from '../lib/utils';
import { Brain, AlertTriangle } from 'lucide-react';

export const Incidents: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const apiStatus = selectedStatus === 'all' ? undefined : selectedStatus;
      const res = await fetchIncidents(apiStatus);
      setIncidents(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [selectedStatus]);

  const filteredIncidents = useMemo(() => {
    if (!searchQuery) return incidents;
    const lowerQuery = searchQuery.toLowerCase();
    return incidents.filter(
      (inc) =>
        inc.title.toLowerCase().includes(lowerQuery) ||
        inc.incident_code.toLowerCase().includes(lowerQuery) ||
        inc.service_name.toLowerCase().includes(lowerQuery)
    );
  }, [incidents, searchQuery]);

  const getSeverityStatus = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'failure';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  };

  const getIncidentStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'investigating':
        return { type: 'investigating', label: 'Investigating' };
      case 'diagnosing':
        return { type: 'running', label: 'Diagnosing' };
      case 'corrected':
        return { type: 'warning', label: 'Corrected' };
      case 'resolved':
        return { type: 'resolved', label: 'Resolved' };
      case 'closed':
        return { type: 'closed', label: 'Closed' };
      default:
        return { type: 'pending', label: status };
    }
  };

  const columns = [
    {
      key: 'incident_code',
      label: 'Incident Code',
      render: (row: Incident) => (
        <span className="font-mono text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded">
          {row.incident_code}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Incident Title',
      render: (row: Incident) => (
        <span className="font-semibold text-[#111827] hover:text-[#2563EB] transition-colors leading-snug">
          {row.title}
        </span>
      ),
    },
    {
      key: 'service',
      label: 'Affected Service',
      render: (row: Incident) => (
        <span className="font-mono text-xs text-[#5B667A]">{row.service_name}</span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row: Incident) => (
        <StatusBadge
          status={getSeverityStatus(row.severity)}
          label={row.severity.toUpperCase()}
          size="sm"
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Incident) => {
        const { type, label } = getIncidentStatus(row.status);
        return <StatusBadge status={type} label={label} size="sm" />;
      },
    },
    {
      key: 'memory',
      label: 'Hindsight Memory',
      render: (row: Incident) => (
        row.retained_in_hindsight ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6D5CE7] bg-[#F3F0FF] border border-[#DDD6FE] px-2.5 py-0.5 rounded-full">
            <Brain className="h-3 w-3 flex-shrink-0" />
            <span>Memory Retained</span>
          </span>
        ) : (
          <span className="text-[11px] text-[#7A8699] font-normal">
            No Memory
          </span>
        )
      ),
    },
    {
      key: 'detected',
      label: 'Detected',
      render: (row: Incident) => (
        <span className="text-[#5B667A] text-xs font-mono">
          {formatRelativeTime(row.detected_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents & SRE Investigations"
        description="Telemetry-correlated deployment outages, automated root-cause analysis, and human resolution loops."
      />

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search incidents by title, code or service..."
        filters={[
          {
            label: 'Status',
            value: selectedStatus,
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'investigating', label: 'Investigating' },
              { value: 'diagnosing', label: 'Diagnosing' },
              { value: 'corrected', label: 'Corrected' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ],
            onChange: (val) => setSelectedStatus(val),
          },
        ]}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredIncidents}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/incidents/${row.id}`)}
          emptyTitle="No incidents found"
          emptyDescription="There are no active or historical incidents matching your filter."
        />
      )}
    </div>
  );
};
