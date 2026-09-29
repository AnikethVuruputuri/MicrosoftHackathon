import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deployment } from '../types';
import { fetchDeployments } from '../services/api';
import { PageHeader, FilterBar, DataTable, StatusBadge, TableSkeleton } from '../components/ui';
import { formatRelativeTime } from '../lib/utils';
import { GitCommit, User, Play, ShieldCheck, AlertTriangle } from 'lucide-react';
import { RiskIndicator } from '../components/RiskIndicator';

export const Deployments: React.FC = () => {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('all');

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const res = await fetchDeployments(selectedService === 'all' ? undefined : selectedService);
      setDeployments(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, [selectedService]);

  const services = ['payment-api', 'user-service', 'order-service', 'notification-service', 'inventory-service'];

  const filterOptions = [
    {
      label: 'Service',
      value: selectedService,
      options: [
        { value: 'all', label: 'All Services' },
        ...services.map((s) => ({ value: s, label: s })),
      ],
      onChange: (value: string) => setSelectedService(value),
    },
  ];

  const getStatusMap = (status: Deployment['status']): string => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'failure';
      case 'rolled_back':
        return 'warning';
      case 'in_progress':
        return 'running';
      case 'pending':
        return 'pending';
      default:
        return 'pending';
    }
  };

  const filteredDeployments = deployments.filter((dep) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      dep.commit_sha.toLowerCase().includes(q) ||
      dep.commit_message.toLowerCase().includes(q) ||
      dep.author.toLowerCase().includes(q) ||
      dep.deployment_number.toString().includes(q)
    );
  });

  const columns = [
    {
      key: 'release',
      label: 'Release',
      render: (dep: Deployment) => (
        <span className="font-mono text-xs font-semibold text-[#111827] bg-[#F8FAFC] border border-[#E4E9F0] px-2 py-0.5 rounded">
          #{dep.deployment_number}
        </span>
      ),
    },
    {
      key: 'service',
      label: 'Service',
      render: (dep: Deployment) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[#111827] text-sm">{dep.service_name}</span>
          <span className="text-[11px] text-[#7A8699] font-medium capitalize">{dep.environment}</span>
        </div>
      ),
    },
    {
      key: 'commit',
      label: 'Commit',
      render: (dep: Deployment) => (
        <div className="flex flex-col max-w-[260px]">
          <div className="flex items-center gap-1.5 font-mono text-xs text-[#2563EB] mb-0.5">
            <GitCommit className="w-3.5 h-3.5 text-[#7A8699]" />
            <span className="bg-[#EFF6FF] px-1.5 py-0.2 rounded border border-[#BFDBFE]">
              {dep.commit_sha.substring(0, 8)}
            </span>
          </div>
          <span className="text-xs text-[#5B667A] truncate font-mono" title={dep.commit_message}>
            {dep.commit_message}
          </span>
        </div>
      ),
    },
    {
      key: 'author',
      label: 'Author',
      render: (dep: Deployment) => (
        <div className="flex items-center gap-1.5 text-xs text-[#5B667A]">
          <User className="w-3.5 h-3.5 text-[#7A8699]" />
          <span>{dep.author}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (dep: Deployment) => (
        <StatusBadge status={getStatusMap(dep.status)} label={dep.status.replace('_', ' ')} size="sm" />
      ),
    },
    {
      key: 'risk',
      label: 'Historical Risk',
      render: (dep: Deployment) => (
        <RiskIndicator riskLevel={dep.risk_level} compact />
      ),
    },
    {
      key: 'started',
      label: 'Time',
      render: (dep: Deployment) => (
        <span className="text-xs text-[#5B667A] font-mono whitespace-nowrap">
          {formatRelativeTime(dep.started_at)}
        </span>
      ),
    },
    {
      key: 'recovery',
      label: 'Recovery Guard',
      render: (dep: Deployment) => (
        <div>
          {dep.status === 'failed' ? (
            <button
              onClick={() => navigate('/automation')}
              className="text-[11px] font-bold text-[#D92D3A] hover:text-white bg-[#FFF1F2] hover:bg-[#D92D3A] border border-[#FECDD3] px-2.5 py-1 rounded-md transition-colors shadow-2xs"
            >
              Trigger Recovery
            </button>
          ) : dep.status === 'rolled_back' ? (
            <span className="text-[11px] font-semibold text-[#D99100] bg-[#FFF8E6] border border-[#FDE68A] px-2 py-0.5 rounded-full">
              Rollback Policy
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#16A36A] font-medium bg-[#ECFDF3] border border-[#A6F4C5] px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              Guarded
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments & Rollouts"
        description="Observe fleet releases, historical change risk signatures, and safe automated recovery actions."
        actions={
          <button
            onClick={() => navigate('/deployments/simulate')}
            className="btn-primary"
          >
            <Play className="h-4 w-4" />
            <span>Simulate Deployment</span>
          </button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deployments by commit, author, or release #..."
        filters={filterOptions}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (
        <DataTable
          columns={columns}
          data={filteredDeployments}
          keyExtractor={(dep) => dep.id}
          emptyTitle="No deployments found"
          emptyDescription="No fleet deployments matched your current search or service filters."
          emptyAction={
            <button
              onClick={() => navigate('/deployments/simulate')}
              className="btn-primary text-xs"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Simulate Deployment</span>
            </button>
          }
        />
      )}
    </div>
  );
};
