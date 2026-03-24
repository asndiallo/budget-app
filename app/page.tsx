'use client';

import {
  APP_CONFIG,
  DEDUCTION_FIELDS,
  INCOME_FIELDS,
  TSP_CONFIG,
} from '@/lib/config';
import type {
  Asset,
  Debt,
  FixedExpense,
  Goal,
  HealthScore,
  IncomeConfig,
  IncomeEntry,
  UserProfile,
} from '@/lib/types';
import {
  currentMonth,
  formatCurrency,
  nextMonth,
  prevMonth,
} from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

import AnalyticsPanel from './components/AnalyticsPanel';
import AssetsPanel from './components/AssetsPanel';
import AutoCategorizationPanel from './components/AutoCategorizationPanel';
import BrsPanel from './components/BrsPanel';
import BudgetSuggestionsPanel from './components/BudgetSuggestionsPanel';
import CashFlowCalendar from './components/CashFlowCalendar';
import DebtsPanel from './components/DebtsPanel';
import FixedExpensesPanel from './components/FixedExpensesPanel';
import GoalsPanel from './components/GoalsPanel';
import IncomePanel from './components/IncomePanel';
import OverviewPanel from './components/OverviewPanel';
import PcsPanel from './components/PcsPanel';
import PromoProjectionPanel from './components/PromoProjectionPanel';
import ReceivablesPanel from './components/ReceivablesPanel';
import RecurringDetectionPanel from './components/RecurringDetectionPanel';
import TransactionsPanel from './components/TransactionsPanel';
import UserNav from './components/UserNav';
import YtdPanel from './components/YtdPanel';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

type Tab =
  | 'income'
  | 'transactions'
  | 'goals'
  | 'analytics'
  | 'assets'
  | 'calendar'
  | 'overview'
  | 'pcs';

interface Summary {
  totalIncome: number;
  tsp: number;
  investmentFixed: number;
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
  const militaryIncome = INCOME_FIELDS.reduce(
    (s, f) => s + (income[f.key] || 0),
    0,
  );
  const extraIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalIncome = militaryIncome + extraIncome;
  const investmentFixed = fixed.reduce(
    (s, f) =>
      f.is_investment
        ? s + (f.period === 'annual' ? f.amount / 12 : f.amount)
        : s,
    0,
  );
  const fixedExpenses = fixed.reduce(
    (s, f) =>
      f.is_investment
        ? s
        : s + (f.period === 'annual' ? f.amount / 12 : f.amount),
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
      ? Math.round(
          ((tsp + investmentFixed + Math.max(0, net)) / totalIncome) * 100,
        )
      : 0;
  return {
    totalIncome,
    tsp,
    investmentFixed,
    committed,
    spending,
    net,
    savingsRate,
  };
}

const TAB_ICONS: Record<Tab, string> = {
  income: '◎',
  transactions: '⇄',
  goals: '◈',
  analytics: '⊞',
  assets: '◇',
  calendar: '▦',
  overview: '◉',
  pcs: '⊳',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'income', label: 'Income' },
  { key: 'transactions', label: APP_CONFIG.transactionsTabLabel },
  { key: 'goals', label: 'Goals' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'assets', label: 'Net Worth' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'overview', label: 'Overview' },
  { key: 'pcs', label: 'PCS' },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('income');
  const [month, setMonth] = useState('');
  const [yearRange, setYearRange] = useState<number[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [streak, setStreak] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [incomeSub, setIncomeSub] = useState<'pay' | 'bills' | 'projections'>(
    'pay',
  );
  const [assetsSub, setAssetsSub] = useState<'assets' | 'debts'>('assets');
  const [goalsSub, setGoalsSub] = useState<'goals' | 'budget'>('goals');
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMonth(currentMonth());
    setYearRange(getYearRange());
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    setTheme(saved ?? 'system');
    authClient
      .getSession()
      .then(({ data }) => {
        if (data?.user?.id) setUser(data.user as unknown as UserProfile);
      })
      .catch(() => {});
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Always allow Escape to close shortcuts overlay
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }
      if (e.key === '?') {
        setShowShortcuts((v) => !v);
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

      // / — focus search input in transactions panel
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setTab('transactions');
        setTimeout(() => {
          (
            document.querySelector('[data-search-input]') as HTMLInputElement
          )?.focus();
        }, 50);
        return;
      }

