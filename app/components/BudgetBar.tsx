'use client';

import { LABEL_CLS } from '@/lib/config';
import type { Summary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function BudgetBar({ summary }: { summary: Summary }) {
  const { totalIncome, tsp, investmentFixed, committed, spending, net } =
    summary;
  if (totalIncome === 0) return null;

  const pct = (n: number) =>
    Math.max(0, Math.min(100, (n / totalIncome) * 100));

  const invested = tsp + investmentFixed;
  const segments = [
    {
      label: 'Invested',
      value: invested,
      pct: pct(invested),
      color: '#4a8cff',
    },
    {
      label: 'Committed',
      value: committed,
      pct: pct(committed),
      color: '#f5aa2a',
    },
    {
      label: 'Spending',
      value: spending,
      pct: pct(spending),
      color: '#ff4560',
    },
    {
      label: 'Net',
      value: Math.max(0, net),
      pct: pct(Math.max(0, net)),
      color: '#00d98a',
    },
  ];

  return (
    <div className="bg-surface rounded-xl border border-border px-4 py-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <p className={LABEL_CLS}>Allocation</p>
        <p className="text-[10px] font-mono text-text-4">
          {formatCurrency(totalIncome)} total
        </p>
      </div>
      <div className="h-2 bg-bg rounded-full flex gap-0.5 overflow-hidden">
        {segments.map(({ label, pct: p, color, value }) => (
          <div
            key={label}
            style={{ width: `${p}%`, backgroundColor: color }}
            className="rounded-full transition-all duration-500"
            title={`${label}: ${formatCurrency(value)} (${Math.round(p)}%)`}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-2.5 flex-wrap">
        {segments.map(({ label, pct: p, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-text-3">
              {label}{' '}
              <span style={{ color }} className="font-mono font-medium">
                {Math.round(p)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
