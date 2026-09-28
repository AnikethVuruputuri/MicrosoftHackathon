import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident } from '../types';
import { fetchIncidents } from '../services/api';
import { PageHeader, FilterBar, DataTable, StatusBadge, TableSkeleton } from '../components/ui';
import { formatRelativeTime } from '../lib/utils';
import { Brain } from 'lucide-react';

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
    switch (severity) {
      case 'critical': return 'failure';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'info';
    }
  };

  const getIncidentStatus = (status: string) => {
    switch (status) {
      case 'investigating': return { type: 'failure', label: 'Investigating' };
      case 'diagnosing': return { type: 'running', label: 'Diagnosing' };
      case 'corrected': return { type: 'warning', label: 'Corrected' };
      case 'resolved': return { type: 'success', label: 'Resolved' };
      case 'closed': return { type: 'pending', label: 'Closed' };
      default: return { type: 'info', label: status };
    }
  };

  const columns = [
    {
      key: 'incident_code',
      label: 'Incident Code',
      render: (row: Incident) => (
        <span className="font-mono text-xs font-medium text-gray-900">
          {row.incident_code}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (row: Incident) => (
        <span className="font-medium text-gray-900">{row.title}</span>
      ),
    },
    {
      key: 'service',
      label: 'Service',
      render: (row: Incident) => (
        <span className="text-gray-600">{row.service_name}</span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row: Incident) => (
        <StatusBadge
          status={getSeverityStatus(row.severity)}
          label={row.severity.charAt(0).toUpperCase() + row.severity.slice(1)}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Incident) => {
        const { type, label } = getIncidentStatus(row.status);
        return <StatusBadge status={type} label={label} />;
      },
    },
    {
      key: 'memory',
      label: 'Memory',
      render: (row: Incident) => (
        row.retained_in_hindsight ? (
          <div className="flex items-center text-blue-600">
            <Brain className="h-4 w-4" aria-label="Hindsight Retained" />
          </div>
        ) : null
      ),
    },
    {
      key: 'detected',
      label: 'Detected',
      render: (row: Incident) => (
        <span className="text-gray-500 text-sm">
          {formatRelativeTime(row.detected_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Deployment incidents and SRE investigations"
      />
      
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search incidents by title, code or service..."
        filters={[
          {
            label: 'Status',
            value: selectedStatus,
            onChange: setSelectedStatus,
            options: [
              { label: 'All', value: 'all' },
              { label: 'Investigating', value: 'investigating' },
              { label: 'Corrected', value: 'corrected' },
              { label: 'Resolved', value: 'resolved' },
            ],
          },
        ]}
      />

      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={filteredIncidents}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/incidents/${row.id}`)}
          emptyTitle="No incidents found"
          emptyDescription="No incidents match the current filters or search query."
        />
      )}
    </div>
  );
};
