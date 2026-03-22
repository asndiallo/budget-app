'use client';

import { useEffect, useState } from 'react';

import type { YtdSummary } from '@/lib/types';
import { api } from '@/lib/api';

const fmt = (n: number) => '$' + Math.abs(Math.round(n)).toLocaleString();

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
      value: fmt(ytd.totalIncome),
      color: 'text-[#dce4f8]',
      accent: 'transparent',
    },
    {
      label: 'Invested',
      value: fmt(ytd.totalInvested),
      color: 'text-[#4a8cff]',
      accent: '#4a8cff',
    },
    {
      label: 'Spent',
      value: fmt(ytd.totalSpending),
      color: 'text-[#ff4560]',
      accent: '#ff4560',
    },
    {
      label: 'Net saved',
      value: (ytd.netSaved < 0 ? '-' : '') + fmt(ytd.netSaved),
      color: ytd.netSaved >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]',
      accent: ytd.netSaved >= 0 ? '#00d98a' : '#ff4560',
    },
  ];

  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4] mb-3">
        {ytd.year} · year to date · {ytd.monthsRecorded}{' '}
        {ytd.monthsRecorded === 1 ? 'month' : 'months'} recorded
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {cards.map(({ label, value, color, accent }) => (
          <div
            key={label}
            className="bg-[#06080f] rounded-xl border border-[#1f2d46] p-3.5 relative overflow-hidden"
          >
            {accent !== 'transparent' && (
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: `linear-gradient(90deg, ${accent}55, transparent 70%)`,
                }}
              />
            )}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4] mb-1.5">
              {label}
            </p>
            <p className={`font-mono text-base font-semibold ${color}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
