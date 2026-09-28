import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  beforeAfter: {
    scenario: string;
    fingerprint: string;
    before_learning: {
      ai_initial: string;
      engineer_correction: string;
      retained_to_hindsight: boolean;
    };
    after_learning: {
      ai_recalled: string;
      ai_recommendation: string;
    };
  };
}

export const BeforeAfterCard: React.FC<Props> = ({ beforeAfter }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          How OpsMemory Learns: Before vs. After
        </h3>
        <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
          {beforeAfter.fingerprint}
        </code>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BEFORE */}
        <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-amber-700">
              Without Organizational Memory
            </h4>
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
              Initial Failure
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-white p-2.5 rounded border border-amber-200">
              <span className="text-[10px] font-medium text-gray-500 uppercase block mb-1">Agent Initial Diagnosis:</span>
              <p className="text-gray-700">{beforeAfter.before_learning.ai_initial}</p>
            </div>

            <div className="bg-red-50 p-2.5 rounded border border-red-200">
              <span className="text-[10px] font-medium text-red-600 uppercase block mb-1">SRE Engineer Correction:</span>
              <p className="text-red-700">{beforeAfter.before_learning.engineer_correction}</p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Retained to Hindsight Memory Bank</span>
            </div>
          </div>
        </div>

        {/* AFTER */}
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-emerald-700">
              With Organizational Memory
            </h4>
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
              Subsequent Incidents
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200">
              <span className="text-[10px] font-medium text-emerald-600 uppercase block mb-1">Recalled Historical Memory:</span>
              <p className="text-emerald-800">{beforeAfter.after_learning.ai_recalled}</p>
            </div>

            <div className="bg-white p-2.5 rounded border border-gray-200">
              <span className="text-[10px] font-medium text-gray-500 uppercase block mb-1">Proven Remediation:</span>
              <p className="text-gray-900 font-medium">{beforeAfter.after_learning.ai_recommendation}</p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Agent learned from previous engineer correction</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
