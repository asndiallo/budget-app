'use client';

import {
  APP_CONFIG,
  DEDUCTION_FIELDS,
  INCOME_FIELDS,
  TSP_CONFIG,
} from '@/lib/config';
import type {
  Debt,
  FixedExpense,
  IncomeConfig,
  IncomeEntry,
} from '@/lib/types';
import { currentMonth, formatCurrency } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

import AnalyticsPanel from './components/AnalyticsPanel';
import BudgetSuggestionsPanel from './components/BudgetSuggestionsPanel';
import DebtsPanel from './components/DebtsPanel';
import FixedExpensesPanel from './components/FixedExpensesPanel';
import GoalsPanel from './components/GoalsPanel';
import IncomePanel from './components/IncomePanel';
import ReceivablesPanel from './components/ReceivablesPanel';
import TransactionsPanel from './components/TransactionsPanel';
import { api } from '@/lib/api';

type Tab = 'income' | 'transactions' | 'goals' | 'analytics';

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
  return Array.from({ length: 4 }, (_, i) => y - 2 + i);
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}

function calcSummary(
  income: IncomeConfig,
  fixed: FixedExpense[],
  txs: { amount: number }[],
  debts: Debt[],
  incomeEntries: IncomeEntry[],
): Summary {
  const base = income.base_pay || 0;
  const tspRate = income.tsp_rate ?? TSP_CONFIG.rate;
  const tsp = Math.round(base * tspRate);
  const roth = income.roth_ira || 0;
  const militaryIncome = INCOME_FIELDS.reduce(
    (s, f) => s + (income[f.key] || 0),
    0,
  );
  const extraIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalIncome = militaryIncome + extraIncome;
  const fixedExpenses = fixed.reduce(
    (s, f) => s + (f.period === 'annual' ? f.amount / 12 : f.amount),
    0,
  );
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

const TABS: { key: Tab; label: string }[] = [
  { key: 'income', label: 'Income' },
  { key: 'transactions', label: APP_CONFIG.transactionsTabLabel },
  { key: 'goals', label: 'Goals' },
  { key: 'analytics', label: 'Analytics' },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('income');
  const [month, setMonth] = useState('');
  const [yearRange, setYearRange] = useState<number[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    setMonth(currentMonth());
    setYearRange(getYearRange());
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!month) return;
    const [income, fixed, txs, debts, entries] = await Promise.all([
      api.income.get(month),
      api.fixedExpenses.list(),
      api.transactions.list(month),
      api.debts.list(),
      api.incomeEntries.list(month),
    ]);
    setSummary(calcSummary(income, fixed, txs, debts, entries));
  }, [month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="min-h-screen bg-[#06080f]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#1f2d46] bg-[#06080f]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-[#dce4f8] tracking-tight">
              {APP_CONFIG.title}
            </h1>
            <p className="text-[11px] text-[#7c88a4] mt-0.5 tracking-wide">
              {APP_CONFIG.subtitle}
            </p>
          </div>

          {month && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMonth(prevMonth(month))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7c88a4] hover:text-[#9da8c2] hover:bg-[#141b2e] transition-all text-base leading-none"
              >
                ‹
              </button>
              <select
                value={month.slice(5)}
                onChange={(e) =>
                  setMonth(`${month.slice(0, 4)}-${e.target.value}`)
                }
                className="bg-transparent text-sm text-[#dce4f8] focus:outline-none cursor-pointer px-1"
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
              <select
                value={month.slice(0, 4)}
                onChange={(e) =>
                  setMonth(`${e.target.value}-${month.slice(5)}`)
                }
                className="bg-transparent text-sm text-[#dce4f8] focus:outline-none cursor-pointer px-1"
              >
                {yearRange.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setMonth(nextMonth(month))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7c88a4] hover:text-[#9da8c2] hover:bg-[#141b2e] transition-all text-base leading-none"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Summary metrics */}
        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <MetricCard
                label="Total income"
                value={formatCurrency(summary.totalIncome)}
              />
              <MetricCard
                label="Invested"
                value={formatCurrency(summary.tsp + summary.roth)}
                accent="blue"
              />
              <MetricCard
                label="Committed"
                value={formatCurrency(summary.committed)}
                accent="amber"
              />
              <MetricCard
                label={APP_CONFIG.transactionsTabLabel}
                value={formatCurrency(summary.spending)}
                accent="red"
              />
              <MetricCard
                label="Net remaining"
                value={
                  (summary.net >= 0 ? '+' : '') + formatCurrency(summary.net)
                }
                accent={summary.net >= 0 ? 'green' : 'red'}
              />
            </div>

            {/* Budget allocation bar */}
            {summary.totalIncome > 0 && <BudgetBar summary={summary} />}
          </div>
        )}

        {/* Tab panel */}
        <div className="bg-[#0b0e19] rounded-2xl border border-[#1f2d46] overflow-hidden">
          {/* Tab navigation */}
          <div className="flex gap-1 p-1.5 border-b border-[#1f2d46]">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  tab === key
                    ? 'bg-[#141b2e] text-[#dce4f8] shadow-sm'
                    : 'text-[#7c88a4] hover:text-[#9da8c2]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="p-5">
            {tab === 'income' && (
              <div className="space-y-8">
                <IncomePanel month={month} onUpdate={fetchSummary} />
                <FixedExpensesPanel onUpdate={fetchSummary} />
                <DebtsPanel onUpdate={fetchSummary} />
                <ReceivablesPanel month={month} onUpdate={fetchSummary} />
              </div>
            )}
            {tab === 'transactions' && (
              <TransactionsPanel month={month} onUpdate={fetchSummary} />
            )}
            {tab === 'goals' && (
              <div className="space-y-8">
                <GoalsPanel />
                <div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4] mb-3">
                    Budget suggestions
                  </h3>
                  <BudgetSuggestionsPanel />
                </div>
              </div>
            )}
            {tab === 'analytics' && <AnalyticsPanel month={month} />}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Metric Card ──────────────────────────────────────────────────── */

const ACCENT_TEXT: Record<string, string> = {
  green: 'text-[#00d98a]',
  red: 'text-[#ff4560]',
  amber: 'text-[#f5aa2a]',
  blue: 'text-[#4a8cff]',
  default: 'text-[#dce4f8]',
};

const ACCENT_LINE: Record<string, string> = {
  green: '#00d98a',
  red: '#ff4560',
  amber: '#f5aa2a',
  blue: '#4a8cff',
  default: 'transparent',
};

function MetricCard({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const color = ACCENT_LINE[accent] ?? 'transparent';
  const textClass = ACCENT_TEXT[accent] ?? ACCENT_TEXT.default;
  return (
    <div className="bg-[#0b0e19] rounded-xl border border-[#1f2d46] p-4 relative overflow-hidden">
      {accent !== 'default' && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, ${color}55, transparent 70%)`,
          }}
        />
      )}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4] mb-2">
        {label}
      </p>
      <p
        className={`text-xl font-mono font-semibold leading-none ${textClass}`}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Budget Allocation Bar ────────────────────────────────────────── */

function BudgetBar({ summary }: { summary: Summary }) {
  const { totalIncome, tsp, roth, committed, spending, net } = summary;
  if (totalIncome === 0) return null;

  const pct = (n: number) =>
    Math.max(0, Math.min(100, (n / totalIncome) * 100));

  const segments = [
    {
      label: 'Invested',
      value: tsp + roth,
      pct: pct(tsp + roth),
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
    <div className="bg-[#0b0e19] rounded-xl border border-[#1f2d46] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4] mb-2.5">
        Allocation
      </p>
      <div className="h-1.5 bg-[#06080f] rounded-full flex gap-px overflow-hidden">
        {segments.map(({ label, pct: p, color }) => (
          <div
            key={label}
            style={{ width: `${p}%`, backgroundColor: color }}
            className="rounded-full transition-all duration-500"
            title={`${label} ${Math.round(p)}%`}
          />
        ))}
      </div>
      <div className="flex gap-5 mt-2 flex-wrap">
        {segments.map(({ label, pct: p, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-[#9da8c2]">
              {label}{' '}
              <span style={{ color }} className="font-mono">
                {Math.round(p)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
