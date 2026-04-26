'use client';

export default function StreakBanner({
  streak,
  onClick,
}: {
  streak: number;
  onClick?: () => void;
}) {
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
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${label} — click to view savings history` : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-medium ${onClick ? 'interactive-card' : ''}`}
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
        className="ml-auto rounded-full border px-2 py-0.5 font-mono text-xs"
        style={{ color: config.color, borderColor: config.border }}
      >
        {streak}×
      </span>
    </div>
  );
}
