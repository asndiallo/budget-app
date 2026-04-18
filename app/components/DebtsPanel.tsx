'use client';

import { BTN_BLUE_CLS, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import { useEffect, useState } from 'react';

import type { Debt } from '@/lib/types';
import EditableText from './EditableText';
import ExternalLink from './ExternalLink';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

// SCRA caps pre-service debt interest at 6% while on active duty
const SCRA_CAP = 6;

export default function DebtsPanel({ onUpdate }: { onUpdate: () => void }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newLender, setNewLender] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [newRate, setNewRate] = useState('');

  const reload = () => api.debts.list().then(setDebts);
  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function updateField(
    debt: Debt,
    field: keyof Omit<Debt, 'id'>,
    raw: string,
  ) {
    const isNumeric = field !== 'label' && field !== 'lender';
    const value = isNumeric ? (raw.trim() ? parseFloat(raw) : null) : raw;
    // Always send the full object so non-COALESCE PATCH doesn't wipe unrelated fields.
    await api.debts.update(debt.id, { ...debt, [field]: value });
    reload();
    onUpdate();
  }

  const activeTotal = debts
    .filter((d) => d.balance > 0)
    .reduce((s, d) => s + d.monthly_payment, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className={LABEL_CLS}>Debts & loans</h3>
        {activeTotal > 0 && (
          <span className="font-mono text-xs text-[#f5aa2a]">
            {formatCurrency(activeTotal)}/mo committed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {debts.map((d) => (
          <DebtRow
            key={d.id}
            debt={d}
            onUpdate={updateField}
            onRemove={removeDebt}
          />
        ))}
      </div>

      <DebtStrategy debts={debts} />

      {adding ? (
        <div className="mt-3 bg-bg border border-border rounded-xl p-4 space-y-3">
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
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="text-sm px-3 py-1.5 rounded-lg border border-border text-text-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button onClick={addDebt} className={`text-sm px-3 py-1.5 ${BTN_BLUE_CLS}`}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 text-sm text-text-3 hover:text-[#4a8cff] transition-colors"
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
  const n =
    -Math.log(1 - (r * debt.balance) / debt.monthly_payment) / Math.log(1 + r);
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
  const scraMayApply =
    !isPaidOff && debt.interest_rate > SCRA_CAP && debt.balance > 0;

  const extra = parseFloat(extraPayment) || 0;
  const debtWithExtra: Debt =
    extra > 0
      ? { ...debt, monthly_payment: debt.monthly_payment + extra }
      : debt;

  return (
    <div
      className={`border rounded-xl p-3.5 transition-opacity ${
        isPaidOff ? 'border-border-dim bg-bg opacity-40' : 'border-border bg-bg'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <EditableText
              value={debt.label}
              className="text-sm font-semibold text-text"
              onSave={(v) => onUpdate(debt, 'label', v)}
            />
            <EditableText
              value={debt.lender || 'Add lender'}
              className={`text-xs ${debt.lender ? 'text-text-3' : 'text-text-4'}`}
              onSave={(v) => onUpdate(debt, 'lender', v)}
            />
            {isPaidOff && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00d98a]/10 text-[#00d98a]">
                Paid off
              </span>
            )}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
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
                <div className="flex gap-4 mt-2 pt-2 border-t border-border-dim flex-wrap items-center">
                  <span className="text-[11px] text-text-3">
                    Paid off{' '}
                    <span className="text-text font-mono">
                      ~{payoffDate(info.months)}
                    </span>{' '}
                    <span className="text-text-4">({info.months} mo)</span>
                  </span>
                  {info.totalInterest > 0 && (
                    <span className="text-[11px] text-text-3">
                      Total interest{' '}
                      <span className="text-[#ff4560] font-mono">
                        ${info.totalInterest.toLocaleString()}
                      </span>
                    </span>
                  )}
                  <button
                    onClick={() => setShowAmort((v) => !v)}
                    className="ml-auto text-[11px] text-text-4 hover:text-[#4a8cff] transition-colors"
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
            <div className="mt-2 pt-2 border-t border-border-dim flex items-start gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-[#4a8cff] shrink-0 mt-0.5">
                SCRA
              </span>
              <p className="text-[11px] text-text-3 leading-snug">
                Rate {debt.interest_rate}% may be reducible to {SCRA_CAP}% on pre-service
                debts under the Servicemembers Civil Relief Act — send written notice to
                your lender.{' '}
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
          className="text-text-3 hover:text-[#ff4560] text-xs transition-colors mt-0.5 shrink-0"
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
    extra > 0
      ? calcPayoff({ ...debt, monthly_payment: debt.monthly_payment + extra })
      : null;

  // Build yearly milestones
  const milestones = buildYearlyMilestones(debt, extra);

  return (
    <div className="mt-3 pt-3 border-t border-border-dim space-y-3">
      {/* Extra payment input */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-3 shrink-0">
          Extra payment/mo
        </span>
        <span className="text-[11px] text-text-3">$</span>
        <input
          type="number"
          min="0"
          value={extraPayment}
          onChange={(e) => onExtraChange(e.target.value)}
          placeholder="0"
          className="w-20 text-xs font-mono bg-bg border border-border rounded px-2 py-0.5 text-text focus:outline-none focus:border-blue-500 transition-colors"
        />
        {withExtra && baseInfo && (
          <span className="text-[11px] text-[#00d98a] font-mono">
            saves{' '}
            {formatCurrency(baseInfo.totalInterest - withExtra.totalInterest)} ·{' '}
            {baseInfo.months - withExtra.months} mo faster
          </span>
        )}
      </div>

      {/* Year-by-year table */}
      {milestones.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-text-4 border-b border-border-dim">
                <th className="text-left pb-1 font-medium">Year</th>
                <th className="text-right pb-1 font-medium">Balance</th>
                <th className="text-right pb-1 font-medium">Paid</th>
                <th className="text-right pb-1 font-medium">Interest</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr
                  key={m.year}
                  className="border-b border-border-dim/50 hover:bg-surface-raised/30 transition-colors"
                >
                  <td className="py-1 text-text-3 font-mono">{m.year}</td>
                  <td className="py-1 text-right font-mono text-text">
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

function buildYearlyMilestones(
  debt: Debt,
  extraPayment: number,
): YearlyMilestone[] {
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
      <span className="flex items-center gap-0.5 text-xs text-text-2">
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
          className="w-20 font-mono border-b border-[#4a8cff]/50 bg-transparent outline-none text-text"
        />
        <span className="text-text-3">{suffix}</span>
      </span>
    );
  }
  return (
    <span
      className="text-xs cursor-pointer hover:text-text-2 transition-colors"
      onClick={() => {
        setDraft(value ? String(value) : '');
        setEditing(true);
      }}
    >
      <span className="font-sans text-text-3">{label} </span>
      {value ? (
        <span className="font-mono text-text-3">
          {prefix}{value.toLocaleString()}{suffix}
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
  const snowballOrder = [...indices].sort(
    (a, b) => active[a].balance - active[b].balance,
  );
  const snowball = simulatePayoff(active, snowballOrder);

  const best =
    avalanche.totalInterest <= snowball.totalInterest
      ? 'avalanche'
      : 'snowball';
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
    <div className="mt-4 pt-4 border-t border-border-dim">
      <h4 className={`${LABEL_CLS} mb-3`}>Payoff strategy</h4>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(({ label, sub, result, order: ord, isBest }) => (
          <div
            key={label}
            className={`rounded-xl border p-3 transition-colors ${
              isBest
                ? 'border-[#00d98a]/30 bg-[#00d98a]/5'
                : 'border-border bg-bg'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-text">{label}</span>
              {isBest && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#00d98a]/10 text-[#00d98a]">
                  recommended
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-3 mb-2">{sub}</p>
            <p className="text-xs font-mono text-text-2">
              {formatCurrency(result.totalInterest)}{' '}
              <span className="text-text-4">interest · {result.months} mo</span>
            </p>
            <p className="text-[10px] text-text-4 mt-1">
              Focus:{' '}
              <span className="text-text-2">{active[ord[0]]?.label}</span>
              {ord.length > 1 && <> → {active[ord[1]]?.label}</>}
            </p>
          </div>
        ))}
      </div>
      {saved > 50 && (
        <p className="text-[11px] text-[#00d98a] mt-2">
          {best === 'avalanche' ? 'Avalanche' : 'Snowball'} saves{' '}
          <span className="font-mono">{formatCurrency(saved)}</span> in interest
          vs current order.
        </p>
      )}
    </div>
  );
}
