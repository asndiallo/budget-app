'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';

import type { YearOverview } from '@/lib/types';
import { api } from '@/lib/api';

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const Q_RANGES = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'];

const fmt = (n: number) => '$' + Math.abs(Math.round(n)).toLocaleString();
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  return abs >= 1000
    ? '$' + (abs / 1000).toFixed(1) + 'k'
    : '$' + Math.round(abs);
};

function getYearRange() {
  const y = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => y - 2 + i);
}

export default function OverviewPanel({
  initialYear,
}: {
  initialYear: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<YearOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const yearRange = getYearRange();

  useEffect(() => {
    setLoading(true);
    api.overview.get(year).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [year]);

  const chartData = data?.monthly.map((m, i) => ({
    name: MONTH_ABBR[i],
    // Projected months show income only (spending = 0 = future)
    income: m.hasData || m.projected ? m.income : null,
    spending: m.hasData && !m.projected ? m.spending : null,
    invested: (m.hasData || m.projected) && !m.preService ? m.invested : null,
    rate:
      (m.hasData || m.projected) && m.income > 0 ? m.savingsRate : null,
    projected: m.projected,
  }));

  const maxCat = data?.categories[0]?.total ?? 1;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-1.5">
        {yearRange.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              y === year
                ? 'bg-surface-raised border-border text-text font-medium'
                : 'border-transparent text-text-4 hover:text-text-3'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-text-3 py-8 text-center">Loading…</p>
      )}

      {!loading && data && data.annual.monthsWithData === 0 && (
        <p className="text-sm text-text-3 py-8">No data recorded for {year}.</p>
      )}

      {!loading && data && data.annual.monthsWithData > 0 && (
        <>
          {/* Annual summary */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
              {year} · {data.annual.monthsWithData}{' '}
              {data.annual.monthsWithData === 1 ? 'month' : 'months'} recorded
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {(
                [
                  {
                    label: 'Earned',
                    value: fmt(data.annual.income),
                    color: 'text-text',
                    accent: null,
                  },
                  {
                    label: 'Invested',
                    value: fmt(data.annual.invested),
                    color: 'text-[#4a8cff]',
                    accent: '#4a8cff',
                  },
                  {
                    label: 'Spent',
                    value: fmt(data.annual.spending),
                    color: 'text-[#ff4560]',
                    accent: '#ff4560',
                  },
                  {
                    label: 'Net Saved',
                    value:
                      (data.annual.net < 0 ? '−' : '') + fmt(data.annual.net),
                    color:
                      data.annual.net >= 0
                        ? 'text-[#00d98a]'
                        : 'text-[#ff4560]',
                    accent: data.annual.net >= 0 ? '#00d98a' : '#ff4560',
                  },
                  {
                    label: 'Savings Rate',
                    value: `${data.annual.savingsRate}%`,
                    color: 'text-[#f5a623]',
                    accent: '#f5a623',
                  },
                ] as {
                  label: string;
                  value: string;
                  color: string;
                  accent: string | null;
                }[]
              ).map(({ label, value, color, accent }) => (
                <div
                  key={label}
                  className="bg-bg rounded-xl border border-border p-3.5 relative overflow-hidden"
                >
                  {accent && (
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5"
                      style={{
                        background: `linear-gradient(90deg, ${accent}cc, ${accent}22 60%, transparent)`,
                      }}
                    />
                  )}
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-1.5">
                    {label}
                  </p>
                  <p className={`font-mono text-base font-semibold ${color}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly chart */}
          <div className="bg-bg rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-4">
              Monthly Breakdown
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} barGap={1} barCategoryGap="28%">
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border-dim)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--color-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: 'var(--color-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtK}
                  width={46}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: 'var(--color-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={36}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--color-text-2)', fontWeight: 600 }}
                  formatter={(value, name) => {
                    const n = Number(value);
                    const k = String(name ?? '');
                    if (k === 'rate') return [`${n}%`, 'Savings Rate'];
                    return [fmt(n), k.charAt(0).toUpperCase() + k.slice(1)];
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="income"
                  fill="#4a8cff"
                  opacity={0.2}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="spending"
                  fill="#ff4560"
                  opacity={0.65}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="invested"
                  fill="#00d98a"
                  opacity={0.65}
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rate"
                  stroke="#f5a623"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3">
              {[
                { bg: '#4a8cff33', label: 'Income', isBar: true },
                { bg: '#ff4560a6', label: 'Spending', isBar: true },
                { bg: '#00d98aa6', label: 'Invested', isBar: true },
                { bg: '#f5a623', label: 'Savings Rate', isBar: false },
              ].map(({ bg, label, isBar }) => (
                <div key={label} className="flex items-center gap-1.5">
                  {isBar ? (
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: bg }}
                    />
                  ) : (
                    <div
                      className="w-5 h-px rounded-full"
                      style={{ background: bg }}
                    />
                  )}
                  <span className="text-[10px] text-text-4">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quarterly breakdown */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
              Quarterly
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {data.quarters.map((q) => {
                const qMonthly = data.monthly.slice((q.q - 1) * 3, q.q * 3);
                const allProjected = qMonthly.every((m) => m.projected);
                const someProjected = qMonthly.some((m) => m.projected);
                return (
                <div
                  key={q.q}
                  className={`bg-bg rounded-xl border p-4 transition-opacity ${
                    allProjected
                      ? 'border-dashed border-border opacity-60'
                      : !q.hasData
                        ? 'border-border opacity-40'
                        : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-text">
                      Q{q.q}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {someProjected && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#f5a623]/10 text-[#f5a623]">
                          {allProjected ? 'Projected' : 'Partial'}
                        </span>
                      )}
                      <span className="text-[10px] text-text-4">
                        {Q_RANGES[q.q - 1]}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(
                      [
                        {
                          label: 'Earned',
                          val: fmt(q.income),
                          color: 'text-text',
                        },
                        {
                          label: 'Invested',
                          val: fmt(q.invested),
                          color: 'text-[#4a8cff]',
                        },
                        {
                          label: 'Spent',
                          val: fmt(q.spending),
                          color: 'text-[#ff4560]',
                        },
                        {
                          label: 'Net',
                          val: (q.net < 0 ? '−' : '') + fmt(q.net),
                          color:
                            q.net >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]',
                        },
                      ] as { label: string; val: string; color: string }[]
                    ).map(({ label, val, color }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[10px] text-text-4">{label}</span>
                        <span
                          className={`text-xs font-mono font-medium ${color}`}
                        >
                          {q.hasData ? val : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {q.hasData && q.income > 0 && (
                    <div className="mt-3">
                      {/* Stacked bar: spending (red) + invested (blue) out of income */}
                      <div className="h-1.5 rounded-full bg-surface overflow-hidden flex">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, (q.spending / q.income) * 100)}%`,
                            background: '#ff4560',
                            opacity: 0.6,
                          }}
                        />
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100 - (q.spending / q.income) * 100, (q.invested / q.income) * 100)}%`,
                            background: '#4a8cff',
                            opacity: 0.6,
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-text-4 mt-1">
                        {Math.round((q.spending / q.income) * 100)}% spent ·{' '}
                        {q.savingsRate}% saved
                      </p>
                    </div>
                  )}
                </div>
              );})}
            </div>
          </div>

          {/* Top categories */}
          {data.categories.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
                Spending by Category
              </p>
              <div className="bg-bg rounded-xl border border-border p-4 space-y-3.5">
                {data.categories.slice(0, 10).map(({ category, total }) => (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-text">{category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-4">
                          {Math.round((total / data.annual.spending) * 100)}%
                        </span>
                        <span className="text-xs font-mono text-text-2 w-20 text-right">
                          {fmt(total)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(total / maxCat) * 100}%`,
                          background: '#ff4560',
                          opacity: 0.55,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
