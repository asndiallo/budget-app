'use client';

export default function StreakBanner({ streak }: { streak: number }) {
  const label =
    streak >= 12
      ? 'A full year in the green'
      : streak >= 6
        ? 'Half a year in the green'
        : `${streak} months in the green`;

  const config =
    streak >= 12
      ? {
          color: '#00d98a',
          bg: 'rgba(0,217,138,0.06)',
          border: 'rgba(0,217,138,0.25)',
          icon: '🔥',
        }
      : streak >= 6
        ? {
            color: '#4a8cff',
            bg: 'rgba(74,140,255,0.06)',
            border: 'rgba(74,140,255,0.25)',
            icon: '🔥',
          }
        : {
            color: '#f5aa2a',
            bg: 'rgba(245,170,42,0.06)',
            border: 'rgba(245,170,42,0.25)',
            icon: '⚡',
          };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium"
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: `0 0 20px ${config.color}18`,
      }}
    >
      <span className="text-base leading-none">{config.icon}</span>
      <span style={{ color: config.color }} className="font-semibold">
        {label}
      </span>
      <span className="text-text-3">— positive net every month</span>
      <span
        className="ml-auto font-mono text-xs px-2 py-0.5 rounded-full border"
        style={{ color: config.color, borderColor: config.border }}
      >
        {streak}×
      </span>
    </div>
  );
}
