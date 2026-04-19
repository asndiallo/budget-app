'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { BTN_BLUE_CLS, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { Debt } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

import EditableText from './EditableText';
import ExternalLink from './ExternalLink';

type PaymentSuggestion = Awaited<ReturnType<typeof api.debts.detectPayments>>[number];

// SCRA caps pre-service debt interest at 6% while on active duty
const SCRA_CAP = 6;

export default function DebtsPanel({ onUpdate }: { onUpdate: () => void }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [suggestions, setSuggestions] = useState<PaymentSuggestion[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newLender, setNewLender] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [newRate, setNewRate] = useState('');

  const reload = () => api.debts.list().then(setDebts);
  const reloadSuggestions = () => api.debts.detectPayments().then(setSuggestions);

  useEffect(() => {
    reload();
    reloadSuggestions();
  }, []);

  async function applyPayment(s: PaymentSuggestion) {
    await api.debts.applyPayment(s.debtId, s.transactionId, s.txAmount);
    setSuggestions((prev) => prev.filter((x) => x.transactionId !== s.transactionId));
    reload();
    onUpdate();
  }

  function dismissSuggestion(transactionId: number) {
    setSuggestions((prev) => prev.filter((s) => s.transactionId !== transactionId));
  }

  async function addDebt() {
    if (!newLabel.trim()) return;
    await api.debts.add({
      label: newLabel.trim(),
      lender: newLender.trim(),
      balance: parseFloat(newBalance) || 0,
      monthly_payment: parseFloat(newPayment) || 0,
      interest_rate: parseFloat(newRate) || 0,
    });
    setAdding(false);
    setNewLabel('');
    setNewLender('');
    setNewBalance('');
    setNewPayment('');
    setNewRate('');
    reload();
    onUpdate();
  }

  async function removeDebt(id: number) {
    await api.debts.remove(id);
    reload();
    onUpdate();
  }

  async function updateField(debt: Debt, field: keyof Omit<Debt, 'id'>, raw: string) {
    const isNumeric = field !== 'label' && field !== 'lender';
    const value = isNumeric ? (raw.trim() ? parseFloat(raw) : null) : raw;
    // Always send the full object so non-COALESCE PATCH doesn't wipe unrelated fields.
    await api.debts.update(debt.id, { ...debt, [field]: value });
    reload();
    onUpdate();
  }

  const activeTotal = debts.filter((d) => d.balance > 0).reduce((s, d) => s + d.monthly_payment, 0);

  return (
    <div>
      {/* Detected payment suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className={LABEL_CLS}>Detected payments</p>
          {suggestions.map((s) => (
            <div key={s.transactionId} className="border-border bg-bg rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-text truncate text-sm font-medium">{s.txDescription}</p>
                  <p className="text-text-3 mt-0.5 text-xs">
                    <span className="font-mono text-[#f5aa2a]">{formatCurrency(s.txAmount)}</span>
                    {' · '}
                    {s.txMonth}
                    {' · matches '}
                    <span className="text-text-2">{s.debtLabel}</span>
                    {s.debtLender && s.debtLender !== s.debtLabel && (
                      <span className="text-text-4"> ({s.debtLender})</span>
                    )}
                  </p>
                  <p className="text-text-4 mt-1 text-xs">
                    Balance <span className="font-mono">{formatCurrency(s.debtBalance)}</span>
                    {' → '}
                    <span className="font-mono text-[#00d98a]">
                      {formatCurrency(s.suggestedBalance)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => applyPayment(s)}
                    className={`px-2.5 py-1 text-xs ${BTN_BLUE_CLS}`}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => dismissSuggestion(s.transactionId)}
                    className="text-text-4 hover:text-text-2 text-xs transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Debts & loans</h3>
        {activeTotal > 0 && (
          <span className="font-mono text-xs text-[#f5aa2a]">
            {formatCurrency(activeTotal)}/mo committed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {debts.map((d) => (
          <DebtRow key={d.id} debt={d} onUpdate={updateField} onRemove={removeDebt} />
        ))}
      </div>

      <DebtStrategy debts={debts} />

      {adding ? (
        <div className="bg-bg border-border mt-3 space-y-3 rounded-xl border p-4">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Car Loan)"
              className={`flex-1 ${INPUT_CLS}`}
            />
            <input
              value={newLender}
              onChange={(e) => setNewLender(e.target.value)}
              placeholder="Lender"
              className={`flex-1 ${INPUT_CLS}`}
            />
          </div>
          <div className="flex gap-2">
            <input
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="Balance $"
              type="number"
              className={`flex-1 font-mono ${INPUT_CLS}`}
            />
            <input
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              placeholder="Monthly $"
              type="number"
              className={`flex-1 font-mono ${INPUT_CLS}`}
            />
            <input
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="Rate %"
              type="number"
              className={`w-24 font-mono ${INPUT_CLS}`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="border-border text-text-2 hover:text-text rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <button onClick={addDebt} className={`px-3 py-1.5 text-sm ${BTN_BLUE_CLS}`}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-text-3 mt-3 text-sm transition-colors hover:text-[#4a8cff]"
        >
          + Add debt / loan
        </button>
      )}
    </div>
  );
}

interface PayoffInfo {
  months: number;
  totalInterest: number;
}

function calcPayoff(debt: Debt): PayoffInfo | null {
  if (debt.balance <= 0 || debt.monthly_payment <= 0) return null;
  if (debt.interest_rate === 0) {
    return {
      months: Math.ceil(debt.balance / debt.monthly_payment),
      totalInterest: 0,
    };
  }
  const r = debt.interest_rate / 100 / 12;
  if (debt.monthly_payment <= debt.balance * r) return null; // payment can't cover interest
  const n = -Math.log(1 - (r * debt.balance) / debt.monthly_payment) / Math.log(1 + r);
  const months = Math.ceil(n);
  return {
    months,
    totalInterest: Math.round(debt.monthly_payment * months - debt.balance),
  };
}

function payoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function DebtRow({
  debt,
  onUpdate,
  onRemove,
}: {
  debt: Debt;
  onUpdate: (debt: Debt, field: keyof Omit<Debt, 'id'>, value: string) => void;
  onRemove: (id: number) => void;
}) {
  const isPaidOff = debt.balance === 0;
  const [showAmort, setShowAmort] = useState(false);
  const [extraPayment, setExtraPayment] = useState('');
  const scraMayApply = !isPaidOff && debt.interest_rate > SCRA_CAP && debt.balance > 0;

  const extra = parseFloat(extraPayment) || 0;
  const debtWithExtra: Debt =
    extra > 0 ? { ...debt, monthly_payment: debt.monthly_payment + extra } : debt;

  return (
    <div
      className={`rounded-xl border p-3.5 transition-opacity ${
        isPaidOff ? 'border-border-dim bg-bg opacity-40' : 'border-border bg-bg'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <EditableText
              value={debt.label}
              className="text-text text-sm font-semibold"
              onSave={(v) => onUpdate(debt, 'label', v)}
            />
            <EditableText
              value={debt.lender || 'Add lender'}
              className={`text-xs ${debt.lender ? 'text-text-3' : 'text-text-4'}`}
              onSave={(v) => onUpdate(debt, 'lender', v)}
            />
            {isPaidOff && (
              <span className="rounded-full bg-[#00d98a]/10 px-2 py-0.5 text-[11px] text-[#00d98a]">
                Paid off
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4">
            <Field
              label="Balance"
              value={debt.balance}
              prefix="$"
              onSave={(v) => onUpdate(debt, 'balance', v)}
            />
            <Field
              label="Monthly"
              value={debt.monthly_payment}
              prefix="$"
              onSave={(v) => onUpdate(debt, 'monthly_payment', v)}
            />
            <Field
              label="Rate"
              value={debt.interest_rate}
              suffix="%"
              onSave={(v) => onUpdate(debt, 'interest_rate', v)}
            />
            <Field
              label="Due"
              value={debt.day_of_month ?? 0}
              suffix={debt.day_of_month ? 'th' : ''}
              placeholder="day"
              onSave={(v) => onUpdate(debt, 'day_of_month', v)}
            />
          </div>
          {!isPaidOff &&
            (() => {
              const info = calcPayoff(debt);
              if (!info) return null;
              return (
                <div className="border-border-dim mt-2 flex flex-wrap items-center gap-4 border-t pt-2">
                  <span className="text-text-3 text-[11px]">
                    Paid off <span className="text-text font-mono">~{payoffDate(info.months)}</span>{' '}
                    <span className="text-text-4">({info.months} mo)</span>
                  </span>
                  {info.totalInterest > 0 && (
                    <span className="text-text-3 text-[11px]">
                      Total interest{' '}
                      <span className="font-mono text-[#ff4560]">
                        ${info.totalInterest.toLocaleString()}
                      </span>
                    </span>
                  )}
                  <button
                    onClick={() => setShowAmort((v) => !v)}
                    className="text-text-4 ml-auto text-[11px] transition-colors hover:text-[#4a8cff]"
                  >
                    {showAmort ? 'Hide schedule ↑' : 'Show schedule ↓'}
                  </button>
                </div>
              );
            })()}

          {showAmort && !isPaidOff && (
            <AmortizationSchedule
              debt={debt}
              extra={extra}
              extraPayment={extraPayment}
              onExtraChange={setExtraPayment}
            />
          )}

          {scraMayApply && (
            <div className="border-border-dim mt-2 flex items-start gap-2 border-t pt-2">
              <span className="mt-0.5 shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-[#4a8cff]">
                SCRA
              </span>
              <p className="text-text-3 text-[11px] leading-snug">
                Rate {debt.interest_rate}% may be reducible to {SCRA_CAP}% on pre-service debts
                under the Servicemembers Civil Relief Act — send written notice to your lender.{' '}
                <ExternalLink
                  href="https://www.militaryonesource.mil/financial-legal/legal/servicemembers-civil-relief-act/"
                  label="Learn more"
                />
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(debt.id)}
          className="text-text-3 mt-0.5 shrink-0 text-xs transition-colors hover:text-[#ff4560]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function AmortizationSchedule({
  debt,
  extra,
  extraPayment,
  onExtraChange,
}: {
  debt: Debt;
  extra: number;
  extraPayment: string;
  onExtraChange: (v: string) => void;
}) {
  const baseInfo = calcPayoff(debt);
  const withExtra =
    extra > 0 ? calcPayoff({ ...debt, monthly_payment: debt.monthly_payment + extra }) : null;

  // Build yearly milestones
  const milestones = buildYearlyMilestones(debt, extra);

  return (
    <div className="border-border-dim mt-3 space-y-3 border-t pt-3">
      {/* Extra payment input */}
      <div className="flex items-center gap-2">
        <span className="text-text-3 shrink-0 text-[11px]">Extra payment/mo</span>
        <span className="text-text-3 text-[11px]">$</span>
        <input
          type="number"
          min="0"
          value={extraPayment}
          onChange={(e) => onExtraChange(e.target.value)}
          placeholder="0"
          className="bg-bg border-border text-text w-20 rounded border px-2 py-0.5 font-mono text-xs transition-colors focus:border-blue-500 focus:outline-none"
        />
        {withExtra && baseInfo && (
          <span className="font-mono text-[11px] text-[#00d98a]">
            saves {formatCurrency(baseInfo.totalInterest - withExtra.totalInterest)} ·{' '}
            {baseInfo.months - withExtra.months} mo faster
          </span>
        )}
      </div>

      {/* Year-by-year table */}
      {milestones.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-text-4 border-border-dim border-b">
                <th className="pb-1 text-left font-medium">Year</th>
                <th className="pb-1 text-right font-medium">Balance</th>
                <th className="pb-1 text-right font-medium">Paid</th>
                <th className="pb-1 text-right font-medium">Interest</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr
                  key={m.year}
                  className="border-border-dim/50 hover:bg-surface-raised/30 border-b transition-colors"
                >
                  <td className="text-text-3 py-1 font-mono">{m.year}</td>
                  <td className="text-text py-1 text-right font-mono">
                    {formatCurrency(m.balance)}
                  </td>
                  <td className="py-1 text-right font-mono text-[#4a8cff]">
                    {formatCurrency(m.principal)}
                  </td>
                  <td className="py-1 text-right font-mono text-[#ff4560]/80">
                    {formatCurrency(m.interest)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface YearlyMilestone {
  year: number;
  balance: number;
  principal: number;
  interest: number;
}

function buildYearlyMilestones(debt: Debt, extraPayment: number): YearlyMilestone[] {
  if (debt.balance <= 0 || debt.monthly_payment <= 0) return [];
  const monthly = debt.monthly_payment + extraPayment;
  const r = debt.interest_rate / 100 / 12;
  if (r > 0 && monthly <= debt.balance * r) return [];

  let balance = debt.balance;
  const currentYear = new Date().getFullYear();
  const milestones: YearlyMilestone[] = [];

  for (let yr = 0; yr < 50 && balance > 0.01; yr++) {
    let yearInterest = 0;
    let yearPrincipal = 0;
    for (let mo = 0; mo < 12 && balance > 0.01; mo++) {
      const interest = balance * r;
      const principal = Math.min(monthly - interest, balance);
      yearInterest += interest;
      yearPrincipal += principal;
      balance = Math.max(0, balance - principal);
    }
    milestones.push({
      year: currentYear + yr,
      balance: Math.max(0, balance),
      principal: Math.round(yearPrincipal),
      interest: Math.round(yearInterest),
    });
    if (balance <= 0.01) break;
  }
  return milestones;
}

function Field({
  label,
  value,
  prefix = '',
  suffix = '',
  placeholder,
  onSave,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ? String(value) : '');

  if (editing) {
    return (
      <span className="text-text-2 flex items-center gap-0.5 text-xs">
        <span className="text-text-3">{label}</span>
        <span className="text-text-3">{prefix}</span>
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onSave(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(draft);
              setEditing(false);
            }
            if (e.key === 'Escape') {
              setDraft(String(value));
              setEditing(false);
            }
          }}
          className="text-text w-20 border-b border-[#4a8cff]/50 bg-transparent font-mono outline-none"
        />
        <span className="text-text-3">{suffix}</span>
      </span>
    );
  }
  return (
    <span
      className="hover:text-text-2 cursor-pointer text-xs transition-colors"
      onClick={() => {
        setDraft(value ? String(value) : '');
        setEditing(true);
      }}
    >
      <span className="text-text-3 font-sans">{label} </span>
      {value ? (
        <span className="text-text-3 font-mono">
          {prefix}
          {value.toLocaleString()}
          {suffix}
        </span>
      ) : (
        <span className="text-text-4 font-sans">{placeholder ?? '—'}</span>
      )}
    </span>
  );
}

/* ── Debt payoff strategy comparison ─────────────────────────────── */

interface SimResult {
  months: number;
  totalInterest: number;
}

function simulatePayoff(debts: Debt[], order: number[]): SimResult {
  const balances = debts.map((d) => d.balance);
  const rates = debts.map((d) => d.interest_rate / 100 / 12);
  const minPayments = debts.map((d) => d.monthly_payment);
  const totalBudget = minPayments.reduce((s, p) => s + p, 0);

  let totalInterest = 0;
  let month = 0;

  while (balances.some((b) => b > 0.01) && month < 600) {
    month++;

    // Accrue interest
    for (let i = 0; i < debts.length; i++) {
      if (balances[i] > 0.01) {
        const interest = balances[i] * rates[i];
        totalInterest += interest;
        balances[i] += interest;
      }
    }

    // Pay minimums on all non-focus debts
    let remaining = totalBudget;
    const focusIdx = order.find((idx) => balances[idx] > 0.01);
    for (let i = 0; i < debts.length; i++) {
      if (i === focusIdx || balances[i] <= 0.01) continue;
      const pay = Math.min(minPayments[i], balances[i]);
      balances[i] -= pay;
      remaining -= pay;
    }

    // Apply remainder to focus debt
    if (focusIdx !== undefined && remaining > 0) {
      balances[focusIdx] = Math.max(0, balances[focusIdx] - remaining);
    }
  }

  return { months: month, totalInterest: Math.round(totalInterest) };
}

function DebtStrategy({ debts }: { debts: Debt[] }) {
  const active = debts.filter((d) => d.balance > 0 && d.monthly_payment > 0);
  if (active.length < 2) return null;

  const indices = active.map((_, i) => i);

  // Current order (as entered)
  const current = simulatePayoff(active, indices);

  // Avalanche: highest interest rate first
  const avalancheOrder = [...indices].sort(
    (a, b) => active[b].interest_rate - active[a].interest_rate,
  );
  const avalanche = simulatePayoff(active, avalancheOrder);

  // Snowball: lowest balance first
  const snowballOrder = [...indices].sort((a, b) => active[a].balance - active[b].balance);
  const snowball = simulatePayoff(active, snowballOrder);

  const best = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball';
  const bestResult = best === 'avalanche' ? avalanche : snowball;
  const bestOrder = best === 'avalanche' ? avalancheOrder : snowballOrder;
  const saved = current.totalInterest - bestResult.totalInterest;

  const rows = [
    {
      label: 'Avalanche',
      sub: 'Highest rate first',
      result: avalanche,
      order: avalancheOrder,
      isBest: best === 'avalanche',
    },
    {
      label: 'Snowball',
      sub: 'Lowest balance first',
      result: snowball,
      order: snowballOrder,
      isBest: best === 'snowball',
    },
  ];

  return (
    <div className="border-border-dim mt-4 border-t pt-4">
      <h4 className={`${LABEL_CLS} mb-3`}>Payoff strategy</h4>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(({ label, sub, result, order: ord, isBest }) => (
          <div
            key={label}
            className={`rounded-xl border p-3 transition-colors ${
              isBest ? 'border-[#00d98a]/30 bg-[#00d98a]/5' : 'border-border bg-bg'
            }`}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-text text-xs font-semibold">{label}</span>
              {isBest && (
                <span className="rounded-full bg-[#00d98a]/10 px-1.5 py-0.5 text-[10px] text-[#00d98a]">
                  recommended
                </span>
              )}
            </div>
            <p className="text-text-3 mb-2 text-[11px]">{sub}</p>
            <p className="text-text-2 font-mono text-xs">
              {formatCurrency(result.totalInterest)}{' '}
              <span className="text-text-4">interest · {result.months} mo</span>
            </p>
            <p className="text-text-4 mt-1 text-[10px]">
              Focus: <span className="text-text-2">{active[ord[0]]?.label}</span>
              {ord.length > 1 && <> → {active[ord[1]]?.label}</>}
            </p>
          </div>
        ))}
      </div>
      {saved > 50 && (
        <p className="mt-2 text-[11px] text-[#00d98a]">
          {best === 'avalanche' ? 'Avalanche' : 'Snowball'} saves{' '}
          <span className="font-mono">{formatCurrency(saved)}</span> in interest vs current order.
        </p>
      )}
    </div>
  );
}
