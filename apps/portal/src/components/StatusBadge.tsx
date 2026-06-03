import React from 'react';
import { Clock, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfigs: Record<string, {
  bg: string;
  text: string;
  dot: string;
  icon: React.ElementType;
  label: string;
}> = {
  PENDING: {
    bg: 'rgba(148, 163, 184, 0.1)',
    text: '#94a3b8',
    dot: '#94a3b8',
    icon: Clock,
    label: 'Pending',
  },
  ANALYZING: {
    bg: 'rgba(96, 165, 250, 0.1)',
    text: '#93c5fd',
    dot: '#60a5fa',
    icon: Loader2,
    label: 'Analyzing',
  },
  GENERATING_TESTS: {
    bg: 'rgba(129, 140, 248, 0.1)',
    text: '#a5b4fc',
    dot: '#818cf8',
    icon: Loader2,
    label: 'Generating Tests',
  },
  EXECUTING_SANDBOX: {
    bg: 'rgba(167, 139, 250, 0.1)',
    text: '#c4b5fd',
    dot: '#a78bfa',
    icon: Loader2,
    label: 'Running Sandbox',
  },
  COMPLETED: {
    bg: 'rgba(52, 211, 153, 0.1)',
    text: '#6ee7b7',
    dot: '#34d399',
    icon: CheckCircle,
    label: 'Completed',
  },
  FAILED: {
    bg: 'rgba(248, 113, 113, 0.1)',
    text: '#fca5a5',
    dot: '#f87171',
    icon: XCircle,
    label: 'Failed',
  },
  HEALED: {
    bg: 'rgba(129, 140, 248, 0.1)',
    text: '#a5b4fc',
    dot: '#818cf8',
    icon: Sparkles,
    label: 'Self-Healed',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = statusConfigs[status] || statusConfigs.PENDING;
  const Icon = config.icon;
  const isAnimating = status.includes('ING');

  const sizeStyles = size === 'md'
    ? { padding: '6px 14px', fontSize: '13px', gap: '6px' }
    : { padding: '4px 10px', fontSize: '11px', gap: '5px' };

  return (
    <span
      className="inline-flex items-center rounded-full font-semibold w-fit"
      style={{
        background: config.bg,
        color: config.text,
        ...sizeStyles,
      }}
    >
      <Icon
        size={size === 'md' ? 15 : 13}
        className={isAnimating ? 'animate-spin' : ''}
      />
      <span style={{ marginLeft: sizeStyles.gap }}>{config.label}</span>
    </span>
  );
};

/** Minimal colored dot for table rows */
export const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const config = statusConfigs[status] || statusConfigs.PENDING;
  const isAnimating = status.includes('ING');

  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        background: config.dot,
        boxShadow: isAnimating ? `0 0 8px ${config.dot}` : 'none',
      }}
    />
  );
};
