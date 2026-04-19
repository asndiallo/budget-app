'use client';

import { LABEL_CLS } from '@/lib/config';
import type { Summary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function BudgetBar({ summary }: { summary: Summary }) {
  const { totalIncome, tsp, investmentFixed, committed, spending, net } = summary;
  if (totalIncome === 0) return null;

  const pct = (n: number) => Math.max(0, Math.min(100, (n / totalIncome) * 100));

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
    <div className="bg-surface border-border rounded-xl border px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className={LABEL_CLS}>Allocation</p>
        <p className="text-text-4 font-mono text-[10px]">{formatCurrency(totalIncome)} total</p>
      </div>
      <div className="bg-bg flex h-2 gap-0.5 overflow-hidden rounded-full">
        {segments.map(({ label, pct: p, color, value }) => (
          <div
            key={label}
            style={{ width: `${p}%`, backgroundColor: color }}
            className="rounded-full transition-all duration-500"
            title={`${label}: ${formatCurrency(value)} (${Math.round(p)}%)`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-4">
        {segments.map(({ label, pct: p, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-text-3 text-[11px]">
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
