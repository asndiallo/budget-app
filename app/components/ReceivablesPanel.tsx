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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#353d55]">
          Receivables
        </h3>
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
        <p className="text-sm text-[#353d55] py-2">No one owes you anything.</p>
      )}

      {outstanding.map((r) => {
        const remaining = r.amount - r.amount_paid;
        const pct =
          r.amount > 0 ? Math.round((r.amount_paid / r.amount) * 100) : 0;
        const isPaying = payingId === r.id;

        return (
          <div key={r.id} className="py-3 border-b border-[#131929]">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <EditableText
                  value={r.name}
                  className="text-sm font-semibold text-[#dce4f8]"
                  onSave={(v) => updateField(r.id, { name: v })}
                />
                <EditableText
                  value={r.description || ''}
                  placeholder="Add description"
                  className="text-xs text-[#353d55]"
                  onSave={(v) => updateField(r.id, { description: v })}
                />
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-[11px] text-[#353d55]">
                    Since {formatMonth(r.month_created)}
                  </p>
                  {r.amount_paid > 0 && (
                    <span className="text-[11px] text-[#f5aa2a] font-mono">
                      ${r.amount_paid.toLocaleString()} paid · $
                      {remaining.toLocaleString()} left
                    </span>
                  )}
                </div>
              </div>
              <EditableNumber
                value={r.amount}
                className="font-mono text-sm text-[#f5aa2a] whitespace-nowrap"
                onSave={(v) => updateField(r.id, { amount: v })}
              />
              <button
                onClick={() => (isPaying ? setPayingId(null) : openPayment(r))}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-[#00d98a]/10 text-[#00d98a] hover:bg-[#00d98a]/20 transition-colors whitespace-nowrap"
              >
                {isPaying ? 'Cancel' : 'Record payment'}
              </button>
              <button
                onClick={() => remove(r.id)}
                className="text-[#353d55] hover:text-[#ff4560] text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Progress bar */}
            {r.amount_paid > 0 && (
              <div className="mt-2 h-1 bg-[#06080f] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00d98a] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {/* Inline payment form */}
            {isPaying && (
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-xs text-[#6b7494]">Amount received:</span>
                <input
                  autoFocus
                  type="number"
                  value={paymentAmt}
                  onChange={(e) => setPaymentAmt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitPayment(r)}
                  className="w-24 text-sm font-mono bg-[#06080f] border border-[#1b2236] rounded-lg px-2 py-1 text-[#dce4f8] focus:outline-none focus:border-[#2d4080] transition-colors"
                />
                <button
                  onClick={() => submitPayment(r)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#1a2650] text-[#4a8cff] hover:bg-[#1f2f63] transition-colors"
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
          <summary className="text-xs text-[#353d55] cursor-pointer hover:text-[#6b7494] transition-colors select-none">
            {collected.length} collected
          </summary>
          <div className="mt-1">
            {collected.map((r) => (
              <div
                key={r.id}
                className="flex items-center py-2 gap-3 opacity-40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#6b7494] line-through">
                    {r.name}
                  </p>
                  {r.description && (
                    <p className="text-xs text-[#353d55] truncate">
                      {r.description}
                    </p>
                  )}
                </div>
                <span className="font-mono text-sm text-[#6b7494]">
                  ${r.amount.toLocaleString()}
                </span>
                <span className="text-xs text-[#00d98a]">
                  {r.month_paid ? formatMonth(r.month_paid) : 'Collected'}
                </span>
                <button
                  onClick={() => remove(r.id)}
                  className="text-[#353d55] hover:text-[#ff4560] text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add form */}
      <div className="flex gap-2 flex-wrap pt-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="Name"
          className="w-28 text-sm bg-[#06080f] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#353d55] focus:outline-none focus:border-[#2d4080] transition-colors"
        />
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="What for? (optional)"
          className="flex-1 min-w-32 text-sm bg-[#06080f] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#353d55] focus:outline-none focus:border-[#2d4080] transition-colors"
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReceivable()}
          placeholder="$"
          type="number"
          className="w-20 text-sm font-mono bg-[#06080f] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#353d55] focus:outline-none focus:border-[#2d4080] transition-colors"
        />
        <button
          onClick={addReceivable}
          className="text-sm px-3 py-1.5 rounded-lg bg-[#1a2650] text-[#4a8cff] hover:bg-[#1f2f63] transition-colors"
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
        className={`${className} border-b border-[#4a8cff]/50 bg-transparent outline-none w-full`}
      />
    );
  }
  return (
    <p
      className={`${className} cursor-pointer hover:opacity-70 transition-opacity truncate ${!value ? 'opacity-30' : ''}`}
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
        className="w-20 text-sm text-right font-mono border-b border-[#4a8cff]/50 bg-transparent outline-none text-[#f5aa2a]"
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer hover:opacity-70 transition-opacity`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      ${value.toLocaleString()}
    </span>
  );
}
