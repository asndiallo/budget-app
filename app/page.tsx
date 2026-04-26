'use client';

import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import {
  APP_CONFIG,
  DEDUCTION_FIELDS,
  INCOME_FIELDS,
  INVESTMENT_CATEGORY,
  SPECIAL_PAY_FIELDS,
  TSP_CONFIG,
} from '@/lib/config';
import type {
  Allotment,
  Asset,
  Debt,
  FixedExpense,
  Goal,
  HealthScore,
  IncomeConfig,
  IncomeEntry,
  Summary,
  UserProfile,
} from '@/lib/types';
import {
  currentMonth,
  formatCurrency,
  investmentForMonth,
  nextMonth,
  prevMonth,
} from '@/lib/utils';

import AnalyticsPanel from './components/AnalyticsPanel';
import AssetsPanel from './components/AssetsPanel';
import AutoCategorizationPanel from './components/AutoCategorizationPanel';
import BrsPanel from './components/BrsPanel';
import BudgetActualPanel from './components/BudgetActualPanel';
import BudgetBar from './components/BudgetBar';
import CashFlowCalendar from './components/CashFlowCalendar';
import ContributionLimitsPanel from './components/ContributionLimitsPanel';
import DebtsPanel from './components/DebtsPanel';
import FixedExpensesPanel from './components/FixedExpensesPanel';
import GiBillPanel from './components/GiBillPanel';
import GoalsPanel from './components/GoalsPanel';
import HealthScoreCard from './components/HealthScoreCard';
import IncomePanel from './components/IncomePanel';
import LeavePanel from './components/LeavePanel';
import MetricCard from './components/MetricCard';
import NetWorthCard from './components/NetWorthCard';
import NetWorthTrend from './components/NetWorthTrend';
import OverviewPanel from './components/OverviewPanel';
import PayCareerArcPanel from './components/PayCareerArcPanel';
import PcsPanel from './components/PcsPanel';
import PromoProjectionPanel from './components/PromoProjectionPanel';
import ReceivablesPanel from './components/ReceivablesPanel';
import RecurringDetectionPanel from './components/RecurringDetectionPanel';
import SdpPanel from './components/SdpPanel';
import SpendingAnomalyBanner from './components/SpendingAnomalyBanner';
import StreakBanner from './components/StreakBanner';
import SubNav from './components/SubNav';
import TaxYearSummaryPanel from './components/TaxYearSummaryPanel';
import TransactionsPanel from './components/TransactionsPanel';
import UserNav from './components/UserNav';
import YtdPanel from './components/YtdPanel';

// ── Tab / sub-tab types ───────────────────────────────────────────────────────

type Tab = 'dashboard' | 'pay' | 'spending' | 'wealth' | 'plan';
type PaySub = 'pay' | 'tax' | 'leave';
type SpendingSub = 'transactions' | 'bills' | 'budget' | 'calendar';
type WealthSub = 'net-worth' | 'goals' | 'analytics';
type AssetsSub = 'assets' | 'debts';
type PlanSub = 'overview' | 'projections' | 'pcs';

// ── Static config ─────────────────────────────────────────────────────────────

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

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '◉' },
  { key: 'pay', label: 'Pay', icon: '◎' },
  { key: 'spending', label: 'Spending', icon: '⇄' },
  { key: 'wealth', label: 'Wealth', icon: '◈' },
  { key: 'plan', label: 'Plan', icon: '⊳' },
];

// ── Summary calc ──────────────────────────────────────────────────────────────

