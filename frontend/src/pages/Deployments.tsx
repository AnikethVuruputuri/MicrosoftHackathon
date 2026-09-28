import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deployment } from '../types';
import { fetchDeployments } from '../services/api';
import { PageHeader, FilterBar, DataTable, StatusBadge, TableSkeleton } from '../components/ui';
import { formatRelativeTime } from '../lib/utils';
import { GitCommit, User } from 'lucide-react';

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
        ...services.map(s => ({ value: s, label: s }))
      ],
      onChange: (value: string) => setSelectedService(value)
    }
  ];

  const getStatusMap = (status: Deployment['status']): string => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'failure';
      case 'rolled_back': return 'warning';
      case 'in_progress': return 'running';
      case 'pending': return 'pending';
      default: return 'pending';
    }
  };

  const getRiskMap = (risk: Deployment['risk_level']): string => {
    switch (risk) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'failure';
      case 'critical': return 'failure';
      default: return 'pending';
    }
  };

  const filteredDeployments = deployments.filter(dep => {
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
        <span className="font-mono font-medium text-gray-900">
          #{dep.deployment_number}
        </span>
      ),
    },
    {
      key: 'service',
      label: 'Service',
      render: (dep: Deployment) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{dep.service_name}</span>
          <span className="text-xs text-gray-500 capitalize">{dep.environment}</span>
        </div>
      ),
    },
    {
      key: 'commit',
      label: 'Commit',
      render: (dep: Deployment) => (
        <div className="flex flex-col max-w-[250px]">
          <div className="flex items-center space-x-1.5 font-mono text-xs text-gray-600 mb-0.5">
            <GitCommit className="w-3.5 h-3.5 text-gray-400" />
            <span>{dep.commit_sha.substring(0, 7)}</span>
          </div>
          <span className="text-sm text-gray-600 truncate" title={dep.commit_message}>
            {dep.commit_message}
          </span>
        </div>
      ),
    },
    {
      key: 'author',
      label: 'Author',
      render: (dep: Deployment) => (
        <div className="flex items-center space-x-1.5 text-gray-600">
          <User className="w-4 h-4 text-gray-400" />
          <span>{dep.author}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (dep: Deployment) => (
        <StatusBadge 
          status={getStatusMap(dep.status)} 
          label={dep.status.replace('_', ' ')} 
        />
      ),
    },
    {
      key: 'risk',
      label: 'Risk',
      render: (dep: Deployment) => (
        <StatusBadge 
          status={getRiskMap(dep.risk_level)} 
          label={dep.risk_level} 
        />
      ),
    },
    {
      key: 'started',
      label: 'Started',
      render: (dep: Deployment) => (
        <span className="text-gray-600 whitespace-nowrap">
          {formatRelativeTime(dep.started_at)}
        </span>
      ),
    }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader 
        title="Deployments" 
        description="CI/CD deployment history and risk analysis"
      />
      
      <div className="p-6 flex-1 flex flex-col space-y-4">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search deployments..."
          filters={filterOptions}
        />

        <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <TableSkeleton cols={7} rows={8} />
          ) : (
            <DataTable 
              data={filteredDeployments} 
              columns={columns} 
              keyExtractor={(dep) => dep.id.toString()}
              emptyTitle="No deployments found"
              emptyDescription="No deployments match your criteria."
            />
          )}
        </div>
      </div>
    </div>
  );
};
