'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { LABEL_CLS } from '@/lib/config';
import type { YtdSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function YtdPanel({ month }: { month: string }) {
  const [ytd, setYtd] = useState<YtdSummary | null>(null);

  useEffect(() => {
    if (!month) return;
    api.ytd.get(month).then(setYtd);
  }, [month]);

  if (!ytd || ytd.monthsRecorded === 0) return null;

  const cards = [
    {
      label: 'Earned',
      value: formatCurrency(ytd.totalIncome),
      color: 'text-text',
      accent: 'transparent',
    },
    {
      label: 'Invested',
      value: formatCurrency(ytd.totalInvested),
      color: 'text-[#4a8cff]',
      accent: '#4a8cff',
    },
    {
      label: 'Spent',
      value: formatCurrency(ytd.totalSpending),
      color: 'text-[#ff4560]',
      accent: '#ff4560',
    },
    {
      label: 'Net saved',
      value: (ytd.netSaved < 0 ? '-' : '') + formatCurrency(ytd.netSaved),
      color: ytd.netSaved >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]',
      accent: ytd.netSaved >= 0 ? '#00d98a' : '#ff4560',
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-text-2 text-[11px] font-semibold tracking-widest uppercase">
          {ytd.year} · Year to date
        </h3>
        <span className="text-text-4 text-[10px]">
          {ytd.monthsRecorded} {ytd.monthsRecorded === 1 ? 'month' : 'months'} recorded
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cards.map(({ label, value, color, accent }) => (
          <div
            key={label}
            className="bg-bg border-border relative overflow-hidden rounded-xl border p-3.5"
          >
            {accent !== 'transparent' && (
              <div
                className="absolute top-0 right-0 left-0 h-0.5"
                style={{
                  background: `linear-gradient(90deg, ${accent}cc, ${accent}22 60%, transparent)`,
                }}
              />
            )}
            <p className={`${LABEL_CLS} mb-1.5`}>{label}</p>
            <p className={`font-mono text-base font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
