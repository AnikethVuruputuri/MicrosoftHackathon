export const APP_NAME = 'OpsMemory';

export const NAV_ITEMS = [
  { label: 'Overview', path: '/overview', icon: 'LayoutDashboard' },
  { label: 'Repositories', path: '/repositories', icon: 'GitBranch' },
  { label: 'Pipelines', path: '/pipelines', icon: 'Workflow' },
  { label: 'Deployments', path: '/deployments', icon: 'Rocket' },
  { label: 'Incidents', path: '/incidents', icon: 'AlertTriangle' },
  { label: 'Automation', path: '/automation', icon: 'ShieldCheck' },
  { label: 'Memory', path: '/memory', icon: 'Brain' },
] as const;

export const NAV_SECONDARY = [
  { label: 'Integrations', path: '/integrations', icon: 'Plug' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  success: { bg: 'bg-[#ECFDF3]', text: 'text-[#16A36A]', dot: 'bg-[#16A36A]', border: 'border-[#A6F4C5]' },
  resolved: { bg: 'bg-[#ECFDF3]', text: 'text-[#16A36A]', dot: 'bg-[#16A36A]', border: 'border-[#A6F4C5]' },
  healthy: { bg: 'bg-[#ECFDF3]', text: 'text-[#16A36A]', dot: 'bg-[#16A36A]', border: 'border-[#A6F4C5]' },
  connected: { bg: 'bg-[#ECFDF3]', text: 'text-[#16A36A]', dot: 'bg-[#16A36A]', border: 'border-[#A6F4C5]' },
  failure: { bg: 'bg-[#FFF1F2]', text: 'text-[#D92D3A]', dot: 'bg-[#D92D3A]', border: 'border-[#FECDD3]' },
  failed: { bg: 'bg-[#FFF1F2]', text: 'text-[#D92D3A]', dot: 'bg-[#D92D3A]', border: 'border-[#FECDD3]' },
  critical: { bg: 'bg-[#FFEBEE]', text: 'text-[#C62828]', dot: 'bg-[#C62828]', border: 'border-[#FFCDD2]' },
  investigating: { bg: 'bg-[#FFF1F2]', text: 'text-[#D92D3A]', dot: 'bg-[#D92D3A]', border: 'border-[#FECDD3]' },
  warning: { bg: 'bg-[#FFF8E6]', text: 'text-[#D99100]', dot: 'bg-[#D99100]', border: 'border-[#FDE68A]' },
  elevated: { bg: 'bg-[#FFF8E6]', text: 'text-[#D99100]', dot: 'bg-[#D99100]', border: 'border-[#FDE68A]' },
  awaiting_approval: { bg: 'bg-[#FFF8E6]', text: 'text-[#D99100]', dot: 'bg-[#D99100]', border: 'border-[#FDE68A]' },
  guarded: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#2563EB]', border: 'border-[#BFDBFE]' },
  running: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#2563EB] animate-pulse', border: 'border-[#BFDBFE]' },
  in_progress: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#2563EB] animate-pulse', border: 'border-[#BFDBFE]' },
  pending: { bg: 'bg-[#F1F4F9]', text: 'text-[#5B667A]', dot: 'bg-[#7A8699]', border: 'border-[#E4E9F0]' },
  closed: { bg: 'bg-[#F1F4F9]', text: 'text-[#5B667A]', dot: 'bg-[#7A8699]', border: 'border-[#E4E9F0]' },
  learning: { bg: 'bg-[#F3F0FF]', text: 'text-[#6D5CE7]', dot: 'bg-[#6D5CE7]', border: 'border-[#DDD6FE]' },
  memory: { bg: 'bg-[#F3F0FF]', text: 'text-[#6D5CE7]', dot: 'bg-[#6D5CE7]', border: 'border-[#DDD6FE]' },
  info: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#2563EB]', border: 'border-[#BFDBFE]' },
};

export type StatusType = string;

export const SEVERITY_COLORS = {
  critical: { bg: 'bg-[#FFEBEE]', text: 'text-[#C62828]', border: 'border-[#FFCDD2]' },
  high: { bg: 'bg-[#FFF1F2]', text: 'text-[#D92D3A]', border: 'border-[#FECDD3]' },
  medium: { bg: 'bg-[#FFF8E6]', text: 'text-[#D99100]', border: 'border-[#FDE68A]' },
  low: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
} as const;

export const RISK_LEVELS = {
  low: { color: 'text-[#16A36A]', bg: 'bg-[#ECFDF3]', border: 'border-[#A6F4C5]', label: 'Low Risk' },
  medium: { color: 'text-[#D99100]', bg: 'bg-[#FFF8E6]', border: 'border-[#FDE68A]', label: 'Medium Risk' },
  high: { color: 'text-[#D92D3A]', bg: 'bg-[#FFF1F2]', border: 'border-[#FECDD3]', label: 'High Risk' },
  critical: { color: 'text-[#C62828]', bg: 'bg-[#FFEBEE]', border: 'border-[#FFCDD2]', label: 'Critical Risk' },
} as const;
