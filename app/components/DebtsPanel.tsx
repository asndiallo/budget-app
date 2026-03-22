'use client';

import { useEffect, useState } from 'react';

import type { Debt } from '@/lib/types';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

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
    const value = isNumeric ? parseFloat(raw) || 0 : raw;
    await api.debts.update(debt.id, { [field]: value });
    reload();
    onUpdate();
  }

  const activeTotal = debts
    .filter((d) => d.balance > 0)
    .reduce((s, d) => s + d.monthly_payment, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          Debts & loans
        </h3>
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

      {adding ? (
        <div className="mt-3 bg-bg border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Car Loan)"
              className="flex-1 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <input
              value={newLender}
              onChange={(e) => setNewLender(e.target.value)}
              placeholder="Lender"
              className="flex-1 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="Balance $"
              type="number"
              className="flex-1 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <input
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              placeholder="Monthly $"
              type="number"
              className="flex-1 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <input
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="Rate %"
              type="number"
              className="w-24 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="text-sm px-3 py-1.5 rounded-lg border border-border text-text-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addDebt}
              className="text-sm px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
            >
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
          </div>
          {!isPaidOff &&
            (() => {
              const info = calcPayoff(debt);
              if (!info) return null;
              return (
                <div className="flex gap-4 mt-2 pt-2 border-t border-border-dim flex-wrap">
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
                </div>
              );
            })()}
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

function EditableText({
  value,
  className,
  onSave,
}: {
  value: string;
  className?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
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
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${className} border-b border-[#4a8cff]/50 bg-transparent outline-none`}
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer hover:opacity-70 transition-opacity`}
      onClick={() => setEditing(true)}
    >
      {value}
    </span>
  );
}

function Field({
  label,
  value,
  prefix = '',
  suffix = '',
  onSave,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

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
      className="text-xs text-text-3 cursor-pointer hover:text-text-2 transition-colors font-mono"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      <span className="font-sans text-text-3">{label} </span>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
