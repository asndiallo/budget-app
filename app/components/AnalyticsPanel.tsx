'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CATEGORIES, CHART_CAT_COLORS } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

interface MonthData {
  month: string;
  label: string;
  totalIncome: number;
  tsp: number;
  spending: number;
  net: number;
  savingsRate: number | null;
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
    void fetch(`/api/analytics?month=${month}&count=12`)
      .then((r) => r.json())
      .then(setData);
  }, [month]);

  if (data.length === 0)
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-text-3 text-sm">Loading analytics…</p>
      </div>
    );

  const current = data[data.length - 1];

  const donutData = Object.entries(current.categories)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  const chartData = data.slice(-6); // last 6 months for bar/area/donut
  const barData = chartData.map((d) => ({ label: d.label, ...d.categories }));

  const areaData = chartData.map((d) => ({
    label: d.label,
    Income: d.totalIncome,
    Spending: d.spending,
    Net: d.net,
  }));

  const savingsRateData = data
    .filter((d) => d.savingsRate !== null)
    .map((d) => ({ label: d.label, 'Savings rate': d.savingsRate }));

  const activeCats = CATEGORIES.filter((c) => chartData.some((d) => (d.categories[c] ?? 0) > 0));

  const totalSpending = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5">
      {/* Row 1: Donut + Area */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Donut — current month spending */}
        <ChartCard
          title={`${current.label} · by category`}
          subtitle={donutData.length > 0 ? `${formatCurrency(totalSpending)} total` : undefined}
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
                  onClick={(entry) => entry.name && onCategoryClick?.(entry.name)}
                  style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={CHART_CAT_COLORS[entry.name] ?? '#3d4560'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatCurrency(v as number)}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Area — income vs spending vs net */}
        <ChartCard title="Income · Spending · Net" subtitle="6-month trend">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={areaData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={tooltipStyle} />
              <Legend
                formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v}</span>}
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
      <ChartCard title="Spending by category" subtitle="6-month breakdown">
        {activeCats.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => '$' + Math.round(v).toLocaleString()}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(v, name) => [formatCurrency(v as number), name as string]}
                contentStyle={tooltipStyle}
              />
              <Legend
                formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v}</span>}
              />
              {activeCats.map((cat) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="a"
                  fill={CHART_CAT_COLORS[cat] ?? '#3d4560'}
                  radius={
                    activeCats.indexOf(cat) === activeCats.length - 1 ? [3, 3, 0, 0] : undefined
                  }
                  onClick={() => onCategoryClick?.(cat)}
                  style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 3: Savings rate over time */}
      {savingsRateData.length > 1 && (
        <ChartCard
          title="Savings rate"
          subtitle={`${savingsRateData.length}-month history · target 20%`}
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={savingsRateData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={[0, 'auto']}
              />
              <Tooltip formatter={(v) => [`${String(v)}%`, 'Savings rate']} contentStyle={tooltipStyle} />
              <ReferenceLine
                y={20}
                stroke="#00d98a"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: '20% target',
                  fill: '#00d98a',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Line
                type="monotone"
                dataKey="Savings rate"
                stroke="#4a8cff"
                strokeWidth={2}
                dot={{ r: 3, fill: '#4a8cff' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
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
    <div className="bg-bg border-border rounded-xl border p-4">
      <div className="mb-4 flex items-baseline gap-2">
        <h3 className="text-text-2 text-[11px] font-semibold tracking-widest uppercase">{title}</h3>
        {subtitle && <span className="text-text-4 text-[10px]">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-text-3 py-10 text-center text-sm">No data yet for this period.</p>;
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
