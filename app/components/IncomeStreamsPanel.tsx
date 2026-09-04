'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import {
  BTN_BLUE_CLS,
  INCOME_STREAM_CAT_COLORS,
  INCOME_STREAM_CATEGORIES,
  INPUT_CLS,
} from '@/lib/config';
import type { IncomeStream, IncomeStreamFrequency } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

type StreamInput = {
  label: string;
  amount: number;
  frequency: IncomeStreamFrequency;
  category: string;
  variable: boolean;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CategoryBadge({ category }: { category: string }) {
  const color = INCOME_STREAM_CAT_COLORS[category] ?? '#9ca3af';
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: color + '22', color }}
    >
      {category}
    </span>
  );
}

function StreamForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<IncomeStream>;
  onSave: (data: StreamInput) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [frequency, setFrequency] = useState<IncomeStreamFrequency>(
    initial?.frequency ?? 'monthly',
  );
  const [category, setCategory] = useState(initial?.category ?? 'Rental');
  const [variable, setVariable] = useState(Boolean(initial?.variable));
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [ongoing, setOngoing] = useState(!initial?.end_date);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // Biweekly needs a start date to anchor the every-14-days cycle.
  const needsStart = frequency === 'biweekly';
  const invalid = !label.trim() || !amount || (needsStart && !startDate);

  function submit() {
    const amt = parseFloat(amount);
    if (!label.trim() || isNaN(amt) || amt <= 0) return;
    if (needsStart && !startDate) return;
    onSave({
      label: label.trim(),
      amount: amt,
      frequency,
      category,
      variable,
      start_date: startDate || null,
      end_date: ongoing ? null : endDate || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Brian — room rental"
          className={`flex-1 text-sm ${INPUT_CLS}`}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-sm">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={`w-24 text-right font-mono text-sm ${INPUT_CLS}`}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`flex-1 text-sm ${INPUT_CLS}`}
        >
          {INCOME_STREAM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as IncomeStreamFrequency)}
          className={`flex-1 text-sm ${INPUT_CLS}`}
        >
          <option value="monthly">Monthly</option>
          <option value="biweekly">Every 2 weeks</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[11px]">Starts</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`text-sm ${INPUT_CLS} py-1`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[11px]">ends</span>
          {ongoing ? (
            <span className="text-text-3 text-[11px] italic">ongoing</span>
          ) : (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`text-sm ${INPUT_CLS} py-1`}
            />
          )}
          <label className="text-text-3 flex cursor-pointer items-center gap-1 text-[11px] select-none">
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

      {needsStart && !startDate && (
        <p className="text-[11px] text-amber-400">
          A start date is required for a every-2-weeks stream — it anchors the cycle.
        </p>
      )}

      <label className="text-text-3 flex cursor-pointer items-center gap-2 text-[11px] select-none">
        <input
          type="checkbox"
          checked={variable}
          onChange={(e) => setVariable(e.target.checked)}
          className="accent-[#4a8cff]"
        />
        Amount varies each month — I&rsquo;ll update the actual figure myself
      </label>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className={`w-full resize-none text-sm ${INPUT_CLS}`}
      />

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={invalid}
          className={`px-3 py-1.5 text-sm ${BTN_BLUE_CLS} disabled:opacity-40`}
        >
          {initial?.id ? 'Save changes' : 'Add income stream'}
        </button>
        <button
          onClick={onCancel}
          className="text-text-3 hover:text-text-2 hover:bg-surface-raised rounded-lg px-3 py-1.5 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Inline amount editor — the low-friction monthly update for variable streams. */
function InlineAmount({ stream, onSaved }: { stream: IncomeStream; onSaved: () => void }) {
  const [local, setLocal] = useState(String(stream.amount));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(String(stream.amount));
  }, [stream.amount]);

  async function commit() {
    const amt = parseFloat(local);
    if (isNaN(amt) || amt < 0 || amt === stream.amount) {
      setLocal(String(stream.amount));
      return;
    }
    setSaving(true);
    await api.incomeStreams.update({
      id: stream.id,
      label: stream.label,
      amount: amt,
      frequency: stream.frequency,
      day_of_month: stream.day_of_month ?? null,
      category: stream.category,
      variable: Boolean(stream.variable),
      start_date: stream.start_date ?? null,
      end_date: stream.end_date ?? null,
      notes: stream.notes ?? null,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-[#00d98a]">+$</span>
      <input
        type="number"
        value={local}
        disabled={saving}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label={`Actual amount for ${stream.label}`}
        className="bg-bg border-border w-20 rounded-lg border px-2 py-1 text-right font-mono text-sm text-[#00d98a] transition-colors focus:border-blue-600 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}

export default function IncomeStreamsPanel({ onUpdate }: { onUpdate?: () => void }) {
  const [streams, setStreams] = useState<IncomeStream[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  function reload() {
    void api.incomeStreams.list().then(setStreams);
  }

  useEffect(reload, []);

  function refreshAll() {
    reload();
    onUpdate?.();
  }

  async function handleCreate(data: StreamInput) {
    await api.incomeStreams.add(data);
    setShowCreate(false);
    refreshAll();
  }

  async function handleUpdate(id: number, data: StreamInput) {
    await api.incomeStreams.update({ id, ...data });
    setEditingId(null);
    refreshAll();
  }

  async function handleDelete(id: number) {
    await api.incomeStreams.remove(id);
    refreshAll();
  }

  const monthlyTotal = streams
    .filter((s) => s.frequency !== 'biweekly')
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-3">
      {streams.length === 0 && !showCreate && (
        <p className="text-text-4 text-[11px]">
          No income streams yet — these are recurring non-military income sources (a room rental,
          Airbnb, side work). They count toward your total income and savings rate every month.
        </p>
      )}

      {streams.map((s) =>
        editingId === s.id ? (
          <StreamForm
            key={s.id}
            initial={s}
            onSave={(data) => handleUpdate(s.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={s.id} className="border-border space-y-1.5 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-text text-sm font-medium">{s.label}</span>
                <CategoryBadge category={s.category} />
                {Boolean(s.variable) && (
                  <span className="text-text-4 bg-surface-raised rounded-full px-2 py-0.5 text-[10px] font-medium">
                    varies
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {s.variable ? (
                  <InlineAmount stream={s} onSaved={refreshAll} />
                ) : (
                  <span className="font-mono text-sm text-[#00d98a]">
                    +{formatCurrency(s.amount)}
                  </span>
                )}
                <button
                  onClick={() => setEditingId(s.id)}
                  className="text-text-3 hover:text-text-2 hover:bg-surface-raised rounded px-2 py-0.5 text-[11px] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-text-4 rounded px-2 py-0.5 text-[11px] transition-colors hover:bg-red-500/10 hover:text-[#ff4560]"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="text-text-3 text-[11px]">
              {s.frequency === 'biweekly' ? 'Every 2 weeks' : 'Monthly'}
              {s.start_date ? ` · from ${fmtDate(s.start_date)}` : ''}
              {s.end_date ? ` · until ${fmtDate(s.end_date)}` : ''}
            </p>
            {s.notes && <p className="text-text-4 text-[11px] italic">{s.notes}</p>}
          </div>
        ),
      )}

      {streams.length > 0 && (
        <div className="text-text-3 flex justify-between px-1 text-[11px]">
          <span>Monthly streams total</span>
          <span className="font-mono font-semibold text-[#00d98a]">
            +{formatCurrency(monthlyTotal)}
          </span>
        </div>
      )}

      {showCreate ? (
        <StreamForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="border-border text-text-3 hover:text-text-2 hover:border-border-focus w-full rounded-lg border border-dashed px-3 py-1.5 text-[11px] transition-colors"
        >
          + Add income stream
        </button>
      )}
    </div>
  );
}
