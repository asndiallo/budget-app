'use client';

import { useEffect, useState } from 'react';

import type { Receivable } from '@/lib/types';
import { api } from '@/lib/api';

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
  // id of the row currently showing the payment input
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentAmt, setPaymentAmt] = useState('');

  const reload = () => api.receivables.list().then(setReceivables);

  useEffect(() => {
    reload();
  }, []);

  async function addReceivable() {
    if (!newName.trim() || !newAmt) return;
    await api.receivables.add(
      newName.trim(),
      newDesc.trim(),
      parseFloat(newAmt),
      month,
    );
    setNewName('');
    setNewDesc('');
    setNewAmt('');
    reload();
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
    reload();
    onUpdate();
  }

  async function updateField(
    id: number,
    data: Partial<Pick<Receivable, 'name' | 'description' | 'amount'>>,
  ) {
    await api.receivables.update(id, data);
    reload();
  }

  async function remove(id: number) {
    await api.receivables.remove(id);
    reload();
  }

  const outstanding = receivables.filter((r) => !r.paid);
  const collected = receivables.filter((r) => r.paid);
  const totalRemaining = outstanding.reduce(
    (s, r) => s + (r.amount - r.amount_paid),
    0,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Receivables
        </h3>
        {outstanding.length > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            $
            {totalRemaining.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{' '}
            still owed
          </span>
        )}
      </div>

      {outstanding.length === 0 && collected.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No one owes you anything.</p>
      )}

      {outstanding.map((r) => {
        const remaining = r.amount - r.amount_paid;
        const pct = Math.round((r.amount_paid / r.amount) * 100);
        const isPaying = payingId === r.id;

        return (
          <div key={r.id} className="py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <EditableText
                  value={r.name}
                  className="text-sm font-medium text-gray-800"
                  onSave={(v) => updateField(r.id, { name: v })}
                />
                <EditableText
                  value={r.description || ''}
                  placeholder="Add description"
                  className="text-xs text-gray-400"
                  onSave={(v) => updateField(r.id, { description: v })}
                />
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-400">
                    Since {formatMonth(r.month_created)}
                  </p>
                  {r.amount_paid > 0 && (
                    <span className="text-xs text-amber-600">
                      ${r.amount_paid.toLocaleString()} paid · $
                      {remaining.toLocaleString()} left
                    </span>
                  )}
                </div>
              </div>
              <EditableNumber
                value={r.amount}
                className="text-sm font-medium text-amber-600 whitespace-nowrap"
                onSave={(v) => updateField(r.id, { amount: v })}
              />
              <button
                onClick={() => (isPaying ? setPayingId(null) : openPayment(r))}
                className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
              >
                {isPaying ? 'Cancel' : 'Record payment'}
              </button>
              <button
                onClick={() => remove(r.id)}
                className="text-gray-300 hover:text-red-400 text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Progress bar */}
            {r.amount_paid > 0 && (
              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {/* Inline payment form */}
            {isPaying && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Amount received:</span>
                <input
                  autoFocus
                  type="number"
                  value={paymentAmt}
                  onChange={(e) => setPaymentAmt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitPayment(r)}
                  className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => submitPayment(r)}
                  className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
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
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            {collected.length} collected
          </summary>
          {collected.map((r) => (
            <div key={r.id} className="flex items-center py-2 gap-3 opacity-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 line-through">{r.name}</p>
                {r.description && (
                  <p className="text-xs text-gray-400 truncate">
                    {r.description}
                  </p>
                )}
              </div>
              <span className="text-sm text-gray-500">
                ${r.amount.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600">
                Collected {r.month_paid ? formatMonth(r.month_paid) : ''}
              </span>
              <button
                onClick={() => remove(r.id)}
                className="text-gray-300 hover:text-red-400 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </details>
      )}

      {/* Add form */}
      <div className="flex gap-2 flex-wrap pt-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="Name"
          className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="What for? (optional)"
          className="flex-1 min-w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="$"
          type="number"
          className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={addReceivable}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
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

function EditableText({
  value,
  placeholder,
  className,
  onSave,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

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
        className={`${className} border-b border-blue-400 bg-transparent outline-none w-full`}
      />
    );
  }
  return (
    <p
      className={`${className} cursor-pointer hover:text-blue-600 transition-colors truncate ${!value ? 'opacity-40' : ''}`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || placeholder}
    </p>
  );
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
        className="w-20 text-sm text-right border-b border-blue-400 bg-transparent outline-none text-amber-600"
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer hover:text-blue-600 transition-colors`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      ${value.toLocaleString()}
    </span>
  );
}
