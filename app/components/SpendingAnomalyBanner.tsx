'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { AnomalyResult, SpendingAlert } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const CARD_H = 84; // approximate card height in px
const PEEK = 10; // px of each stacked card visible below the previous

function AlertCard({ alert, animIndex }: { alert: SpendingAlert; animIndex: number }) {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 60 + animIndex * 80);
    return () => clearTimeout(t);
  }, [animIndex]);

  const isAlert = alert.severity === 'alert';
  const color = isAlert ? '#ff4560' : '#f59e0b';
  const avgPct = Math.round((alert.trailingAvg / alert.projectedMonthSpend) * 100);

  return (
    <div
      className="border-border-dim bg-surface rounded-xl border px-4 py-3"
      style={{ borderLeftWidth: 2, borderLeftColor: color + '55' }}
    >
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-text-2 text-xs font-medium">{alert.category}</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          +{alert.pctOverAvg}%
        </span>
      </div>

      <div className="bg-surface-raised relative h-1.5 overflow-hidden rounded-full">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-700 ease-out"
          style={{ width: filled ? `${avgPct}%` : '0%', background: 'var(--color-border)' }}
        />
        <div
          className="absolute top-0 h-full rounded-r-full transition-all duration-700 ease-out"
          style={{
            left: filled ? `${avgPct}%` : '0%',
            width: filled ? `${100 - avgPct}%` : '0%',
            background: color,
            transitionDelay: '80ms',
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-text-4">{formatCurrency(alert.currentMonthSpend)} so far</span>
        <span className="text-text-4">
          avg <span className="text-text-3 font-mono">{formatCurrency(alert.trailingAvg)}</span>
          {' → projected '}
          <span className="font-mono font-medium" style={{ color }}>
            {formatCurrency(alert.projectedMonthSpend)}
          </span>
        </span>
      </div>
    </div>
  );
}

export default function SpendingAnomalyBanner({ month }: { month: string }) {
  const [data, setData] = useState<AnomalyResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!month) return;
    api.anomalies
      .get(month)
      .then(setData)
      .catch(() => {});
  }, [month]);

  if (!data || data.alerts.length === 0) return null;

  const n = data.alerts.length;
  const collapsedH = CARD_H + (n - 1) * PEEK;
  const expandedH = n * CARD_H + (n - 1) * 8;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-text-3 text-xs font-medium tracking-widest uppercase">
          Spending pace · day {data.dayOfMonth} of {data.totalDays}
        </p>
        {n > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-text-4 hover:text-text-2 text-[11px] transition-colors"
          >
            {expanded ? '↑ collapse' : `${n} alerts ↓`}
          </button>
        )}
      </div>

      {/* Stack container */}
      <div
        className="relative overflow-hidden transition-all duration-500 ease-in-out"
        style={{ height: expanded ? expandedH : collapsedH }}
        onClick={() => !expanded && n > 1 && setExpanded(true)}
      >
        {data.alerts.map((alert, i) => (
          <div
            key={alert.category}
            className="absolute right-0 left-0 transition-all duration-500 ease-in-out"
            style={
              expanded
                ? {
                    top: i * (CARD_H + 8),
                    opacity: 1,
                    transform: 'scale(1)',
                    zIndex: n - i,
                  }
                : {
                    top: i * PEEK,
                    opacity: 1 - i * 0.18,
                    transform: `scale(${1 - i * 0.025})`,
                    transformOrigin: 'bottom center',
                    zIndex: n - i,
                  }
            }
          >
            <AlertCard alert={alert} animIndex={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
