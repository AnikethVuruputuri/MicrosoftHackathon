import React, { useState, useEffect } from 'react';
import { fetchMemories } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Brain, Search, Sparkles, Calendar, Tag, ShieldCheck, UserCheck, Layers } from 'lucide-react';

export const MemoryExplorer: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [reflectQuery, setReflectQuery] = useState<string>(
    'What have we learned from previous database connection pool exhaustion incidents on payment-api?'
  );
  const [reflectionResult, setReflectionResult] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState<boolean>(false);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const res = await fetchMemories({
        service: selectedService || undefined,
        memory_type: selectedType || undefined,
        fingerprint: searchQuery || undefined,
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

  const getMemoryTypeBadge = (type: string) => {
    switch (type) {
      case 'human_correction':
        return {
          bg: 'bg-[#FFF8E6] text-[#D99100] border-[#FDE68A]',
          icon: UserCheck,
          label: 'Human Correction',
        };
      case 'engineering_knowledge':
        return {
          bg: 'bg-[#F3F0FF] text-[#6D5CE7] border-[#DDD6FE]',
          icon: Brain,
          label: 'Engineering Knowledge',
        };
      default:
        return {
          bg: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
          icon: Layers,
          label: type.replace('_', ' '),
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Memory Explorer"
        description="Persistent operational intelligence: failure fingerprints, human engineering corrections, and cross-incident knowledge retention."
        badge={
          data?.status?.bank_id ? (
            <span className="font-mono text-xs text-[#5B667A] bg-white border border-[#E4E9F0] px-2.5 py-0.5 rounded-full shadow-xs">
              Bank ID: <span className="text-[#111827] font-semibold">{data.status.bank_id}</span>
            </span>
          ) : undefined
        }
      />

      {/* Hindsight Reflect Query Box */}
      <div className="card-enterprise overflow-hidden border-[#DDD6FE] shadow-[0_1px_3px_rgba(109,92,231,0.06)]">
        <div className="p-4 border-b border-[#E4E9F0] bg-gradient-to-r from-[#F3F0FF] via-white to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#F3F0FF] text-[#6D5CE7] border border-[#DDD6FE]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Hindsight Semantic Reflection</h3>
              <p className="text-[11px] text-[#5B667A]">Query organizational memory across all past incident resolutions</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-medium text-[#6D5CE7] bg-[#F3F0FF] border border-[#DDD6FE] px-2 py-0.5 rounded-full">
            Vector Store Active
          </span>
        </div>

        <div className="p-4 bg-white">
          <form onSubmit={handleReflect} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={reflectQuery}
              onChange={(e) => setReflectQuery(e.target.value)}
              placeholder="Ask an operational question (e.g. what caused the payment pool outage?)..."
              className="input-enterprise flex-1 text-xs sm:text-sm"
            />
            <button
              type="submit"
              disabled={reflecting}
              className="btn-primary text-xs sm:text-sm bg-[#6D5CE7] hover:bg-[#5B4BC4] shadow-[0_1px_2px_rgba(109,92,231,0.2)] disabled:opacity-50"
            >
              <Brain className="w-4 h-4" />
              <span>{reflecting ? 'Reflecting...' : 'Reflect Memory'}</span>
            </button>
          </form>

          {reflectionResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#F8FAFC] border border-[#E4E9F0] text-xs sm:text-sm text-[#111827] leading-relaxed shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-[#6D5CE7] font-semibold text-xs">
                <Brain className="w-4 h-4" />
                <span>Synthesized Organizational Insight</span>
              </div>
              <p className="whitespace-pre-wrap">{reflectionResult}</p>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card-enterprise p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#7A8699] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by failure fingerprint (e.g., PAYMENT_API_DB_POOL)..."
            className="input-enterprise w-full pl-9 pr-3 text-xs sm:text-sm"
          />
        </div>

        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="input-enterprise text-xs sm:text-sm cursor-pointer"
        >
          <option value="">All Services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="input-enterprise text-xs sm:text-sm cursor-pointer"
        >
          <option value="">All Memory Types</option>
          {memoryTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Memory Cards Grid / List */}
      <div className="card-enterprise overflow-hidden divide-y divide-[#E4E9F0]">
        {data?.memories?.map((mem: any) => {
          const typeBadge = getMemoryTypeBadge(mem.memory_type);
          const TypeIcon = typeBadge.icon;
          return (
            <div key={mem.id} className="p-5 hover:bg-[#F8FAFC] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-[#5B667A] bg-[#F1F4F9] px-2 py-0.5 rounded border border-[#E4E9F0]">
                    {mem.id}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${typeBadge.bg}`}>
                    <TypeIcon className="w-3.5 h-3.5" />
                    <span>{typeBadge.label}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#7A8699]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{mem.created_at || '2026-09-28'}</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#111827] leading-relaxed mb-4 font-normal">
                {mem.contents}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F4F9]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#7A8699]" />
                  {mem.tags?.map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F8FAFC] text-[#5B667A] border border-[#E4E9F0]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {mem.metadata?.failure_fingerprint && (
                  <span className="text-xs font-mono font-medium text-[#6D5CE7] bg-[#F3F0FF] border border-[#DDD6FE] px-2.5 py-1 rounded-md">
                    FP: {mem.metadata.failure_fingerprint}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {(!data?.memories || data.memories.length === 0) && !loading && (
          <div className="p-12 text-center text-[#5B667A] text-sm">
            <Brain className="w-8 h-8 text-[#7A8699] mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-[#111827]">No memories matched your filters</p>
            <p className="text-xs text-[#7A8699] mt-0.5">Try changing the service, memory type, or search query.</p>
          </div>
        )}

        {loading && (
          <div className="p-12 text-center text-[#5B667A] text-sm">
            Loading organizational memory bank...
          </div>
        )}
      </div>
    </div>
  );
};