function calcSummary(
  income: IncomeConfig,
  fixed: FixedExpense[],
  txs: { amount: number; category: string }[],
  debts: Debt[],
  incomeEntries: IncomeEntry[],
  joinedAt?: string,
  month?: string,
  allotmentList?: Allotment[],
): Summary {
  const base = income.base_pay || 0;
  const tspRate = income.tsp_rate ?? TSP_CONFIG.rate;
  const tsp = Math.round(base * tspRate);
  const beforeService = joinedAt && month ? month < joinedAt : false;
  const militaryIncome = beforeService
    ? 0
    : [...INCOME_FIELDS, ...SPECIAL_PAY_FIELDS].reduce((s, f) => s + (income[f.key] || 0), 0);
  const extraIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalIncome = militaryIncome + extraIncome;
  const investmentFixed = month
    ? investmentForMonth(
        fixed.filter((f) => f.is_investment),
        month,
      )
    : fixed.reduce(
        (s, f) => (f.is_investment ? s + (f.period === 'annual' ? f.amount / 12 : f.amount) : s),
        0,
      );
  const fixedExpenses = fixed.reduce(
    (s, f) => (f.is_investment ? s : s + (f.period === 'annual' ? f.amount / 12 : f.amount)),
    0,
  );
  const debtPayments = debts
    .filter((d) => d.balance > 0)
    .reduce((s, d) => s + d.monthly_payment, 0);
  const committed = fixedExpenses + debtPayments;
  const investmentTxs = txs
    .filter((t) => t.category === INVESTMENT_CATEGORY)
    .reduce((s, t) => s + t.amount, 0);
  const spending = txs
    .filter((t) => t.category !== INVESTMENT_CATEGORY)
    .reduce((s, t) => s + t.amount, 0);
  const combatZone = !!income.combat_zone;
  const deductions =
    tsp +
    DEDUCTION_FIELDS.reduce(
      (s, f) => s + (combatZone && f.key === 'taxes' ? 0 : income[f.key] || 0),
      0,
    );
  const allotments =
    month && allotmentList
      ? allotmentList
          .filter((a) => a.start_date <= month && (!a.end_date || a.end_date >= month))
          .reduce((s, a) => s + a.amount, 0)
      : 0;
  const totalInvested = investmentFixed + investmentTxs;
  const net = totalIncome - deductions - allotments - committed - spending - investmentTxs;
  const savingsRate =
    totalIncome > 0
      ? Math.round(((tsp + totalInvested + Math.max(0, net)) / totalIncome) * 100)
      : 0;
  return {
    totalIncome,
    tsp,
    investmentFixed: totalInvested,
    committed,
    spending,
    allotments,
    net,
    savingsRate,
  };
}

// ── Month picker (shared inline component) ────────────────────────────────────

