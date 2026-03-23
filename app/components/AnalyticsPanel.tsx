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

export default function AnalyticsPanel({
  month,
  onCategoryClick,
}: {
  month: string;
  onCategoryClick?: (category: string) => void;
}) {
  const [data, setData] = useState<MonthData[]>([]);

  useEffect(() => {
    if (!month) return;
    fetch(`/api/analytics?month=${month}&count=6`)
      .then((r) => r.json())
      .then(setData);
  }, [month]);

  if (data.length === 0)
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-text-3">Loading analytics…</p>
      </div>
    );

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

  const totalSpending = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5">
      {/* Row 1: Donut + Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Donut — current month spending */}
        <ChartCard
          title={`${current.label} · by category`}
          subtitle={donutData.length > 0 ? `${fmt(totalSpending)} total` : undefined}
        >
          {donutData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(entry) =>
                    entry.name && onCategoryClick?.(entry.name)
                  }
                  style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
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
        </ChartCard>

        {/* Area — income vs spending vs net */}
        <ChartCard
          title="Income · Spending · Net"
          subtitle="6-month trend"
        >
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
        </ChartCard>
      </div>

      {/* Row 2: Stacked category bar */}
      <ChartCard
        title="Spending by category"
        subtitle="6-month breakdown"
      >
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
                  onClick={() => onCategoryClick?.(cat)}
                  style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="bg-bg rounded-xl border border-border p-4">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-2">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] text-text-4">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
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
