'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { BTN_BLUE_CLS, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { Receivable } from '@/lib/types';

import EditableText from './EditableText';

export default function ReceivablesPanel({
  month,
  onUpdate,
}: {
  month: string;
  onUpdate: () => void;
}) {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentAmt, setPaymentAmt] = useState('');

  const reload = () => api.receivables.list().then(setReceivables);

  useEffect(() => {
    void reload();
  }, []);

  async function addReceivable() {
    if (!newName.trim() || !newAmt) return;
    await api.receivables.add({
      name: newName.trim(),
      description: newDesc.trim(),
      amount: parseFloat(newAmt),
      month_created: month,
    });
    setNewName('');
    setNewDesc('');
    setNewAmt('');
    void reload();
  }

  function openPayment(r: Receivable) {
    const remaining = r.amount - r.amount_paid;
    setPayingId(r.id);
    setPaymentAmt(String(remaining));
  }

  async function submitPayment(r: Receivable) {
    const amt = parseFloat(paymentAmt);
    if (!amt || amt <= 0) return;
    await api.receivables.recordPayment(r.id, amt, month);
    setPayingId(null);
    setPaymentAmt('');
    void reload();
    onUpdate();
  }

  async function updateField(
    id: number,
    data: Partial<Pick<Receivable, 'name' | 'description' | 'amount'>>,
  ) {
    await api.receivables.update(id, data);
    void reload();
  }

  async function remove(id: number) {
    await api.receivables.remove(id);
    void reload();
  }

  const outstanding = receivables.filter((r) => !r.paid);
  const collected = receivables.filter((r) => r.paid);
  const totalRemaining = outstanding.reduce((s, r) => s + (r.amount - r.amount_paid), 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Receivables</h3>
        {outstanding.length > 0 && (
          <span className="font-mono text-xs text-[#f5aa2a]">
            $
            {totalRemaining.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{' '}
            owed to you
          </span>
        )}
      </div>

      {outstanding.length === 0 && collected.length === 0 && (
        <p className="text-text-3 py-2 text-sm">No one owes you anything.</p>
      )}

      {outstanding.map((r) => {
        const remaining = r.amount - r.amount_paid;
        const pct = r.amount > 0 ? Math.round((r.amount_paid / r.amount) * 100) : 0;
        const isPaying = payingId === r.id;

        return (
          <div key={r.id} className="border-border-dim border-b py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <EditableText
                  value={r.name}
                  className="text-text text-sm font-semibold"
                  onSave={(v) => updateField(r.id, { name: v })}
                />
                <EditableText
                  value={r.description || ''}
                  placeholder="Add description"
                  className="text-text-3 text-xs"
                  onSave={(v) => updateField(r.id, { description: v })}
                />
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-text-3 text-[11px]">Since {formatMonth(r.month_created)}</p>
                  {r.amount_paid > 0 && (
                    <span className="font-mono text-[11px] text-[#f5aa2a]">
                      ${r.amount_paid.toLocaleString()} paid · ${remaining.toLocaleString()} left
                    </span>
                  )}
                </div>
              </div>
              <EditableNumber
                value={r.amount}
                className="font-mono text-sm whitespace-nowrap text-[#f5aa2a]"
                onSave={(v) => updateField(r.id, { amount: v })}
              />
              <button
                onClick={() => (isPaying ? setPayingId(null) : openPayment(r))}
                className="rounded-lg bg-[#00d98a]/10 px-2.5 py-1.5 text-xs whitespace-nowrap text-[#00d98a] transition-colors hover:bg-[#00d98a]/20"
              >
                {isPaying ? 'Cancel' : 'Record payment'}
              </button>
              <button
                onClick={() => remove(r.id)}
                className="text-text-3 text-xs transition-colors hover:text-[#ff4560]"
              >
                ✕
              </button>
            </div>

            {/* Progress bar */}
            {r.amount_paid > 0 && (
              <div className="bg-bg mt-2 h-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-[#00d98a] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {/* Inline payment form */}
            {isPaying && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-text-2 text-xs">Amount received:</span>
                <input
                  autoFocus
                  type="number"
                  value={paymentAmt}
                  onChange={(e) => setPaymentAmt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitPayment(r)}
                  className="bg-bg border-border text-text w-24 rounded-lg border px-2 py-1 font-mono text-sm transition-colors focus:border-blue-600 focus:outline-none"
                />
                <button
                  onClick={() => submitPayment(r)}
                  className={`px-3 py-1.5 text-xs ${BTN_BLUE_CLS}`}
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        );
      })}

      {collected.length > 0 && (
        <details className="mt-2">
          <summary className="text-text-3 hover:text-text-2 cursor-pointer text-xs transition-colors select-none">
            {collected.length} collected
          </summary>
          <div className="mt-1">
            {collected.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 opacity-40">
                <div className="min-w-0 flex-1">
                  <p className="text-text-2 text-sm line-through">{r.name}</p>
                  {r.description && <p className="text-text-3 truncate text-xs">{r.description}</p>}
                </div>
                <span className="text-text-2 font-mono text-sm">${r.amount.toLocaleString()}</span>
                <span className="text-xs text-[#00d98a]">
                  {r.month_paid ? formatMonth(r.month_paid) : 'Collected'}
                </span>
                <button
                  onClick={() => remove(r.id)}
                  className="text-text-3 text-xs transition-colors hover:text-[#ff4560]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add form */}
      <div className="flex flex-wrap gap-2 pt-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="Name"
          className={`w-28 ${INPUT_CLS}`}
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="What for? (optional)"
          className={`min-w-32 flex-1 ${INPUT_CLS}`}
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="$"
          type="number"
          className={`w-20 font-mono ${INPUT_CLS}`}
        />
        <button onClick={addReceivable} className={`px-3 py-1.5 text-sm ${BTN_BLUE_CLS}`}>
          + Add
        </button>
      </div>
    </div>
  );
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function EditableNumber({
  value,
  className,
  onSave,
}: {
  value: number;
  className?: string;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(parseFloat(draft) || 0);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(parseFloat(draft) || 0);
            setEditing(false);
          }
          if (e.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-20 border-b border-[#4a8cff]/50 bg-transparent text-right font-mono text-sm text-[#f5aa2a] outline-none"
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer transition-opacity hover:opacity-70`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      ${value.toLocaleString()}
    </span>
  );
}