function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const yearRange = getYearRange();
  return (
    <div className="flex items-center gap-0.5">
      {month !== currentMonth() && (
        <button
          onClick={() => onChange(currentMonth())}
          className="mr-1 text-[10px] font-medium text-[#4a8cff] transition-colors hover:text-[#4a8cff]/70"
          title="Jump to current month"
        >
          Today
        </button>
      )}
      <button
        onClick={() => onChange(prevMonth(month))}
        className="text-text-3 hover:text-text-2 hover:bg-surface-raised flex h-7 w-7 items-center justify-center rounded-lg text-base leading-none transition-all"
      >
        ‹
      </button>
      <div className="bg-surface-raised border-border flex items-center rounded-lg border px-1">
        <select
          value={month.slice(5)}
          onChange={(e) => onChange(`${month.slice(0, 4)}-${e.target.value}`)}
          className="text-text cursor-pointer bg-transparent px-1 py-0.5 text-sm focus:outline-none"
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
          onChange={(e) => onChange(`${e.target.value}-${month.slice(5)}`)}
          className="text-text cursor-pointer bg-transparent px-1 py-0.5 text-sm focus:outline-none"
        >
          {yearRange.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => onChange(nextMonth(month))}
        className="text-text-3 hover:text-text-2 hover:bg-surface-raised flex h-7 w-7 items-center justify-center rounded-lg text-base leading-none transition-all"
      >
        ›
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [month, setMonth] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null);
  const [currentIncome, setCurrentIncome] = useState<IncomeConfig | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [streak, setStreak] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [nwVersion, setNwVersion] = useState(0);

  // Sub-tab state
  const [paySub, setPaySub] = useState<PaySub>('pay');
  const [spendingSub, setSpendingSub] = useState<SpendingSub>('transactions');
  const [wealthSub, setWealthSub] = useState<WealthSub>('net-worth');
  const [assetsSub, setAssetsSub] = useState<AssetsSub>('assets');
  const [planSub, setPlanSub] = useState<PlanSub>('overview');

  useEffect(() => {
    setMonth(currentMonth());
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    setTheme(saved ?? 'system');
    void authClient.getSession().then(({ data }) => {
      if (data?.user?.id) setUser(data.user as unknown as UserProfile);
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setTab('spending');
        setSpendingSub('transactions');
        setTimeout(() => {
          (document.querySelector('[data-search-input]') as HTMLInputElement)?.focus();
        }, 50);
        return;
      }

      if (isInput) return;

      if (e.key === 'ArrowLeft') setMonth((m) => (m ? prevMonth(m) : m));
      if (e.key === 'ArrowRight') setMonth((m) => (m ? nextMonth(m) : m));

      // 1–5 switch tabs
      const tabIndex = parseInt(e.key) - 1;
      if (tabIndex >= 0 && tabIndex < TABS.length) setTab(TABS[tabIndex].key);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    if (!month) return;
    const pm = prevMonth(month);
    try {
      const [income, fixed, txs, debts, entries, allotmentList, pIncome, pTxs, pEntries] =
        await Promise.all([
          api.income.get(month).then((d) => {
            setCurrentIncome(d);
            return d;
          }),
          api.fixedExpenses.list(),
          api.transactions.list(month),
          api.debts.list(),
          api.incomeEntries.list(month),
          api.allotments.list(),
          api.income.get(pm),
          api.transactions.list(pm),
          api.incomeEntries.list(pm),
        ]);
      const joinedAt = user?.joined_at || undefined;
      setSummary(calcSummary(income, fixed, txs, debts, entries, joinedAt, month, allotmentList));
      setPrevSummary(
        calcSummary(pIncome, fixed, pTxs, debts, pEntries, joinedAt, pm, allotmentList),
      );
      void api.streak.get().then((r) => setStreak(r.streak));
      void api.assets.list().then(setAssets);
      void api.debts.list().then(setDebts);
      void api.goals.list().then(setGoals);
      void api.healthScore.get().then(setHealthScore);
    } catch {
      /* network error — silently ignore */
    }
  }, [month, user]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  // ── Actions ─────────────────────────────────────────────────────────────────

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
    const data = JSON.parse(await file.text()) as unknown;
    const res = await api.backup.restore(data);
    if (res.ok) {
      alert(`Restored ${res.restored ?? 0} records.`);
      void fetchSummary();
    } else {
      alert(`Restore failed: ${res.error}`);
    }
  }

  function handleCategoryDrill(category: string) {
    setDrillCategory(category);
    setTab('spending');
    setSpendingSub('transactions');
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

  const tabKeys = TABS.map((t) => t.key);
  function handleTabKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setTab(tabKeys[(idx + 1) % tabKeys.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setTab(tabKeys[(idx - 1 + tabKeys.length) % tabKeys.length]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setTab(tabKeys[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      setTab(tabKeys[tabKeys.length - 1]);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-bg min-h-screen">
      {/* ── Header ── */}
      <header className="border-border bg-bg/95 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          {/* Brand */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, #4a8cff 0%, #00d98a 100%)' }}
            >
              F
            </div>
            <div>
              <h1 className="text-text text-sm leading-none font-bold tracking-tight">
                {APP_CONFIG.title}
              </h1>
              <p className="text-text-4 mt-0.5 text-[10px] leading-none tracking-wide">
                {user
                  ? [user.pay_grade, user.mos, user.duty_station].filter(Boolean).join(' · ') ||
                    APP_CONFIG.subtitle
                  : APP_CONFIG.subtitle}
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              title={`Theme: ${theme} — click to cycle`}
              className="text-text-3 hover:text-text-2 hover:bg-surface-raised flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-all"
            >
              {theme === 'light' ? '☀' : theme === 'dark' ? '🌙' : '◐'}
            </button>
            {user && (
              <UserNav
                user={user}
                onExport={handleExport}
                onRestore={handleRestore}
                onProfileUpdate={() =>
                  void authClient.getSession().then(({ data }) => {
                    if (data?.user?.id) setUser(data.user as unknown as UserProfile);
                  })
                }
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        {/* ── Primary tab nav ── */}
        <div className="bg-surface border-border overflow-hidden rounded-2xl border">
          <nav className="border-border border-b">
            <div role="tablist" aria-label="Main navigation" className="flex">
              {TABS.map(({ key, label, icon }, idx) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  aria-controls={`panel-${key}`}
                  id={`tab-${key}`}
                  tabIndex={tab === key ? 0 : -1}
                  onClick={() => setTab(key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-all ${
                    tab === key
                      ? 'text-text'
                      : 'text-text-3 hover:text-text-2 hover:bg-surface-raised/50'
                  }`}
                >
                  <span className={`text-xs ${tab === key ? 'opacity-70' : 'opacity-40'}`}>
                    {icon}
                  </span>
                  {label}
                  {tab === key && (
                    <span
                      className="absolute right-1/4 bottom-0 left-1/4 h-0.5 rounded-t-full"
                      style={{ background: 'linear-gradient(90deg, #4a8cff, #00d98a)' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* ── Panel content ── */}
          <div className="p-5">
            {/* ─ Dashboard ─ */}
            {tab === 'dashboard' && (
              <div key="dashboard" className="animate-fade-in space-y-5">
                {/* Month picker */}
                {month && (
                  <div className="flex items-center justify-between">
                    <h2 className="text-text font-semibold">
                      {new Date(month + '-02').toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </h2>
                    <MonthPicker month={month} onChange={setMonth} />
                  </div>
                )}

                {/* Combat zone indicator */}
                {currentIncome?.combat_zone ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                    <span className="text-sm">⚔</span>
                    <div>
                      <span className="text-xs font-semibold text-emerald-400">
                        Combat zone tax exclusion active
                      </span>
                      {(currentIncome.taxes ?? 0) > 0 && (
                        <span className="ml-2 text-[11px] text-emerald-500/70">
                          ~{formatCurrency(currentIncome.taxes ?? 0)}/mo exempted
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}

                {summary && (
                  <>
                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                      <MetricCard
                        label="Total income"
                        value={formatCurrency(summary.totalIncome)}
                        delta={delta(summary.totalIncome, prevSummary?.totalIncome, true)}
                        tooltip="All base pay, allowances, and additional income for the month"
                        onClick={() => {
                          setTab('pay');
                          setPaySub('pay');
                        }}
                      />
                      <MetricCard
                        label="Invested"
                        value={formatCurrency(summary.tsp + summary.investmentFixed)}
                        accent="blue"
                        delta={delta(
                          summary.tsp + summary.investmentFixed,
                          prevSummary ? prevSummary.tsp + prevSummary.investmentFixed : undefined,
                          true,
                        )}
                        tooltip="TSP contributions + fixed investment expenses + Investment-category transactions"
                        onClick={() => {
                          setTab('pay');
                          setPaySub('pay');
                        }}
                      />
                      <MetricCard
                        label="Committed"
                        value={formatCurrency(summary.committed)}
                        accent="amber"
                        delta={delta(summary.committed, prevSummary?.committed, null)}
                        tooltip="Fixed recurring bills + active debt payments"
                        onClick={() => {
                          setTab('spending');
                          setSpendingSub('bills');
                        }}
                      />
                      <MetricCard
                        label={APP_CONFIG.transactionsTabLabel}
                        value={formatCurrency(summary.spending)}
                        sub={projectedSpending(month, summary.spending)}
                        accent="red"
                        delta={delta(summary.spending, prevSummary?.spending, false)}
                        tooltip="Discretionary transaction spending (excludes Investment category)"
                        onClick={() => {
                          setTab('spending');
                          setSpendingSub('transactions');
                        }}
                      />
                      <MetricCard
                        label="Net remaining"
                        value={(summary.net >= 0 ? '+' : '') + formatCurrency(summary.net)}
                        accent={summary.net >= 0 ? 'green' : 'red'}
                        delta={delta(summary.net, prevSummary?.net, true)}
                        tooltip="Income − invested − committed − spending"
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
                        delta={delta(summary.savingsRate, prevSummary?.savingsRate, true, true)}
                        tooltip="(Invested + max(0, Net)) ÷ Income — target ≥ 20%"
                        onClick={() => {
                          setTab('plan');
                          setPlanSub('overview');
                        }}
                      />
                    </div>

                    {/* Budget allocation bar */}
                    {summary.totalIncome > 0 && <BudgetBar summary={summary} />}

                    {/* Spending anomaly alerts */}
                    {month && <SpendingAnomalyBanner month={month} />}

                    {/* Net worth + Health score */}
                    <div className="section-divider grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <NetWorthCard
                        assets={assets}
                        debts={debts}
                        goals={goals}
                        onClick={() => setTab('wealth')}
                      />
                      {healthScore && (
                        <HealthScoreCard
                          score={healthScore}
                          onClick={() => {
                            setTab('wealth');
                            setWealthSub('net-worth');
                          }}
                        />
                      )}
                    </div>

                    {/* Streak */}
                    {streak >= 2 && (
                      <StreakBanner
                        streak={streak}
                        onClick={() => {
                          setTab('plan');
                          setPlanSub('overview');
                        }}
                      />
                    )}

                    {/* Budget vs actual — quick view */}
                    <div className="section-divider">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-text-3 text-[11px] font-semibold tracking-wider uppercase">
                          Budget vs actual
                        </p>
                        <button
                          onClick={() => {
                            setTab('spending');
                            setSpendingSub('budget');
                          }}
                          className="text-text-4 hover:text-accent-blue text-[11px] transition-colors"
                        >
                          Manage budgets →
                        </button>
                      </div>
                      <BudgetActualPanel month={month} monthlyIncome={summary.totalIncome} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─ Pay ─ */}
            {tab === 'pay' && (
              <div key="pay" className="animate-fade-in">
                <div className="mb-4 flex items-center justify-between">
                  <SubNav
                    options={[
                      { key: 'pay', label: 'Pay & deductions' },
                      { key: 'tax', label: 'Tax summary' },
                      { key: 'leave', label: 'Leave & receivables' },
                    ]}
                    active={paySub}
                    onChange={(k) => setPaySub(k as PaySub)}
                  />
                  {month && <MonthPicker month={month} onChange={setMonth} />}
                </div>

                {paySub === 'pay' && (
                  <div className="space-y-8">
                    <IncomePanel month={month} onUpdate={fetchSummary} />
                    <ContributionLimitsPanel year={parseInt(month.slice(0, 4))} />
                  </div>
                )}
                {paySub === 'tax' && <TaxYearSummaryPanel year={parseInt(month.slice(0, 4))} />}
                {paySub === 'leave' && (
                  <div className="space-y-8">
                    <ReceivablesPanel month={month} onUpdate={fetchSummary} />
                    <LeavePanel
                      basePay={currentIncome?.base_pay ?? 0}
                      joinedAt={user?.joined_at ?? ''}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ─ Spending ─ */}
            {tab === 'spending' && (
              <div key="spending" className="animate-fade-in">
                <div className="mb-4 flex items-center justify-between">
                  <SubNav
                    options={[
                      { key: 'transactions', label: 'Transactions' },
                      { key: 'bills', label: 'Fixed bills' },
                      { key: 'budget', label: 'Budget' },
                      { key: 'calendar', label: 'Calendar' },
                    ]}
                    active={spendingSub}
                    onChange={(k) => setSpendingSub(k as SpendingSub)}
                  />
                  {month && <MonthPicker month={month} onChange={setMonth} />}
                </div>

                {spendingSub === 'transactions' && (
                  <TransactionsPanel
                    month={month}
                    onUpdate={fetchSummary}
                    initialCategory={drillCategory}
                  />
                )}
                {spendingSub === 'bills' && (
                  <div className="space-y-8">
                    <FixedExpensesPanel month={month} onUpdate={fetchSummary} />
                    <RecurringDetectionPanel onUpdate={fetchSummary} />
                    <AutoCategorizationPanel />
                  </div>
                )}
                {spendingSub === 'budget' && (
                  <BudgetActualPanel month={month} monthlyIncome={summary?.totalIncome} />
                )}
                {spendingSub === 'calendar' && (
                  <CashFlowCalendar
                    month={month}
                    netMonthlyIncome={
                      summary ? summary.net + summary.committed + summary.spending : undefined
                    }
                  />
                )}
              </div>
            )}

            {/* ─ Wealth ─ */}
            {tab === 'wealth' && (
              <div key="wealth" className="animate-fade-in">
                <SubNav
                  options={[
                    { key: 'net-worth', label: 'Net worth' },
                    { key: 'goals', label: 'Goals' },
                    { key: 'analytics', label: 'Analytics' },
                  ]}
                  active={wealthSub}
                  onChange={(k) => setWealthSub(k as WealthSub)}
                />

                {wealthSub === 'net-worth' && (
                  <div className="space-y-4">
                    <NetWorthTrend onUpdate={nwVersion} />
                    <SubNav
                      options={[
                        { key: 'assets', label: 'Assets' },
                        { key: 'debts', label: 'Debts' },
                      ]}
                      active={assetsSub}
                      onChange={(k) => setAssetsSub(k as AssetsSub)}
                    />
                    {assetsSub === 'assets' && (
                      <AssetsPanel
                        onUpdate={() => {
                          void fetchSummary();
                          setNwVersion((v) => v + 1);
                        }}
                      />
                    )}
                    {assetsSub === 'debts' && (
                      <DebtsPanel
                        onUpdate={() => {
                          void fetchSummary();
                          setNwVersion((v) => v + 1);
                        }}
                      />
                    )}
                  </div>
                )}

                {wealthSub === 'goals' && <GoalsPanel />}

                {wealthSub === 'analytics' && (
                  <div className="space-y-8">
                    <YtdPanel month={month} />
                    <AnalyticsPanel month={month} onCategoryClick={handleCategoryDrill} />
                  </div>
                )}
              </div>
            )}

            {/* ─ Plan ─ */}
            {tab === 'plan' && (
              <div key="plan" className="animate-fade-in">
                <SubNav
                  options={[
                    { key: 'overview', label: 'Annual overview' },
                    { key: 'projections', label: 'Projections' },
                    { key: 'pcs', label: 'PCS' },
                  ]}
                  active={planSub}
                  onChange={(k) => setPlanSub(k as PlanSub)}
                />

                {planSub === 'overview' && (
                  <OverviewPanel
                    initialYear={month ? parseInt(month.slice(0, 4)) : new Date().getFullYear()}
                  />
                )}
                {planSub === 'projections' && (
                  <div className="space-y-8">
                    <PayCareerArcPanel user={user} tspRate={currentIncome?.tsp_rate ?? 0.05} />
                    <PromoProjectionPanel user={user} />
                    <BrsPanel user={user} month={month} />
                    <SdpPanel />
                    <GiBillPanel yearsOfService={user?.years_of_service ?? 0} />
                  </div>
                )}
                {planSub === 'pcs' && <PcsPanel user={user} />}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Keyboard shortcuts overlay ── */}
      {showShortcuts && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            className="bg-bg border-border w-80 rounded-2xl border p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-text text-sm font-semibold">Keyboard shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-text-4 hover:text-text-2 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-xs">
              {[
                ['← / →', 'Previous / next month'],
                ['1 – 5', 'Switch tab'],
                ['/', 'Focus transaction search'],
                ['?', 'Toggle this help'],
                ['Esc', 'Close overlay'],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="border-border-dim flex items-center justify-between border-b py-1.5 last:border-0"
                >
                  <kbd className="bg-surface border-border text-text-2 rounded border px-2 py-0.5 font-mono text-[11px]">
                    {key}
                  </kbd>
                  <span className="text-text-3">{desc}</span>
                </div>
              ))}
            </div>
            <div className="text-text-4 mt-4 text-center text-[10px]">
              1 Dashboard · 2 Pay · 3 Spending · 4 Wealth · 5 Plan
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function projectedSpending(month: string, spending: number): string | null {
  const today = new Date();
  const cm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month !== cm) return null;
  const day = today.getDate();
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (day < 3 || day >= totalDays) return null;
  const projected = Math.round((spending / day) * totalDays);
  return `→ ${formatCurrency(projected)} projected`;
}
