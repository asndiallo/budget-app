'use client';

import { useCallback, useEffect, useState } from 'react';

import GoalsPanel from './components/GoalsPanel';
import IncomePanel from './components/IncomePanel';
import TransactionsPanel from './components/TransactionsPanel';

type Tab = 'income' | 'transactions' | 'goals';

interface Summary {
  totalIncome: number;
  tsp: number;
  roth: number;
  fixedExpenses: number;
  appleCard: number;
  net: number;
}

const MONTHS = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
  '2026-12',
];

const MONTH_LABELS: Record<string, string> = {
  '2026-01': 'Jan 2026',
  '2026-02': 'Feb 2026',
  '2026-03': 'Mar 2026',
  '2026-04': 'Apr 2026',
  '2026-05': 'May 2026',
  '2026-06': 'Jun 2026',
  '2026-07': 'Jul 2026',
  '2026-08': 'Aug 2026',
  '2026-09': 'Sep 2026',
  '2026-10': 'Oct 2026',
  '2026-11': 'Nov 2026',
  '2026-12': 'Dec 2026',
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n: number) {
  return '$' + Math.abs(Math.round(n)).toLocaleString();
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('income');
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchSummary = useCallback(async () => {
    const [incRes, fixedRes, txRes] = await Promise.all([
      fetch('/api/income').then((r) => r.json()),
      fetch('/api/fixed-expenses').then((r) => r.json()),
      fetch(`/api/transactions?month=${month}`).then((r) => r.json()),
    ]);

    const income = incRes as Record<string, number>;
    const fixed = fixedRes as { amount: number }[];
    const txs = txRes as { amount: number }[];

    const base = income.base_pay || 0;
    const tsp = Math.round(base * 0.2);
    const roth = income.roth_ira || 0;
    const totalIncome =
      (income.base_pay || 0) +
      (income.bas || 0) +
      (income.bah || 0) +
      (income.other || 0);
    const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0);
    const appleTotal = txs.reduce((s, t) => s + t.amount, 0);
    const deductions = tsp + roth + (income.taxes || 0) + (income.sgli || 0);
    const net = totalIncome - deductions - fixedTotal - appleTotal;

    setSummary({
      totalIncome,
      tsp,
      roth,
      fixedExpenses: fixedTotal,
      appleCard: appleTotal,
      net,
    });
  }, [month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Budget tracker
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              E-3 · 4N0 · JBSA Fort Sam Houston
            </p>
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {MONTH_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Total income" value={fmt(summary.totalIncome)} />
            <MetricCard
              label="Invested"
              value={fmt(summary.tsp + summary.roth)}
              color="green"
            />
            <MetricCard
              label="Apple Card"
              value={fmt(summary.appleCard)}
              color="red"
            />
            <MetricCard
              label="Net remaining"
              value={(summary.net >= 0 ? '+' : '-') + fmt(summary.net)}
              color={summary.net >= 0 ? 'green' : 'red'}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {(['income', 'transactions', 'goals'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t === 'transactions' ? 'Apple Card' : t}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'income' && <IncomePanel onUpdate={fetchSummary} />}
            {tab === 'transactions' && (
              <TransactionsPanel month={month} onUpdate={fetchSummary} />
            )}
            {tab === 'goals' && <GoalsPanel />}
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color = 'default',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    default: 'text-gray-900',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3.5">
      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-xl font-semibold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}
