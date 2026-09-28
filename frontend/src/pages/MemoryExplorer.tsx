import React, { useState, useEffect } from 'react';
import { fetchMemories } from '../services/api';
import { Brain, Search, Sparkles, Calendar } from 'lucide-react';

export const MemoryExplorer: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [reflectQuery, setReflectQuery] = useState<string>('What have we learned from previous database connection pool exhaustion incidents on payment-api?');
  const [reflectionResult, setReflectionResult] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState<boolean>(false);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const res = await fetchMemories({
        service: selectedService || undefined,
        memory_type: selectedType || undefined,
        fingerprint: searchQuery || undefined
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [selectedService, selectedType, searchQuery]);

  const handleReflect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setReflecting(true);
      const res = await fetch(`/api/memory/reflect?query=${encodeURIComponent(reflectQuery)}`);
      const json = await res.json();
      setReflectionResult(json.reflection);
    } catch (err) {
      console.error(err);
    } finally {
      setReflecting(false);
    }
  };

  const services = ['payment-api', 'user-service', 'order-service', 'notification-service', 'inventory-service'];
  const memoryTypes = [
    { id: 'human_correction', label: 'Human Corrections' },
    { id: 'engineering_knowledge', label: 'Engineering Knowledge' },
    { id: 'incident', label: 'Incident Memories' },
    { id: 'deployment', label: 'Deployment Memories' },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            Memory Explorer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Explore and reflect on persistent operational memory across deployments and human corrections.
          </p>
        </div>
        {data?.status && (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span>Bank ID:</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-900 border border-gray-200 font-mono text-xs">
              {data.status.bank_id}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Hindsight Reflect</h3>
        </div>
        <div className="p-4 bg-blue-50 rounded-b-lg">
          <form onSubmit={handleReflect} className="flex flex-wrap gap-3">
            <input
              type="text"
              value={reflectQuery}
              onChange={(e) => setReflectQuery(e.target.value)}
              placeholder="Ask a high-level question..."
              className="flex-1 min-w-[280px] bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={reflecting}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {reflecting ? 'Reflecting...' : 'Reflect'}
            </button>
          </form>
          {reflectionResult && (
            <div className="mt-4 p-4 rounded-md bg-white border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-sm">
              {reflectionResult}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by failure fingerprint..."
            className="w-full bg-white border border-gray-300 rounded-md pl-9 pr-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="">All Services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="">All Memory Types</option>
          {memoryTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-200">
          {data?.memories?.map((mem: any) => (
            <div key={mem.id} className="p-5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-medium text-gray-500">{mem.id}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    mem.memory_type === 'human_correction' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    mem.memory_type === 'engineering_knowledge' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {mem.memory_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{mem.created_at || '2026-09-28'}</span>
                </div>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed mb-4">
                {mem.contents}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {mem.tags?.map((tag: string, idx: number) => (
                    <span key={idx} className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
                {mem.metadata?.failure_fingerprint && (
                  <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                    FP: {mem.metadata.failure_fingerprint}
                  </span>
                )}
              </div>
            </div>
          ))}
          {(!data?.memories || data.memories.length === 0) && !loading && (
            <div className="p-8 text-center text-gray-500 text-sm">
              No memories found matching the criteria.
            </div>
          )}
          {loading && (
            <div className="p-8 text-center text-gray-500 text-sm">
              Loading memories...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
