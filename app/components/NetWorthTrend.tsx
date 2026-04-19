'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '@/lib/api';
import { LABEL_CLS } from '@/lib/config';
import type { NetWorthSnapshot } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
  return `$${Math.round(abs)}`;
};

function fmtDate(iso: string) {
  // iso = YYYY-MM-DD
  const [, m, d] = iso.split('-');
  const months = [
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
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
}

type ChartPoint = {
  date: string;
  label: string;
  assets: number;
  liabilities: number;
  netWorth: number;
};

function buildChartData(snapshots: NetWorthSnapshot[]): ChartPoint[] {
  return snapshots.map((s) => ({
    date: s.recorded_at,
    label: fmtDate(s.recorded_at),
    assets: s.assets,
    liabilities: s.liabilities,
    netWorth: s.net_worth,
  }));
}

export default function NetWorthTrend({ onUpdate }: { onUpdate?: number }) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    api.netWorthHistory
      .list()
      .then((snaps) => setData(buildChartData(snaps)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [onUpdate]);

  if (loading) return null;

  if (data.length < 2) {
    return (
      <p className="text-text-4 py-3 text-center text-xs">
        Update balances over time to build a net worth trend.
      </p>
    );
  }

  const latest = data[data.length - 1];
  const earliest = data[0];
  const change = latest.netWorth - earliest.netWorth;
  const positive = change >= 0;

  // Y-axis domain: give 10% padding above max and below min
  const allValues = data.flatMap((d) => [d.assets, d.netWorth]);
  const yMax = Math.max(...allValues);
  const yMin = Math.min(...allValues, 0);
  const pad = (yMax - yMin) * 0.12;

  return (
    <div className="bg-surface border-border relative overflow-hidden rounded-xl border p-4">
      <div
        className="absolute top-0 right-0 left-0 h-0.5"
        style={{
          background: positive
            ? 'linear-gradient(90deg, #00d98acc, #00d98a22 60%, transparent)'
            : 'linear-gradient(90deg, #ff4560cc, #ff456022 60%, transparent)',
        }}
      />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className={`${LABEL_CLS} mb-1`}>Net Worth Trend</p>
          <p
            className={`font-mono text-xl leading-none font-semibold ${
              latest.netWorth >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]'
            }`}
          >
            {latest.netWorth < 0 ? '–' : ''}
            {formatCurrency(Math.abs(latest.netWorth))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-text-4 mb-0.5 text-[10px]">since {fmtDate(earliest.date)}</p>
          <p
            className={`font-mono text-sm font-semibold ${
              positive ? 'text-[#00d98a]' : 'text-[#ff4560]'
            }`}
          >
            {positive ? '+' : '–'}
            {formatCurrency(Math.abs(change))}
          </p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4a8cff" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4a8cff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradNetWorth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d98a" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#00d98a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border-dim)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'var(--color-text-4)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--color-text-4)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtK}
            width={44}
            domain={[yMin - pad, yMax + pad]}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-text-2)', fontWeight: 600, marginBottom: 4 }}
            formatter={(value, name) => {
              const n = Number(value);
              const labels: Record<string, string> = {
                assets: 'Assets',
                liabilities: 'Liabilities',
                netWorth: 'Net Worth',
              };
              return [formatCurrency(n), labels[String(name)] ?? String(name)];
            }}
          />
          <Area
            type="monotone"
            dataKey="assets"
            stroke="#4a8cff"
            strokeWidth={1.5}
            fill="url(#gradAssets)"
            dot={false}
            strokeOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="#00d98a"
            strokeWidth={2}
            fill="url(#gradNetWorth)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend + stats */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {[
            { color: '#4a8cff', label: 'Assets', value: latest.assets },
            { color: '#ff4560', label: 'Liabilities', value: latest.liabilities },
            { color: '#00d98a', label: 'Net Worth', value: latest.netWorth },
          ].map(({ color, label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-px w-5" style={{ background: color }} />
              <span className="text-text-4 text-[10px]">
                {label}{' '}
                <span className="font-mono" style={{ color }}>
                  {formatCurrency(value)}
                </span>
              </span>
            </div>
          ))}
        </div>
        <span className="text-text-4 text-[9px]">{data.length} snapshots</span>
      </div>
    </div>
  );
}