      if (isInput) return;

      // ← → to move between months
      if (e.key === 'ArrowLeft') setMonth((m) => (m ? prevMonth(m) : m));
      if (e.key === 'ArrowRight') setMonth((m) => (m ? nextMonth(m) : m));

      // 1–7 to switch tabs
      const tabIndex = parseInt(e.key) - 1;
      if (tabIndex >= 0 && tabIndex < TABS.length) setTab(TABS[tabIndex].key);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  function cycleTheme() {
    setTheme((t) => {
      const next = t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system';
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      if (next === 'light') root.classList.add('light');
      else if (next === 'dark') root.classList.add('dark');
      localStorage.setItem('theme', next);
      return next;
    });
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
    api.streak.get().then((r) => setStreak(r.streak));
    api.assets.list().then(setAssets);
    api.debts.list().then(setDebts);
    api.goals.list().then(setGoals);
    api.healthScore.get().then(setHealthScore);
  }, [month]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{
                background: 'linear-gradient(135deg, #4a8cff 0%, #00d98a 100%)',
              }}
            >
              B
            </div>
            <div>
              <h1 className="text-[13px] font-semibold text-text tracking-tight leading-none">
                {APP_CONFIG.title}
              </h1>
              <p className="text-[10px] text-text-4 mt-0.5 tracking-wide leading-none">
                {user
                  ? [user.pay_grade, user.mos, user.duty_station]
                      .filter(Boolean)
                      .join(' · ') || APP_CONFIG.subtitle
                  : APP_CONFIG.subtitle}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {user && (
              <UserNav
                user={user}
                onProfileUpdate={() =>
                  authClient
                    .getSession()
                    .then(({ data }) => {
                      if (data?.user?.id)
                        setUser(data.user as unknown as UserProfile);
                    })
                    .catch(() => {})
                }
              />
            )}
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={handleExport}
              title="Export backup (JSON)"
              className="h-7 px-2.5 flex items-center justify-center rounded-lg text-xs text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all"
            >
              Export
            </button>
            <label
              title="Restore from backup"
              className="h-7 px-2.5 flex items-center justify-center rounded-lg text-xs text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all cursor-pointer"
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
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={cycleTheme}
              title={`Theme: ${theme} — click to cycle (system → light → dark)`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all text-sm"
            >
              {theme === 'light' ? '☀' : theme === 'dark' ? '🌙' : '◐'}
            </button>

            {month && (
              <div className="flex items-center gap-0.5 ml-1">
                {month !== currentMonth() && (
                  <button
                    onClick={() => setMonth(currentMonth())}
                    className="text-[10px] text-[#4a8cff] hover:text-[#4a8cff]/70 transition-colors mr-1 font-medium"
                    title="Jump to current month"
                  >
                    Today
                  </button>
                )}
                <button
                  onClick={() => setMonth(prevMonth(month))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-all text-base leading-none"
                >
                  ‹
                </button>
                <div className="flex items-center bg-surface-raised rounded-lg px-1 border border-border">
                  <select
                    value={month.slice(5)}
                    onChange={(e) =>
                      setMonth(`${month.slice(0, 4)}-${e.target.value}`)
                    }
                    className="bg-transparent text-sm text-text focus:outline-none cursor-pointer px-1 py-0.5"
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
                    className="bg-transparent text-sm text-text focus:outline-none cursor-pointer px-1 py-0.5"
                  >
                    {yearRange.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
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
        {/* ── Summary metrics ── */}
        {summary && (
          <div className="space-y-3 animate-fade-in-up">
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
                value={formatCurrency(summary.tsp + summary.investmentFixed)}
                accent="blue"
                delta={delta(
                  summary.tsp + summary.investmentFixed,
                  prevSummary
                    ? prevSummary.tsp + prevSummary.investmentFixed
                    : undefined,
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

            {/* Net worth + Health score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NetWorthCard assets={assets} debts={debts} goals={goals} />
              {healthScore && <HealthScoreCard score={healthScore} />}
            </div>

            {/* Spending streak */}
            {streak >= 2 && <StreakBanner streak={streak} />}
          </div>
        )}

        {/* ── Tab panel ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Tab navigation */}
          <div className="flex border-b border-border">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  tab === key
                    ? 'text-text'
                    : 'text-text-3 hover:text-text-2 hover:bg-surface-raised/50'
                }`}
              >
                <span
                  className={`text-xs ${tab === key ? 'opacity-70' : 'opacity-40'}`}
                >
                  {TAB_ICONS[key]}
                </span>
                {label}
                {tab === key && (
                  <span
                    className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-t-full"
                    style={{
                      background: 'linear-gradient(90deg, #4a8cff, #00d98a)',
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="p-5">
            {tab === 'income' && (
              <div>
                <SubNav
                  options={[
                    { key: 'pay', label: 'Pay' },
                    { key: 'bills', label: 'Fixed bills' },
                    { key: 'projections', label: 'Projections' },
                  ]}
                  active={incomeSub}
                  onChange={(k) => setIncomeSub(k as typeof incomeSub)}
                />
                {incomeSub === 'pay' && (
                  <div className="space-y-8">
                    <IncomePanel month={month} onUpdate={fetchSummary} />
                    <ReceivablesPanel month={month} onUpdate={fetchSummary} />
                  </div>
                )}
                {incomeSub === 'bills' && (
                  <div className="space-y-8">
                    <FixedExpensesPanel month={month} onUpdate={fetchSummary} />
                    <RecurringDetectionPanel onUpdate={fetchSummary} />
                  </div>
                )}
                {incomeSub === 'projections' && (
                  <div className="space-y-8">
                    <PromoProjectionPanel user={user} />
                    <BrsPanel user={user} month={month} />
                  </div>
                )}
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
              <div>
                <SubNav
                  options={[
                    { key: 'goals', label: 'Goals' },
                    { key: 'budget', label: 'Budget' },
                  ]}
                  active={goalsSub}
                  onChange={(k) => setGoalsSub(k as typeof goalsSub)}
                />
                {goalsSub === 'goals' && <GoalsPanel />}
                {goalsSub === 'budget' && (
                  <BudgetSuggestionsPanel
                    monthlyIncome={summary?.totalIncome}
                  />
                )}
              </div>
            )}
            {tab === 'analytics' && (
              <div className="space-y-8">
                <YtdPanel month={month} />
                <AnalyticsPanel
                  month={month}
                  onCategoryClick={handleCategoryDrill}
                />
                <AutoCategorizationPanel />
              </div>
            )}

            {tab === 'assets' && (
              <div>
                <SubNav
                  options={[
                    { key: 'assets', label: 'Assets' },
                    { key: 'debts', label: 'Debts' },
                  ]}
                  active={assetsSub}
                  onChange={(k) => setAssetsSub(k as typeof assetsSub)}
                />
                {assetsSub === 'assets' && (
                  <AssetsPanel onUpdate={fetchSummary} />
                )}
                {assetsSub === 'debts' && (
                  <DebtsPanel onUpdate={fetchSummary} />
                )}
              </div>
            )}

            {tab === 'calendar' && (
              <CashFlowCalendar
                month={month}
                netMonthlyIncome={
                  summary
                    ? summary.net + summary.committed + summary.spending
                    : undefined
                }
              />
            )}

            {tab === 'overview' && (
              <OverviewPanel
                initialYear={
                  month ? parseInt(month.slice(0, 4)) : new Date().getFullYear()
                }
              />
            )}

            {tab === 'pcs' && <PcsPanel user={user} />}
          </div>
        </div>
      </main>

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-bg border border-border rounded-2xl p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text">
                Keyboard shortcuts
              </h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-text-4 hover:text-text-2 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-xs">
              {[
                ['←  /  →', 'Previous / next month'],
                ['1 – 8', 'Switch tab (Income → PCS)'],
                ['/', 'Focus transaction search'],
                ['?', 'Toggle this help'],
                ['Esc', 'Close overlay'],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-1.5 border-b border-border-dim last:border-0"
                >
                  <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface border border-border text-text-2">
                    {key}
                  </kbd>
                  <span className="text-text-3">{desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[10px] text-text-4 text-center">
              Tabs: 1 Income · 2 Spending · 3 Goals · 4 Analytics · 5 Net Worth
              · 6 Calendar · 7 Overview · 8 PCS
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared label component ───────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
      {children}
    </h3>
  );
}

/* ── Sub-tab navigation ───────────────────────────────────────────── */
function SubNav({
  options,
  active,
  onChange,
}: {
  options: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-5 p-1 bg-surface-raised rounded-xl border border-border w-fit">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            active === key
              ? 'bg-bg text-text shadow-sm border border-border'
              : 'text-text-3 hover:text-text-2'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Month-over-month delta ───────────────────────────────────────── */
function delta(
  curr: number,
  prev: number | undefined,
  upIsGood: boolean | null,
  isPct = false,
): { text: string; good: boolean | null } | null {
  if (prev === undefined || prev === null) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.5) return null;
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
  if (day < 3 || day >= totalDays) return null;
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

const ACCENT_BG: Record<string, string> = {
  green: 'rgba(0, 217, 138, 0.04)',
  red: 'rgba(255, 69, 96, 0.04)',
  amber: 'rgba(245, 170, 42, 0.04)',
  blue: 'rgba(74, 140, 255, 0.04)',
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
  const bgHint = ACCENT_BG[accent] ?? 'transparent';
  const deltaClass =
    d?.good === true
      ? 'text-[#00d98a]'
      : d?.good === false
        ? 'text-[#ff4560]'
        : 'text-text-4';
  return (
    <div
      className="bg-surface rounded-xl border border-border p-4 relative overflow-hidden flex flex-col"
      style={{
        backgroundColor:
          bgHint !== 'transparent'
            ? `color-mix(in srgb, var(--surface) 95%, ${color} 5%)`
            : undefined,
      }}
    >
      {accent !== 'default' && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, ${color}cc, ${color}33 60%, transparent)`,
          }}
        />
      )}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-1.5">
        {label}
      </p>
      <p
        className={`text-[22px] font-mono font-semibold leading-none ${textClass}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] font-mono text-text-4 mt-1.5">{sub}</p>}
      {d && (
        <p className={`text-[10px] font-mono mt-1.5 ${deltaClass}`}>
          {d.text} vs last mo
        </p>
      )}
    </div>
  );
}

/* ── Budget Allocation Bar ────────────────────────────────────────── */
function BudgetBar({ summary }: { summary: Summary }) {
  const { totalIncome, tsp, investmentFixed, committed, spending, net } =
    summary;
  if (totalIncome === 0) return null;

  const pct = (n: number) =>
    Math.max(0, Math.min(100, (n / totalIncome) * 100));

  const invested = tsp + investmentFixed;
  const segments = [
    {
      label: 'Invested',
      value: invested,
      pct: pct(invested),
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
    <div className="bg-surface rounded-xl border border-border px-4 py-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          Allocation
        </p>
        <p className="text-[10px] font-mono text-text-4">
          {formatCurrency(totalIncome)} total
        </p>
      </div>
      <div className="h-2 bg-bg rounded-full flex gap-0.5 overflow-hidden">
        {segments.map(({ label, pct: p, color }) => (
          <div
            key={label}
            style={{ width: `${p}%`, backgroundColor: color }}
            className="rounded-full transition-all duration-500"
            title={`${label}: ${formatCurrency(segments.find((s) => s.label === label)?.value ?? 0)} (${Math.round(p)}%)`}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-2.5 flex-wrap">
        {segments.map(({ label, pct: p, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-text-3">
              {label}{' '}
              <span style={{ color }} className="font-mono font-medium">
                {Math.round(p)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Net Worth Card ───────────────────────────────────────────────── */

function NetWorthCard({
  assets,
  debts,
  goals,
}: {
  assets: Asset[];
  debts: Debt[];
  goals: Goal[];
}) {
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalGoalsSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalLiabilities = debts.reduce((s, d) => s + d.balance, 0);
  const netWorth = totalAssets + totalGoalsSaved - totalLiabilities;
  const noData = assets.length === 0 && totalGoalsSaved === 0;

  if (noData) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-1">
            Net Worth
          </p>
          <p className="text-sm text-text-4">
            Add assets in the <span className="text-text-2">Net Worth tab</span>{' '}
            to track your complete financial picture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background:
            'linear-gradient(90deg, #00d98acc, #00d98a33 60%, transparent)',
        }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-2">
        Net Worth
      </p>
      <p
        className={`text-xl font-mono font-semibold leading-none ${netWorth >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]'}`}
      >
        {netWorth >= 0 ? '' : '–'}
        {formatCurrency(Math.abs(netWorth))}
      </p>
      {totalLiabilities > 0 && (
        <p className="text-[10px] text-text-4 mt-1">
          <span className="text-text-2">
            {formatCurrency(totalAssets + totalGoalsSaved)}
          </span>{' '}
          assets
          {' · '}
          <span className="text-[#ff4560]">
            {formatCurrency(totalLiabilities)}
          </span>{' '}
          liabilities
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        {(
          [
            'Checking',
            'Savings',
            'Brokerage',
            'Retirement',
            'Property',
            'Vehicle',
            'Other',
          ] as const
        ).map((cat) => {
          const total = assets
            .filter((a) => a.category === cat)
            .reduce((s, a) => s + a.balance, 0);
          if (total === 0) return null;
          const grandTotal = totalAssets + totalGoalsSaved;
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[10px] text-text-4 w-20 shrink-0">
                {cat}
              </span>
              <div className="flex-1 h-1 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#00d98a]"
                  style={{ width: `${pct}%`, opacity: 0.4 + pct / 150 }}
                />
              </div>
              <span className="text-[10px] font-mono text-text-2 shrink-0">
                {formatCurrency(total)}
              </span>
            </div>
          );
        })}
        {totalGoalsSaved > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-4 w-20 shrink-0">Goals</span>
            <div className="flex-1 h-1 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#b085f5]"
                style={{
                  width: `${((totalGoalsSaved / (totalAssets + totalGoalsSaved)) * 100).toFixed(1)}%`,
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-text-2 shrink-0">
              {formatCurrency(totalGoalsSaved)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Health Score Card ─────────────────────────────────────────────── */

function HealthScoreCard({ score }: { score: HealthScore }) {
  const grade =
    score.total >= 85
      ? { label: 'Excellent', color: '#00d98a' }
      : score.total >= 70
        ? { label: 'Good', color: '#4a8cff' }
        : score.total >= 50
          ? { label: 'Fair', color: '#f5aa2a' }
          : { label: 'Needs work', color: '#ff4560' };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${grade.color}cc, ${grade.color}33 60%, transparent)`,
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          Financial Health
        </p>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: grade.color, background: `${grade.color}18` }}
        >
          {grade.label}
        </span>
      </div>
      <p
        className="text-[22px] font-mono font-semibold leading-none mb-3"
        style={{ color: grade.color }}
      >
        {score.total}
        <span className="text-sm font-normal text-text-4">/100</span>
      </p>
      <div className="space-y-2">
        {score.components.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-3">{c.name}</span>
              <span className="text-[10px] font-mono text-text-2">
                {c.score}
                <span className="text-text-4">/{c.max}</span>
              </span>
            </div>
            <div className="h-1 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(c.score / c.max) * 100}%`,
                  backgroundColor:
                    c.score >= 20
                      ? '#00d98a'
                      : c.score >= 12
                        ? '#4a8cff'
                        : c.score >= 6
                          ? '#f5aa2a'
                          : '#ff4560',
                }}
              />
            </div>
            <p className="text-[9px] text-text-4 mt-0.5">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Streak Banner ────────────────────────────────────────────────── */
function StreakBanner({ streak }: { streak: number }) {
  const label =
    streak >= 12
      ? 'A full year in the green'
      : streak >= 6
        ? 'Half a year in the green'
        : `${streak} months in the green`;

  const config =
    streak >= 12
      ? {
          color: '#00d98a',
          bg: 'rgba(0,217,138,0.06)',
          border: 'rgba(0,217,138,0.25)',
          icon: '🔥',
        }
      : streak >= 6
        ? {
            color: '#4a8cff',
            bg: 'rgba(74,140,255,0.06)',
            border: 'rgba(74,140,255,0.25)',
            icon: '🔥',
          }
        : {
            color: '#f5aa2a',
            bg: 'rgba(245,170,42,0.06)',
            border: 'rgba(245,170,42,0.25)',
            icon: '⚡',
          };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium"
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: `0 0 20px ${config.color}18`,
      }}
    >
      <span className="text-base leading-none">{config.icon}</span>
      <span style={{ color: config.color }} className="font-semibold">
        {label}
      </span>
      <span className="text-text-3">— positive net every month</span>
      <span
        className="ml-auto font-mono text-xs px-2 py-0.5 rounded-full border"
        style={{ color: config.color, borderColor: config.border }}
      >
        {streak}×
      </span>
    </div>
  );
}
