'use client';

import {
  APP_CONFIG,
  DEDUCTION_FIELDS,
  INCOME_FIELDS,
  TSP_CONFIG,
} from '@/lib/config';
import type { Debt, FixedExpense, IncomeConfig } from '@/lib/types';
import { currentMonth, formatCurrency } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

import DebtsPanel from './components/DebtsPanel';
import FixedExpensesPanel from './components/FixedExpensesPanel';
import GoalsPanel from './components/GoalsPanel';
import IncomePanel from './components/IncomePanel';
import TransactionsPanel from './components/TransactionsPanel';
import { api } from '@/lib/api';

type Tab = 'income' | 'transactions' | 'goals';

interface Summary {
  totalIncome: number;
  tsp: number;
  roth: number;
  committed: number;
  spending: number;
  net: number;
}

const MONTH_NAMES = [
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

function getYearRange() {
  const y = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => y - 2 + i); // 2 back → 1 ahead
}

function calcSummary(
  income: IncomeConfig,
  fixed: FixedExpense[],
  txs: { amount: number }[],
  debts: Debt[],
): Summary {
  const base = income.base_pay || 0;
  const tspRate = income.tsp_rate ?? TSP_CONFIG.rate;
  const tsp = Math.round(base * tspRate);
  const roth = income.roth_ira || 0;
  const totalIncome = INCOME_FIELDS.reduce(
    (s, f) => s + (income[f.key] || 0),
    0,
  );
  const fixedExpenses = fixed.reduce(
    (s, f) => s + (f.period === 'annual' ? f.amount / 12 : f.amount),
    0,
  );
  // Only count debts that still have a balance (not yet paid off)
  const debtPayments = debts
    .filter((d) => d.balance > 0)
    .reduce((s, d) => s + d.monthly_payment, 0);
  const committed = fixedExpenses + debtPayments;
  const spending = txs.reduce((s, t) => s + t.amount, 0);
  const deductions =
    tsp + DEDUCTION_FIELDS.reduce((s, f) => s + (income[f.key] || 0), 0);
  return {
    totalIncome,
    tsp,
    roth,
    committed,
    spending,
    net: totalIncome - deductions - committed - spending,
  };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('income');
  const [month, setMonth] = useState('');
  const [yearRange, setYearRange] = useState<number[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Initialise date-dependent state client-side only to avoid SSR/client mismatch
  useEffect(() => {
    setMonth(currentMonth());
    setYearRange(getYearRange());
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!month) return;
    const [income, fixed, txs, debts] = await Promise.all([
      api.income.get(month),
      api.fixedExpenses.list(),
      api.transactions.list(month),
      api.debts.list(),
    ]);
    setSummary(calcSummary(income, fixed, txs, debts));
  }, [month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {APP_CONFIG.title}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {APP_CONFIG.subtitle}
            </p>
          </div>
          {month && (
            <div className="flex gap-2">
              <select
                value={month.slice(0, 4)}
                onChange={(e) =>
                  setMonth(`${e.target.value}-${month.slice(5)}`)
                }
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {yearRange.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                value={month.slice(5)}
                onChange={(e) =>
                  setMonth(`${month.slice(0, 4)}-${e.target.value}`)
                }
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTH_NAMES.map((name, i) => {
                  const val = String(i + 1).padStart(2, '0');
                  return (
                    <option key={val} value={val}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <MetricCard
              label="Total income"
              value={formatCurrency(summary.totalIncome)}
            />
            <MetricCard
              label="Invested"
              value={formatCurrency(summary.tsp + summary.roth)}
              color="green"
            />
            <MetricCard
              label="Committed"
              value={formatCurrency(summary.committed)}
              color="amber"
            />
            <MetricCard
              label={APP_CONFIG.transactionsTabLabel}
              value={formatCurrency(summary.spending)}
              color="red"
            />
            <MetricCard
              label="Net remaining"
              value={
                (summary.net >= 0 ? '+' : '-') +
                formatCurrency(Math.abs(summary.net))
              }
              color={summary.net >= 0 ? 'green' : 'red'}
            />
          </div>
        )}

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
                {t === 'transactions' ? APP_CONFIG.transactionsTabLabel : t}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'income' && (
              <div className="space-y-6">
                <IncomePanel month={month} onUpdate={fetchSummary} />
                <FixedExpensesPanel onUpdate={fetchSummary} />
                <DebtsPanel onUpdate={fetchSummary} />
              </div>
            )}
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
    amber: 'text-amber-700',
    default: 'text-gray-900',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3.5">
      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-xl font-semibold ${colorMap[color] ?? colorMap.default}`}
      >
        {value}
      </p>
    </div>
  );
}
