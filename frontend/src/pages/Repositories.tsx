import { useState, useEffect } from 'react';
import { PageHeader, FilterBar, DataTable, StatusBadge, TableSkeleton, EmptyState } from '../components/ui';
import { fetchRepositories } from '../services/api';
import { RepositoryInfo } from '../types';
import { formatRelativeTime } from '../lib/utils';
import { GitBranch, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function RepositoriesPage() {
  const [repos, setRepos] = useState<RepositoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRepositories()
      .then(setRepos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = repos.filter((r) => {
    const matchesSearch = !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase());
    const matchesProvider = providerFilter === 'all' || r.provider === providerFilter;
    return matchesSearch && matchesProvider;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Monitored source code repositories"
        actions={
          <button
            onClick={() => navigate('/integrations')}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span>Connect Repository</span>
          </button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search repositories..."
        filters={[
          {
            label: 'Provider',
            value: providerFilter,
            options: [
              { label: 'All Providers', value: 'all' },
              { label: 'GitHub', value: 'github' },
              { label: 'GitLab', value: 'gitlab' },
            ],
            onChange: setProviderFilter,
          },
        ]}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Repository',
              sortable: true,
              render: (r: RepositoryInfo) => (
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-900">{r.full_name}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.provider}</span>
                  </div>
                </div>
              ),
            },
            {
              key: 'branch',
              label: 'Branch',
              render: (r: RepositoryInfo) => (
                <code className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                  {r.monitored_branch}
                </code>
              ),
            },
            {
              key: 'environment',
              label: 'Environment',
              render: (r: RepositoryInfo) => (
                <span className="text-sm text-gray-600 capitalize">{r.environment}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r: RepositoryInfo) => (
                <StatusBadge
                  status={r.is_monitored ? 'success' : 'pending'}
                  label={r.is_monitored ? 'Monitored' : 'Inactive'}
                />
              ),
            },
            {
              key: 'synced',
              label: 'Last Synced',
              render: (r: RepositoryInfo) => (
                <span className="text-sm text-gray-500">
                  {r.last_sync_at ? formatRelativeTime(r.last_sync_at) : 'Never'}
                </span>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(r) => r.id}
          emptyTitle="No repositories found"
          emptyDescription="Connect a GitHub or GitLab integration to start monitoring repositories."
          emptyAction={
            <button
              onClick={() => navigate('/integrations')}
              className="btn-primary text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Connect Integration</span>
            </button>
          }
        />
      )}
    </div>
  );
}
