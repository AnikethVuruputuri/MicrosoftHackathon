export const APP_NAME = 'OpsMemory';

export const NAV_ITEMS = [
  { label: 'Overview', path: '/overview', icon: 'LayoutDashboard' },
  { label: 'Repositories', path: '/repositories', icon: 'GitBranch' },
  { label: 'Pipelines', path: '/pipelines', icon: 'Workflow' },
  { label: 'Deployments', path: '/deployments', icon: 'Rocket' },
  { label: 'Incidents', path: '/incidents', icon: 'AlertTriangle' },
  { label: 'Memory', path: '/memory', icon: 'Brain' },
] as const;

export const NAV_SECONDARY = [
  { label: 'Integrations', path: '/integrations', icon: 'Plug' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;

export const STATUS_COLORS = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  failure: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  running: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  pending: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', border: 'border-gray-200' },
  info: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', border: 'border-sky-200' },
} as const;

export type StatusType = keyof typeof STATUS_COLORS;

export const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
} as const;

export const RISK_LEVELS = {
  low: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Low Risk' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Medium Risk' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'High Risk' },
  critical: { color: 'text-red-600', bg: 'bg-red-50', label: 'Critical Risk' },
} as const;
