'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { BillPayment, FixedExpense, Goal } from '@/lib/types';

const DUE_SOON_WINDOW = 5;

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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set());
  const [autoMatchedIds, setAutoMatchedIds] = useState<Set<number>>(new Set());
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [newDay, setNewDay] = useState('');
  const [newIsInvestment, setNewIsInvestment] = useState(false);
  const [newGoalId, setNewGoalId] = useState<number | null>(null);
  const [newRecurrence, setNewRecurrence] = useState<'monthly' | 'biweekly'>('monthly');
  const [newAnchor, setNewAnchor] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  // id of the biweekly row whose schedule is being edited inline
  const [editingRecId, setEditingRecId] = useState<number | null>(null);
  const [editAnchor, setEditAnchor] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const reload = () => api.fixedExpenses.list().then(setFixed);
  const reloadGoals = () => api.goals.list().then(setGoals);
  const reloadPayments = () =>
    month
      ? api.billPayments.list(month).then((rows: BillPayment[]) => {
          setPaidIds(new Set(rows.map((r) => r.fixed_expense_id)));
          setAutoMatchedIds(
            new Set(rows.filter((r) => r.matched_tx_id != null).map((r) => r.fixed_expense_id)),
          );
        })
      : undefined;

  useEffect(() => {
    void reload();
    void reloadGoals();
  }, []);

  useEffect(() => {
    void reloadPayments();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  async function togglePaid(f: FixedExpense) {
    if (!month) return;
    if (paidIds.has(f.id)) {
      await api.billPayments.unmark(f.id, month);
    } else {
      await api.billPayments.markPaid(f.id, month);
      // Auto-contribute to linked goal when marking paid
      if (f.goal_id) {
        await api.goalContributions.add(f.goal_id, monthlyAmount(f), `Auto: ${f.label} (${month})`);
      }
    }
    void reloadPayments();
  }

  async function saveRecurrence(f: FixedExpense) {
    if (!editAnchor) return;
    await api.fixedExpenses.update({
      id: f.id,
      label: f.label,
      amount: f.amount,
      period: f.period,
      day_of_month: f.day_of_month,
      notes: f.notes,
      is_investment: !!f.is_investment,
      goal_id: f.goal_id,
      recurrence: 'biweekly',
      recurrence_anchor: editAnchor,
      end_date: editEndDate || null,
    });
    setEditingRecId(null);
    void reload();
  }

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    if (newRecurrence === 'biweekly' && !newAnchor) return;
    const dom = newDay ? parseInt(newDay) : null;
    await api.fixedExpenses.add({
      label: newLabel.trim(),
      amount: parseFloat(newAmt),
      period: newPeriod,
      day_of_month: newRecurrence === 'biweekly' ? null : dom,
      notes: null,
      is_investment: newIsInvestment,
      goal_id: newGoalId,
      recurrence: newRecurrence,
      recurrence_anchor: newRecurrence === 'biweekly' ? newAnchor || null : null,
      end_date: newRecurrence === 'biweekly' ? newEndDate || null : null,
    });
    setNewLabel('');
    setNewAmt('');
    setNewPeriod('monthly');
    setNewDay('');
    setNewIsInvestment(false);
    setNewGoalId(null);
    setNewRecurrence('monthly');
    setNewAnchor('');
    setNewEndDate('');
    void reload();
    onUpdate();
  }

  async function removeFixed(id: number) {
    await api.fixedExpenses.remove(id);
    void reload();
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
      goal_id: f.goal_id,
      recurrence: f.recurrence ?? 'monthly',
      recurrence_anchor: f.recurrence_anchor,
      end_date: f.end_date,
    });
    void reload();
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
      goal_id: f.goal_id,
      recurrence: f.recurrence ?? 'monthly',
      recurrence_anchor: f.recurrence_anchor,
      end_date: f.end_date,
    });
    void reload();
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
      goal_id: f.goal_id,
      recurrence: f.recurrence ?? 'monthly',
      recurrence_anchor: f.recurrence_anchor,
      end_date: f.end_date,
    });
    void reload();
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
      goal_id: f.goal_id,
      recurrence: f.recurrence ?? 'monthly',
      recurrence_anchor: f.recurrence_anchor,
      end_date: f.end_date,
    });
    void reload();
    onUpdate();
  }

  async function updateGoalId(f: FixedExpense, goalId: number | null) {
    await api.fixedExpenses.update({
      id: f.id,
      label: f.label,
      amount: f.amount,
      period: f.period,
      day_of_month: f.day_of_month,
      notes: f.notes,
      is_investment: !!f.is_investment,
      goal_id: goalId,
      recurrence: f.recurrence ?? 'monthly',
      recurrence_anchor: f.recurrence_anchor,
      end_date: f.end_date,
    });
    void reload();
  }

  const total = fixed.reduce((s, f) => s + monthlyAmount(f), 0);

  const today = new Date();
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayDay = todayMonth === month ? today.getDate() : null;

  function isDueSoon(f: FixedExpense): boolean {
    if (!todayDay || !f.day_of_month || paidIds.has(f.id) || f.recurrence === 'biweekly')
      return false;
    return f.day_of_month >= todayDay && f.day_of_month <= todayDay + DUE_SOON_WINDOW;
  }

  function biweeklyLabel(anchor: string): string {
    const d = new Date(anchor + 'T00:00:00');
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return `every other ${dow}`;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Fixed expenses</h3>
        {fixed.length > 0 && (
          <span className="font-mono text-xs font-semibold text-[#f5aa2a]">
            −${Math.round(total).toLocaleString()}/mo
          </span>
        )}
      </div>

      {fixed.map((f) => {
        const mo = monthlyAmount(f);
        const isPaid = paidIds.has(f.id);
        const isAutoMatched = autoMatchedIds.has(f.id);
        const isBiweekly = f.recurrence === 'biweekly';
        return (
          <div key={f.id} className="border-border-dim border-b py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => togglePaid(f)}
                title={isPaid ? 'Mark unpaid' : 'Mark paid'}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isPaid
                    ? 'border-[#00d98a] bg-[#00d98a]/10 text-[#00d98a]'
                    : 'border-border text-transparent hover:border-[#00d98a]/60'
                }`}
              >
                <span className="text-[10px] leading-none">✓</span>
              </button>
              <p className={`flex-1 text-sm ${isPaid ? 'text-text-3 line-through' : 'text-text'}`}>
                {f.label}
              </p>
              {isAutoMatched && (
                <span
                  title="Auto-matched from a transaction"
                  className="shrink-0 rounded-full bg-[#4a8cff]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#4a8cff]"
                >
                  auto
                </span>
              )}
              {isDueSoon(f) && (
                <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  soon
                </span>
              )}
              {isBiweekly ? (
                editingRecId === f.id ? (
                  <div
                    className="flex flex-wrap items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="text-text-4 text-[10px]">start</label>
                    <input
                      type="date"
                      value={editAnchor}
                      onChange={(e) => setEditAnchor(e.target.value)}
                      required
                      className="bg-bg text-text rounded border border-[#4a8cff]/50 px-1 py-0.5 text-[10px] outline-none"
                    />
                    <label className="text-text-4 text-[10px]">end</label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      min={editAnchor}
                      className="bg-bg border-border text-text rounded border px-1 py-0.5 text-[10px] outline-none"
                    />
                    <button
                      onClick={() => saveRecurrence(f)}
                      disabled={!editAnchor}
                      className="rounded bg-[#4a8cff] px-2 py-0.5 text-[10px] text-white disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRecId(null)}
                      className="text-text-4 hover:text-text-2 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditAnchor(f.recurrence_anchor ?? '');
                      setEditEndDate(f.end_date ?? '');
                      setEditingRecId(f.id);
                    }}
                    title="Edit schedule"
                    className="shrink-0 rounded-full bg-[#4a8cff]/10 px-1.5 py-0.5 text-[10px] text-[#4a8cff] transition-colors hover:bg-[#4a8cff]/20"
                  >
                    {f.recurrence_anchor ? biweeklyLabel(f.recurrence_anchor) : 'set schedule'}
                    {f.end_date ? ` → ${f.end_date}` : ''}
                  </button>
                )
              ) : (
                <DayField
                  value={f.day_of_month ?? null}
                  onSave={(raw) => updateDayOfMonth(f, raw)}
                />
              )}
              <button
                onClick={() => toggleInvestment(f)}
                title="Toggle investment / expense"
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  f.is_investment
                    ? 'border-[#4a8cff]/40 bg-[#4a8cff]/10 text-[#4a8cff]'
                    : 'border-border text-text-4 hover:text-text-3 hover:border-[#2d4080]'
                }`}
              >
                invest
              </button>
              <button
                onClick={() => togglePeriod(f)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  f.period === 'annual'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-border text-text-3 hover:text-text-2 hover:border-[#2d4080]'
                }`}
                title="Toggle monthly / annual"
              >
                {f.period === 'annual' ? '/yr' : '/mo'}
              </button>
              <button
                onClick={() => removeFixed(f.id)}
                className="text-text-3 text-xs transition-colors hover:text-[#ff4560]"
              >
                ✕
              </button>
              <div className="w-28 shrink-0 text-right">
                <p
                  className={`font-mono text-sm ${f.is_investment ? 'text-[#4a8cff]' : 'text-[#ff4560]'}`}
                >
                  {f.is_investment ? '+' : '−'}${f.amount.toLocaleString()}
                  {f.period === 'annual' ? '/yr' : ''}
                </p>
                {f.period === 'annual' && (
                  <p className="text-text-3 font-mono text-[11px]">${mo.toFixed(2)}/mo</p>
                )}
              </div>
            </div>
            <NotesField value={f.notes ?? null} onSave={(v) => updateNotes(f, v)} />
            {(goals.length > 0 || f.goal_id) && (
              <GoalField
                value={f.goal_id ?? null}
                goals={goals}
                onSave={(gid) => updateGoalId(f, gid)}
              />
            )}
          </div>
        );
      })}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className={`min-w-32 flex-1 ${INPUT_CLS}`}
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFixed()}
          placeholder="$"
          type="number"
          className={`w-20 font-mono ${INPUT_CLS}`}
        />
        {newRecurrence === 'monthly' && (
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
        )}
        {newRecurrence === 'biweekly' && (
          <>
            <input
              value={newAnchor}
              onChange={(e) => setNewAnchor(e.target.value)}
              type="date"
              required
              title="Start date — first occurrence (required)"
              className={`${INPUT_CLS} ${!newAnchor ? 'border-[#ff4560]/60' : ''}`}
            />
            <input
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              type="date"
              min={newAnchor}
              title="End date — last occurrence (optional)"
              className={INPUT_CLS}
            />
          </>
        )}
        <select
          value={newPeriod}
          onChange={(e) => setNewPeriod(e.target.value as 'monthly' | 'annual')}
          className="bg-bg border-border text-text cursor-pointer rounded-lg border px-2 py-1.5 text-sm transition-colors focus:border-blue-600 focus:outline-none"
        >
          <option value="monthly">/mo</option>
          <option value="annual">/yr</option>
        </select>
        <select
          value={newRecurrence}
          onChange={(e) => setNewRecurrence(e.target.value as 'monthly' | 'biweekly')}
          title="Recurrence — affects calendar display"
          className="bg-bg border-border text-text cursor-pointer rounded-lg border px-2 py-1.5 text-sm transition-colors focus:border-blue-600 focus:outline-none"
        >
          <option value="monthly">monthly</option>
          <option value="biweekly">biweekly</option>
        </select>
        <button
          onClick={() => setNewIsInvestment((v) => !v)}
          title="Mark as investment"
          className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
            newIsInvestment
              ? 'border-[#4a8cff]/40 bg-[#4a8cff]/10 text-[#4a8cff]'
              : 'border-border text-text-4 hover:text-text-3 hover:border-[#2d4080]'
          }`}
        >
          invest
        </button>
        {goals.length > 0 && (
          <select
            value={newGoalId ?? ''}
            onChange={(e) => setNewGoalId(e.target.value ? Number(e.target.value) : null)}
            title="Link to a savings goal"
            className="bg-bg border-border text-text-3 cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] transition-colors focus:border-blue-600 focus:outline-none"
          >
            <option value="">no goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={addFixed}
          className="border-border text-text-2 hover:text-text rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-[#2d4080]"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function DayField({ value, onSave }: { value: number | null; onSave: (raw: string) => void }) {
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
        className="bg-bg text-text w-14 rounded border border-[#4a8cff]/50 px-1.5 py-0.5 font-mono text-[11px] outline-none"
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
      className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
        value
          ? 'bg-[#4a8cff]/10 text-[#4a8cff] hover:bg-[#4a8cff]/20'
          : 'text-text-4 hover:text-text-3'
      }`}
    >
      {value ? `due ${ordinal(value)}` : '+ due'}
    </button>
  );
}

function GoalField({
  value,
  goals,
  onSave,
}: {
  value: number | null;
  goals: Goal[];
  onSave: (goalId: number | null) => void;
}) {
  const linked = goals.find((g) => g.id === value);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`mt-0.5 text-left text-[11px] transition-colors ${
          linked ? 'text-[#4a8cff] hover:text-[#4a8cff]/80' : 'text-text-4 hover:text-text-3'
        }`}
        title={linked ? 'Linked goal — click to change' : 'Link to a savings goal'}
      >
        {linked ? `→ goal: ${linked.name}` : '+ link goal'}
      </button>
    );
  }

  return (
    <div className="mt-0.5 flex items-center gap-1">
      <select
        autoFocus
        value={value ?? ''}
        onChange={(e) => {
          onSave(e.target.value ? Number(e.target.value) : null);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className="bg-bg text-text cursor-pointer rounded border border-[#4a8cff]/50 px-1.5 py-0.5 text-[11px] outline-none"
      >
        <option value="">— unlink —</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function NotesField({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
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
        className="text-text-3 placeholder-text-4 mt-1 w-full border-b border-[#4a8cff]/30 bg-transparent py-0.5 text-[11px] outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value ?? '');
        setEditing(true);
      }}
      className={`mt-1 text-left text-[11px] transition-colors ${
        value ? 'text-text-3 hover:text-text-2' : 'text-text-4 hover:text-text-3'
      }`}
    >
      {value || '+ note'}
    </button>
  );
}
