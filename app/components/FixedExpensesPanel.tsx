'use client';

import { useEffect, useState } from 'react';

import type { FixedExpense } from '@/lib/types';
import { api } from '@/lib/api';

function monthlyAmount(f: FixedExpense) {
  return f.period === 'annual' ? f.amount / 12 : f.amount;
}

export default function FixedExpensesPanel({
  onUpdate,
}: {
  onUpdate: () => void;
}) {
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [newDay, setNewDay] = useState('');

  const reload = () => api.fixedExpenses.list().then(setFixed);

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    const dom = newDay ? parseInt(newDay) : null;
    await api.fixedExpenses.add(
      newLabel.trim(),
      parseFloat(newAmt),
      newPeriod,
      dom,
    );
    setNewLabel('');
    setNewAmt('');
    setNewPeriod('monthly');
    setNewDay('');
    reload();
    onUpdate();
  }

  async function removeFixed(id: number) {
    await api.fixedExpenses.remove(id);
    reload();
    onUpdate();
  }

  async function togglePeriod(f: FixedExpense) {
    const period = f.period === 'annual' ? 'monthly' : 'annual';
    await api.fixedExpenses.update(
      f.id,
      f.label,
      f.amount,
      period,
      f.day_of_month,
    );
    reload();
    onUpdate();
  }

  async function updateDayOfMonth(f: FixedExpense, raw: string) {
    const dom = raw.trim() ? parseInt(raw) : null;
    if (dom !== null && (dom < 1 || dom > 31)) return;
    await api.fixedExpenses.update(f.id, f.label, f.amount, f.period, dom);
    reload();
    onUpdate();
  }

  const total = fixed.reduce((s, f) => s + monthlyAmount(f), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          Fixed expenses
        </h3>
        {fixed.length > 0 && (
          <span className="font-mono text-xs font-semibold text-[#f5aa2a]">
            −${Math.round(total).toLocaleString()}/mo
          </span>
        )}
      </div>

      {fixed.map((f) => {
        const mo = monthlyAmount(f);
        return (
          <div
            key={f.id}
            className="flex items-center py-3 border-b border-border-dim gap-2"
          >
            <p className="flex-1 text-sm text-text">{f.label}</p>
            <DayField
              value={f.day_of_month ?? null}
              onSave={(raw) => updateDayOfMonth(f, raw)}
            />
            <button
              onClick={() => togglePeriod(f)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                f.period === 'annual'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-border text-text-3 hover:border-[#2d4080] hover:text-text-2'
              }`}
              title="Toggle monthly / annual"
            >
              {f.period === 'annual' ? '/yr' : '/mo'}
            </button>
            <button
              onClick={() => removeFixed(f.id)}
              className="text-text-3 hover:text-[#ff4560] text-xs transition-colors"
            >
              ✕
            </button>
            <div className="text-right w-28 shrink-0">
              <p className="font-mono text-sm text-[#ff4560]">
                −${f.amount.toLocaleString()}
                {f.period === 'annual' ? '/yr' : ''}
              </p>
              {f.period === 'annual' && (
                <p className="font-mono text-[11px] text-text-3">
                  ${mo.toFixed(2)}/mo
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-2 mt-4 flex-wrap">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 min-w-32 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFixed()}
          placeholder="$"
          type="number"
          className="w-20 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
        />
        <input
          value={newDay}
          onChange={(e) => setNewDay(e.target.value)}
          placeholder="due day"
          type="number"
          min={1}
          max={31}
          title="Day of month bill is due (optional)"
          className="w-20 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
        />
        <select
          value={newPeriod}
          onChange={(e) => setNewPeriod(e.target.value as 'monthly' | 'annual')}
          className="text-sm bg-bg border border-border rounded-lg px-2 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
        >
          <option value="monthly">/mo</option>
          <option value="annual">/yr</option>
        </select>
        <button
          onClick={addFixed}
          className="text-sm px-3 py-1.5 rounded-lg border border-border text-text-2 hover:border-[#2d4080] hover:text-text transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function DayField({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ? String(value) : '');

  function ordinal(n: number) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={1}
        max={31}
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
            setDraft(value ? String(value) : '');
            setEditing(false);
          }
        }}
        placeholder="day"
        className="w-14 text-[11px] font-mono bg-bg border border-[#4a8cff]/50 rounded px-1.5 py-0.5 text-text outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value ? String(value) : '');
        setEditing(true);
      }}
      title="Set due day of month"
      className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
        value
          ? 'text-[#4a8cff] bg-[#4a8cff]/10 hover:bg-[#4a8cff]/20'
          : 'text-text-4 hover:text-text-3'
      }`}
    >
      {value ? `due ${ordinal(value)}` : '+ due'}
    </button>
  );
}
