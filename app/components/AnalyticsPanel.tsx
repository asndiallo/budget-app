'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORIES, CHART_CAT_COLORS } from '@/lib/config';
import { useEffect, useState } from 'react';

const fmt = (v: number) => '$' + Math.round(v).toLocaleString();

interface MonthData {
  month: string;
  label: string;
  totalIncome: number;
  tsp: number;
  roth: number;
  spending: number;
  net: number;
  categories: Record<string, number>;
}

export default function AnalyticsPanel({ month }: { month: string }) {
  const [data, setData] = useState<MonthData[]>([]);

  useEffect(() => {
    if (!month) return;
    fetch(`/api/analytics?month=${month}&count=6`)
      .then((r) => r.json())
      .then(setData);
  }, [month]);

  if (data.length === 0)
    return <p className="text-sm text-text-3 py-10 text-center">Loading…</p>;

  const current = data[data.length - 1];

  const donutData = Object.entries(current.categories)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  const barData = data.map((d) => ({ label: d.label, ...d.categories }));

  const areaData = data.map((d) => ({
    label: d.label,
    Income: d.totalIncome,
    Spending: d.spending,
    Net: d.net,
  }));

  const activeCats = CATEGORIES.filter((c) =>
    data.some((d) => (d.categories[c] ?? 0) > 0),
  );

  return (
    <div className="space-y-8">
      {/* Row 1: Donut + Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut — current month spending */}
        <div>
          <SectionTitle>{current.label} — by category</SectionTitle>
          {donutData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_CAT_COLORS[entry.name] ?? '#3d4560'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmt(v as number)}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Area — income vs spending vs net */}
        <div>
          <SectionTitle>Income · Spending · Net (6 mo)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={areaData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d98a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d98a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSpending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4560" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ff4560" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a8cff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4a8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                formatter={(v) => fmt(v as number)}
                contentStyle={tooltipStyle}
              />
              <Legend
                formatter={(v) => (
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {v}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="Income"
                stroke="#00d98a"
                strokeWidth={2}
                fill="url(#gIncome)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="Spending"
                stroke="#ff4560"
                strokeWidth={2}
                fill="url(#gSpending)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="Net"
                stroke="#4a8cff"
                strokeWidth={2}
                fill="url(#gNet)"
                dot={false}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Stacked category bar */}
      <div>
        <SectionTitle>Spending by category — 6 months</SectionTitle>
        {activeCats.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-dim)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => '$' + Math.round(v).toLocaleString()}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(v, name) => [fmt(v as number), name as string]}
                contentStyle={tooltipStyle}
              />
              <Legend
                formatter={(v) => (
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {v}
                  </span>
                )}
              />
              {activeCats.map((cat) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="a"
                  fill={CHART_CAT_COLORS[cat] ?? '#3d4560'}
                  radius={
                    activeCats.indexOf(cat) === activeCats.length - 1
                      ? [3, 3, 0, 0]
                      : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
      {children}
    </h3>
  );
}

function Empty() {
  return (
    <p className="text-sm text-text-3 py-10 text-center">
      No data yet for this period.
    </p>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
};

const axisStyle = { fontSize: 11, fill: 'var(--text-3)' };
