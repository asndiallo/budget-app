'use client';

import { LABEL_CLS } from '@/lib/config';

// Accent palette — single source of truth for MetricCard colours.
const ACCENT: Record<string, { text: string; line: string; bg: string }> = {
  green: {
    text: 'text-[#00d98a]',
    line: '#00d98a',
    bg: 'rgba(0, 217, 138, 0.04)',
  },
  red: {
    text: 'text-[#ff4560]',
    line: '#ff4560',
    bg: 'rgba(255, 69, 96, 0.04)',
  },
  amber: {
    text: 'text-[#f5aa2a]',
    line: '#f5aa2a',
    bg: 'rgba(245, 170, 42, 0.04)',
  },
  blue: {
    text: 'text-[#4a8cff]',
    line: '#4a8cff',
    bg: 'rgba(74, 140, 255, 0.04)',
  },
  default: { text: 'text-text', line: 'transparent', bg: 'transparent' },
};

export default function MetricCard({
  label,
  value,
  sub,
  accent = 'default',
  delta: d,
}: {
  label: string;
  value: string;
  sub?: string | null;
  accent?: string;
  delta?: { text: string; good: boolean | null } | null;
}) {
  const {
    text: textClass,
    line: color,
    bg: bgHint,
  } = ACCENT[accent] ?? ACCENT.default;

  const deltaClass =
    d?.good === true
      ? 'text-[#00d98a]'
      : d?.good === false
        ? 'text-[#ff4560]'
        : 'text-text-4';

  return (
    <div
      className="bg-surface rounded-xl border border-border p-4 relative overflow-hidden flex flex-col"
      style={{
        backgroundColor:
          bgHint !== 'transparent'
            ? `color-mix(in srgb, var(--surface) 95%, ${color} 5%)`
            : undefined,
      }}
    >
      {accent !== 'default' && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, ${color}cc, ${color}33 60%, transparent)`,
          }}
        />
      )}
      <p className={`${LABEL_CLS} mb-1.5`}>
        {label}
      </p>
      <p
        className={`text-[22px] font-mono font-semibold leading-none ${textClass}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] font-mono text-text-4 mt-1.5">{sub}</p>}
      {d && (
        <p className={`text-[10px] font-mono mt-1.5 ${deltaClass}`}>
          {d.text} vs last mo
        </p>
      )}
    </div>
  );
}
