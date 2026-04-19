'use client';

import type { Allotment, AllotmentType } from '@/lib/types';
import { BTN_BLUE_CLS, INPUT_CLS } from '@/lib/config';

import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';

const TYPE_LABELS: Record<AllotmentType, string> = {
  savings: 'Savings',
  loan: 'Loan repayment',
  family: 'Family support',
  insurance: 'Insurance',
  charity: 'Charity / allotment org.',
  other: 'Other',
};

const TYPE_COLORS: Record<AllotmentType, string> = {
  savings: '#00d98a',
  loan: '#4a8cff',
  family: '#f5aa2a',
  insurance: '#b085f5',
  charity: '#ec4899',
  other: '#9ca3af',
};

function fmtMonth(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function TypeBadge({ type }: { type: AllotmentType }) {
  const color = TYPE_COLORS[type] ?? '#9ca3af';
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + '22', color }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

function AllotmentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Allotment>;
  onSave: (data: Omit<Allotment, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [type, setType] = useState<AllotmentType>(initial?.type ?? 'other');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [ongoing, setOngoing] = useState(!initial?.end_date);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function submit() {
    const amt = parseFloat(amount);
    if (!label.trim() || isNaN(amt) || amt <= 0 || !startDate) return;
    onSave({
      label: label.trim(),
      amount: amt,
      type,
      start_date: startDate,
      end_date: ongoing ? null : endDate || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Allotment label…"
          className={`flex-1 text-sm ${INPUT_CLS}`}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-text-3">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={`w-24 text-sm text-right font-mono ${INPUT_CLS}`}
          />
        </div>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as AllotmentType)}
        className={`w-full text-sm ${INPUT_CLS}`}
      >
        {(Object.keys(TYPE_LABELS) as AllotmentType[]).map((k) => (
          <option key={k} value={k}>
            {TYPE_LABELS[k]}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-3">From</span>
          <input
            type="month"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`text-sm ${INPUT_CLS} py-1`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-3">to</span>
          {ongoing ? (
            <span className="text-[11px] text-text-3 italic">ongoing</span>
          ) : (
            <input
              type="month"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`text-sm ${INPUT_CLS} py-1`}
            />
          )}
          <label className="flex items-center gap-1 text-[11px] text-text-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
              className="accent-[#4a8cff]"
            />
            ongoing
          </label>
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className={`w-full text-sm resize-none ${INPUT_CLS}`}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={!label.trim() || !amount || !startDate}
          className={`text-sm px-3 py-1.5 ${BTN_BLUE_CLS} disabled:opacity-40`}
        >
          {initial?.id ? 'Save changes' : 'Add allotment'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AllotementsManager({
  allotments,
  onRefresh,
}: {
  allotments: Allotment[];
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleCreate(data: Omit<Allotment, 'id' | 'created_at'>) {
    await api.allotments.create(data);
    setShowCreate(false);
    onRefresh();
  }

  async function handleUpdate(
    id: number,
    data: Omit<Allotment, 'id' | 'created_at'>,
  ) {
    await api.allotments.update(id, data);
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id: number) {
    await api.allotments.remove(id);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      {allotments.length === 0 && !showCreate && (
        <p className="text-[11px] text-text-4">
          No allotments yet — allotments are fixed amounts deducted from your
          gross pay before you receive it (savings deposits, loan payments,
          family support, etc.).
        </p>
      )}

      {allotments.map((a) =>
        editingId === a.id ? (
          <AllotmentForm
            key={a.id}
            initial={a}
            onSave={(data) => handleUpdate(a.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            key={a.id}
            className="rounded-xl border border-border p-3 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-text">{a.label}</span>
                <TypeBadge type={a.type} />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-sm text-[#ff4560]">
                  −{formatCurrency(a.amount)}
                </span>
                <button
                  onClick={() => setEditingId(a.id)}
                  className="text-[11px] px-2 py-0.5 rounded text-text-3 hover:text-text-2 hover:bg-surface-raised transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-[11px] px-2 py-0.5 rounded text-text-4 hover:text-[#ff4560] hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="text-[11px] text-text-3">
              {fmtMonth(a.start_date)} —{' '}
              {a.end_date ? fmtMonth(a.end_date) : 'ongoing'}
            </p>
            {a.notes && (
              <p className="text-[11px] text-text-4 italic">{a.notes}</p>
            )}
          </div>
        ),
      )}

      {showCreate ? (
        <AllotmentForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-dashed border-border text-text-3 hover:text-text-2 hover:border-border-focus transition-colors w-full"
        >
          + Add allotment
        </button>
      )}
    </div>
  );
}
