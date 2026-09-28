import React from 'react';
import { Brain } from 'lucide-react';
import { cn } from '../lib/utils';

interface TimelineStep {
  title: string;
  subtitle: string;
  status: 'completed' | 'active' | 'pending';
}

interface Props {
  incidentCode: string;
  serviceName: string;
  initialDiagnosis?: string;
  engineerCorrection?: string;
  rootCause?: string;
  remediation?: string;
  retainedInHindsight?: boolean;
}

export const LearningTimeline: React.FC<Props> = ({
  incidentCode,
  serviceName,
  initialDiagnosis,
  engineerCorrection,
  rootCause,
  remediation,
  retainedInHindsight
}) => {
  const steps: TimelineStep[] = [
    {
      title: `Incident Triggered (${incidentCode})`,
      subtitle: `Deployment failure on ${serviceName}`,
      status: 'completed',
    },
    {
      title: 'Agent Initial Diagnosis',
      subtitle: initialDiagnosis || 'Agent analyzed error logs and generated initial hypothesis.',
      status: initialDiagnosis ? 'completed' : 'pending',
    },
    {
      title: 'Engineer Correction',
      subtitle: engineerCorrection || 'Engineer review pending.',
      status: engineerCorrection ? 'completed' : 'pending',
    },
    {
      title: 'Confirmed Root Cause',
      subtitle: rootCause || 'Root cause verification pending.',
      status: rootCause ? 'completed' : 'pending',
    },
    {
      title: 'Remediation Applied',
      subtitle: remediation || 'Awaiting remediation.',
      status: remediation ? 'completed' : 'pending',
    },
    {
      title: 'Memory Retained',
      subtitle: retainedInHindsight
        ? 'Stored in organizational memory for future recall.'
        : 'Pending verification before retention.',
      status: retainedInHindsight ? 'completed' : 'pending',
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
        <Brain className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
          Learning Timeline
        </h3>
      </div>

      <div className="relative pl-6 space-y-4">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gray-200" />

        {steps.map((step, idx) => (
          <div key={idx} className="relative">
            {/* Dot */}
            <div
              className={cn(
                'absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center',
                step.status === 'completed'
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-white border-gray-300'
              )}
            >
              {step.status === 'completed' && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <div className="ml-2">
              <h4 className="text-xs font-medium text-gray-900">{step.title}</h4>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
