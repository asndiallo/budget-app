'use client';

import type { BillPayment, FixedExpense } from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { INPUT_CLS, LABEL_CLS } from '@/lib/config';

function monthlyAmount(f: FixedExpense) {
  return f.period === 'annual' ? f.amount / 12 : f.amount;
}

export default function FixedExpensesPanel({
  month,
  onUpdate,
}: {
  month: string;
  onUpdate: () => void;
}) {
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set());
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [newDay, setNewDay] = useState('');
  const [newIsInvestment, setNewIsInvestment] = useState(false);

  const reload = () => api.fixedExpenses.list().then(setFixed);
  const reloadPayments = () =>
    month
      ? api.billPayments
          .list(month)
          .then((rows: BillPayment[]) =>
            setPaidIds(new Set(rows.map((r) => r.fixed_expense_id))),
          )
      : undefined;

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reloadPayments();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  async function togglePaid(f: FixedExpense) {
    if (!month) return;
    if (paidIds.has(f.id)) {
      await api.billPayments.unmark(f.id, month);
    } else {
      await api.billPayments.markPaid(f.id, month);
    }
    reloadPayments();
  }

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    const dom = newDay ? parseInt(newDay) : null;
    await api.fixedExpenses.add({
      label: newLabel.trim(),
      amount: parseFloat(newAmt),
      period: newPeriod,
      day_of_month: dom,
      notes: null,
      is_investment: newIsInvestment,
    });
    setNewLabel('');
    setNewAmt('');
    setNewPeriod('monthly');
    setNewDay('');
    setNewIsInvestment(false);
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
    await api.fixedExpenses.update({
      id: f.id,
      label: f.label,
      amount: f.amount,
      period,
      day_of_month: f.day_of_month,
      notes: f.notes,
      is_investment: !!f.is_investment,
    });
    reload();
    onUpdate();
  }

  async function toggleInvestment(f: FixedExpense) {
    await api.fixedExpenses.update({
      id: f.id,
      label: f.label,
      amount: f.amount,
      period: f.period,
      day_of_month: f.day_of_month,
      notes: f.notes,
      is_investment: !f.is_investment,
    });
    reload();
    onUpdate();
  }

  async function updateDayOfMonth(f: FixedExpense, raw: string) {
    const dom = raw.trim() ? parseInt(raw) : null;
    if (dom !== null && (dom < 1 || dom > 31)) return;
    await api.fixedExpenses.update({
      id: f.id,
      label: f.label,
      amount: f.amount,
      period: f.period,
      day_of_month: dom,
      notes: f.notes,
      is_investment: !!f.is_investment,
    });
    reload();
    onUpdate();
  }

  async function updateNotes(f: FixedExpense, notes: string) {
    await api.fixedExpenses.update({
      id: f.id,
      label: f.label,
      amount: f.amount,
      period: f.period,
      day_of_month: f.day_of_month,
      notes: notes || null,
      is_investment: !!f.is_investment,
    });
    reload();
    onUpdate();
  }

  const total = fixed.reduce((s, f) => s + monthlyAmount(f), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className={LABEL_CLS}>
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
        const isPaid = paidIds.has(f.id);
        return (
          <div key={f.id} className="py-3 border-b border-border-dim">
            <div className="flex items-center gap-2">
              <button
                onClick={() => togglePaid(f)}
                title={isPaid ? 'Mark unpaid' : 'Mark paid'}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  isPaid
                    ? 'border-[#00d98a] bg-[#00d98a]/10 text-[#00d98a]'
                    : 'border-border text-transparent hover:border-[#00d98a]/60'
                }`}
              >
                <span className="text-[10px] leading-none">✓</span>
              </button>
              <p
                className={`flex-1 text-sm ${isPaid ? 'text-text-3 line-through' : 'text-text'}`}
              >
                {f.label}
              </p>
              <DayField
                value={f.day_of_month ?? null}
                onSave={(raw) => updateDayOfMonth(f, raw)}
              />
              <button
                onClick={() => toggleInvestment(f)}
                title="Toggle investment / expense"
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  f.is_investment
                    ? 'border-[#4a8cff]/40 bg-[#4a8cff]/10 text-[#4a8cff]'
                    : 'border-border text-text-4 hover:border-[#2d4080] hover:text-text-3'
                }`}
              >
                invest
              </button>
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
                <p
                  className={`font-mono text-sm ${f.is_investment ? 'text-[#4a8cff]' : 'text-[#ff4560]'}`}
                >
                  {f.is_investment ? '+' : '−'}${f.amount.toLocaleString()}
                  {f.period === 'annual' ? '/yr' : ''}
                </p>
                {f.period === 'annual' && (
                  <p className="font-mono text-[11px] text-text-3">
                    ${mo.toFixed(2)}/mo
                  </p>
                )}
              </div>
            </div>
            {/* Inline notes */}
            <NotesField
              value={f.notes ?? null}
              onSave={(v) => updateNotes(f, v)}
            />
          </div>
        );
      })}

      <div className="flex gap-2 mt-4 flex-wrap">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className={`flex-1 min-w-32 ${INPUT_CLS}`}
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFixed()}
          placeholder="$"
          type="number"
          className={`w-20 font-mono ${INPUT_CLS}`}
        />
        <input
          value={newDay}
          onChange={(e) => setNewDay(e.target.value)}
          placeholder="due day"
          type="number"
          min={1}
          max={31}
          title="Day of month bill is due (optional)"
          className={`w-20 font-mono ${INPUT_CLS}`}
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
          onClick={() => setNewIsInvestment((v) => !v)}
          title="Mark as investment"
          className={`text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${
            newIsInvestment
              ? 'border-[#4a8cff]/40 bg-[#4a8cff]/10 text-[#4a8cff]'
              : 'border-border text-text-4 hover:border-[#2d4080] hover:text-text-3'
          }`}
        >
          invest
        </button>
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

function NotesField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

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
            setDraft(value ?? '');
            setEditing(false);
          }
        }}
        placeholder="Add a note…"
        className="mt-1 w-full text-[11px] bg-transparent border-b border-[#4a8cff]/30 text-text-3 outline-none placeholder-text-4 py-0.5"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      className={`mt-1 text-[11px] text-left transition-colors ${
        value
          ? 'text-text-3 hover:text-text-2'
          : 'text-text-4 hover:text-text-3'
      }`}
    >
      {value || '+ note'}
    </button>
  );
}
