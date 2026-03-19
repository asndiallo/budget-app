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
        <h2 className="text-sm font-semibold text-gray-800">Debts & Loans</h2>
        {activeTotal > 0 && (
          <span className="text-xs text-gray-500">
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
        <div className="mt-3 border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Car Loan)"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={newLender}
              onChange={(e) => setNewLender(e.target.value)}
              placeholder="Lender"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="Balance $"
              type="number"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              placeholder="Monthly payment $"
              type="number"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="Rate %"
              type="number"
              className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={addDebt}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          + Add debt / loan
        </button>
      )}
    </div>
  );
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
      className={`border rounded-lg p-3 ${isPaidOff ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <EditableText
              value={debt.label}
              className="text-sm font-medium text-gray-800"
              onSave={(v) => onUpdate(debt, 'label', v)}
            />
            <EditableText
              value={debt.lender || 'Add lender'}
              className={`text-xs ${debt.lender ? 'text-gray-400' : 'text-gray-300'}`}
              onSave={(v) => onUpdate(debt, 'lender', v)}
            />
            {isPaidOff && (
              <span className="text-xs text-emerald-600 font-medium">
                Paid off
              </span>
            )}
          </div>
          <div className="flex gap-4 mt-1.5 flex-wrap">
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
        </div>
        <button
          onClick={() => onRemove(debt.id)}
          className="text-gray-300 hover:text-red-400 text-xs transition-colors mt-0.5 shrink-0"
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
        className={`${className} border-b border-blue-400 bg-transparent outline-none`}
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer hover:underline`}
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
      <span className="flex items-center gap-0.5 text-xs text-gray-500">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-400">{prefix}</span>
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
          className="w-20 border-b border-blue-400 bg-transparent outline-none text-gray-700"
        />
        <span className="text-gray-400">{suffix}</span>
      </span>
    );
  }
  return (
    <span
      className="text-xs text-gray-500 cursor-pointer hover:text-gray-700"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      <span className="text-gray-400">{label} </span>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
