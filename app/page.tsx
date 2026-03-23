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
import { useCallback, useEffect, useRef, useState } from 'react';

import AnalyticsPanel from './components/AnalyticsPanel';
import BudgetSuggestionsPanel from './components/BudgetSuggestionsPanel';
import DebtsPanel from './components/DebtsPanel';
import FixedExpensesPanel from './components/FixedExpensesPanel';
import GoalsPanel from './components/GoalsPanel';
import IncomePanel from './components/IncomePanel';
import ReceivablesPanel from './components/ReceivablesPanel';
import TransactionsPanel from './components/TransactionsPanel';
import YtdPanel from './components/YtdPanel';
import { api } from '@/lib/api';

type Tab = 'income' | 'transactions' | 'goals' | 'analytics';

interface Summary {
  totalIncome: number;
  tsp: number;
  roth: number;
  committed: number;
  spending: number;
  net: number;
  savingsRate: number;
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
  const net = totalIncome - deductions - committed - spending;
  const savingsRate =
    totalIncome > 0
      ? Math.round(((tsp + roth + Math.max(0, net)) / totalIncome) * 100)
      : 0;
  return { totalIncome, tsp, roth, committed, spending, net, savingsRate };
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
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMonth(currentMonth());
    setYearRange(getYearRange());
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      setIsDark(false);
    }
  }, []);

  async function handleExport() {
    const res = await fetch(api.backup.exportUrl);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = cd.match(/filename="(.+?)"/)?.[1] ?? 'budget-backup.json';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    const res = await api.backup.restore(data);
    if (res.ok) {
      alert(`Restored ${res.restored ?? 0} records.`);
      fetchSummary();
    } else {
      alert(`Restore failed: ${res.error}`);
    }
    if (restoreRef.current) restoreRef.current.value = '';
  }

  function handleCategoryDrill(category: string) {
    setDrillCategory(category);
    setTab('transactions');
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }

  const fetchSummary = useCallback(async () => {
    if (!month) return;
    const pm = prevMonth(month);
    const [income, fixed, txs, debts, entries, pIncome, pTxs, pEntries] =
      await Promise.all([
        api.income.get(month),
        api.fixedExpenses.list(),
        api.transactions.list(month),
        api.debts.list(),
        api.incomeEntries.list(month),
        api.income.get(pm),
        api.transactions.list(pm),
        api.incomeEntries.list(pm),
      ]);
    setSummary(calcSummary(income, fixed, txs, debts, entries));
    setPrevSummary(calcSummary(pIncome, fixed, pTxs, debts, pEntries));
  }, [month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-text tracking-tight">
              {APP_CONFIG.title}
            </h1>
            <p className="text-[11px] text-text-3 mt-0.5 tracking-wide">
              {APP_CONFIG.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              title="Export backup (JSON)"
              className="h-7 px-2 flex items-center justify-center rounded-lg text-xs text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all"
            >
              Export
            </button>
            <label
              title="Restore from backup"
              className="h-7 px-2 flex items-center justify-center rounded-lg text-xs text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all cursor-pointer"
            >
              Restore
              <input
                ref={restoreRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestore}
              />
            </label>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all text-sm"
            >
              {isDark ? '☀' : '🌙'}
            </button>

            {month && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setMonth(prevMonth(month))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all text-base leading-none"
                >
                  ‹
                </button>
                <select
                  value={month.slice(5)}
                  onChange={(e) =>
                    setMonth(`${month.slice(0, 4)}-${e.target.value}`)
                  }
                  className="bg-transparent text-sm text-text focus:outline-none cursor-pointer px-1"
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
                  className="bg-transparent text-sm text-text focus:outline-none cursor-pointer px-1"
                >
                  {yearRange.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setMonth(nextMonth(month))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all text-base leading-none"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Summary metrics */}
        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <MetricCard
                label="Total income"
                value={formatCurrency(summary.totalIncome)}
                delta={delta(
                  summary.totalIncome,
                  prevSummary?.totalIncome,
                  true,
                )}
              />
              <MetricCard
                label="Invested"
                value={formatCurrency(summary.tsp + summary.roth)}
                accent="blue"
                delta={delta(
                  summary.tsp + summary.roth,
                  prevSummary ? prevSummary.tsp + prevSummary.roth : undefined,
                  true,
                )}
              />
              <MetricCard
                label="Committed"
                value={formatCurrency(summary.committed)}
                accent="amber"
                delta={delta(summary.committed, prevSummary?.committed, null)}
              />
              <MetricCard
                label={APP_CONFIG.transactionsTabLabel}
                value={formatCurrency(summary.spending)}
                sub={projectedSpending(month, summary.spending)}
                accent="red"
                delta={delta(summary.spending, prevSummary?.spending, false)}
              />
              <MetricCard
                label="Net remaining"
                value={
                  (summary.net >= 0 ? '+' : '') + formatCurrency(summary.net)
                }
                accent={summary.net >= 0 ? 'green' : 'red'}
                delta={delta(summary.net, prevSummary?.net, true)}
              />
              <MetricCard
                label="Savings rate"
                value={`${summary.savingsRate}%`}
                accent={
                  summary.savingsRate >= 20
                    ? 'green'
                    : summary.savingsRate >= 10
                      ? 'amber'
                      : 'red'
                }
                delta={delta(
                  summary.savingsRate,
                  prevSummary?.savingsRate,
                  true,
                  true,
                )}
              />
            </div>

            {/* Budget allocation bar */}
            {summary.totalIncome > 0 && <BudgetBar summary={summary} />}
          </div>
        )}

        {/* Tab panel */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Tab navigation */}
          <div className="flex gap-1 p-1.5 border-b border-border">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  tab === key
                    ? 'bg-surface-raised text-text shadow-sm'
                    : 'text-text-3 hover:text-text-2'
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
              <TransactionsPanel
                month={month}
                onUpdate={fetchSummary}
                initialCategory={drillCategory}
              />
            )}
            {tab === 'goals' && (
              <div className="space-y-8">
                <GoalsPanel />
                <div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
                    Budget suggestions
                  </h3>
                  <BudgetSuggestionsPanel />
                </div>
              </div>
            )}
            {tab === 'analytics' && (
              <div className="space-y-8">
                <YtdPanel month={month} />
                <AnalyticsPanel
                  month={month}
                  onCategoryClick={handleCategoryDrill}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Month-over-month delta ───────────────────────────────────────── */

// upIsGood: true=green when up, false=green when down, null=always gray
function delta(
  curr: number,
  prev: number | undefined,
  upIsGood: boolean | null,
  isPct = false,
): { text: string; good: boolean | null } | null {
  if (prev === undefined || prev === null) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.5) return null; // too small to show
  const sign = diff > 0 ? '+' : '';
  const text = isPct
    ? `${sign}${Math.round(diff)} pts`
    : `${sign}${formatCurrency(Math.abs(diff))} ${diff > 0 ? '↑' : '↓'}`;
  const good = upIsGood === null ? null : diff > 0 ? upIsGood : !upIsGood;
  return { text, good };
}

/* ── Projected spending helper ────────────────────────────────────── */

function projectedSpending(month: string, spending: number): string | null {
  const today = new Date();
  const cm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month !== cm) return null;
  const day = today.getDate();
  const totalDays = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  if (day < 3 || day >= totalDays) return null; // too early or month is done
  const projected = Math.round((spending / day) * totalDays);
  return `→ ${formatCurrency(projected)} projected`;
}

/* ── Metric Card ──────────────────────────────────────────────────── */

const ACCENT_TEXT: Record<string, string> = {
  green: 'text-[#00d98a]',
  red: 'text-[#ff4560]',
  amber: 'text-[#f5aa2a]',
  blue: 'text-[#4a8cff]',
  default: 'text-text',
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
  sub,
  accent = 'default',
  delta: d,
}: {
  label: string;
  value: string;
  sub?: string | null;
  accent?: string;
  delta?: { text: string; good: boolean | null } | null;
}) {
  const color = ACCENT_LINE[accent] ?? 'transparent';
  const textClass = ACCENT_TEXT[accent] ?? ACCENT_TEXT.default;
  const deltaClass =
    d?.good === true
      ? 'text-[#00d98a]'
      : d?.good === false
        ? 'text-[#ff4560]'
        : 'text-text-4';
  return (
    <div className="bg-surface rounded-xl border border-border p-4 relative overflow-hidden">
      {accent !== 'default' && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, ${color}55, transparent 70%)`,
          }}
        />
      )}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-2">
        {label}
      </p>
      <p
        className={`text-xl font-mono font-semibold leading-none ${textClass}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] font-mono text-text-4 mt-1.5">{sub}</p>}
      {d && (
        <p className={`text-[10px] font-mono mt-1 ${deltaClass}`}>
          {d.text} vs last mo
        </p>
      )}
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
    <div className="bg-surface rounded-xl border border-border px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-2.5">
        Allocation
      </p>
      <div className="h-1.5 bg-bg rounded-full flex gap-px overflow-hidden">
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
            <span className="text-[11px] text-text-2">
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
