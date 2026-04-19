'use client';

import {
  BTN_BLUE_CLS,
  DEFAULT_GOAL_COLOR,
  GOAL_BAR_COLORS,
  GOAL_COLORS,
  GOAL_DOT_COLORS,
  INPUT_CLS,
  LABEL_CLS,
} from '@/lib/config';
import type { Goal, GoalContribution, SpendingInsights } from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

const EMERGENCY_PATTERN = /emergency/i;
const EMERGENCY_MONTHS = 3;

const isEmergencyFund = (name: string) => EMERGENCY_PATTERN.test(name);

function monthsCoveredColor(months: number): string {
  if (months < 1) return '#ff4560';
  if (months < 3) return '#f5aa2a';
  return '#00d98a';
}

function formatMonthsCovered(months: number): string {
  return months >= 10 ? Math.round(months).toFixed(0) : months.toFixed(1);
}

function formatMonthsToGoal(months: number): string {
  if (months <= 0) return '';
  if (months < 12) return `~${months} mo`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `~${yrs} yr` : `~${yrs} yr ${rem} mo`;
}

interface EditDraft {
  name: string;
  target: string;
  saved: string;
  color: string;
}

function toDraft(g: Goal): EditDraft {
  return {
    name: g.name,
    target: String(g.target),
    saved: String(g.saved),
    color: g.color,
  };
}

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [insights, setInsights] = useState<SpendingInsights | null>(null);
  const [editing, setEditing] = useState<Record<number, EditDraft>>({});
  const [historyGoalId, setHistoryGoalId] = useState<number | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_GOAL_COLOR);

  const reload = () => api.goals.list().then(setGoals);

  useEffect(() => {
    reload();
    api.insights.get().then(setInsights);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (g: Goal) =>
    setEditing((prev) => ({ ...prev, [g.id]: toDraft(g) }));

  const cancelEdit = (id: number) =>
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const patchDraft = (id: number, patch: Partial<EditDraft>) =>
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));

  async function saveEdit(g: Goal) {
    const d = editing[g.id];
    if (!d) return;

    const name = d.name.trim();
    const target = parseFloat(d.target);
    const saved = parseFloat(d.saved);

    if (!name || isNaN(target) || target < 0 || isNaN(saved) || saved < 0)
      return;

    await api.goals.update(g.id, {
      name,
      target,
      saved: Math.min(saved, target),
      color: d.color,
    });
    cancelEdit(g.id);
    reload();
  }

  async function applySmartTarget(g: Goal, suggested: number) {
    await api.goals.update(g.id, { target: suggested });
    reload();
  }

  async function addContribution(g: Goal, amount: number, note: string) {
    await api.goalContributions.add(g.id, amount, note || null);
    reload();
    if (historyGoalId === g.id) loadHistory(g.id);
  }

  async function removeContribution(c: GoalContribution) {
    await api.goalContributions.remove(c.id, c.goal_id, c.amount);
    reload();
    loadHistory(c.goal_id);
  }

  function loadHistory(goalId: number) {
    api.goalContributions.list(goalId).then(setContributions);
    setHistoryGoalId(goalId);
  }

  function toggleHistory(goalId: number) {
    if (historyGoalId === goalId) {
      setHistoryGoalId(null);
      setContributions([]);
    } else {
      loadHistory(goalId);
    }
  }

  async function deleteGoal(id: number) {
    await api.goals.remove(id);
    reload();
  }

  async function addGoal() {
    if (!newName.trim() || !newTarget) return;
    await api.goals.add(newName.trim(), parseFloat(newTarget), newColor);
    setNewName('');
    setNewTarget('');
    reload();
  }

  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const overallPct =
    totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  // Total monthly burn rate = spending + committed (for emergency fund coverage)
  const avgMonthlyBurn =
    insights && insights.monthsAnalyzed > 0
      ? insights.avgMonthlyExpenses + insights.avgMonthlyCommitted
      : null;

  const smartFundTarget =
    avgMonthlyBurn !== null && avgMonthlyBurn > 0
      ? Math.round(avgMonthlyBurn * EMERGENCY_MONTHS)
      : null;

  const inputClass =
    'text-sm font-mono bg-surface border border-border rounded-lg px-2.5 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors';

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Total saved',
              value: `$${Math.round(totalSaved).toLocaleString()}`,
              color: 'text-text',
              accent: 'transparent',
            },
            {
              label: 'Total target',
              value: `$${Math.round(totalTarget).toLocaleString()}`,
              color: 'text-text',
              accent: 'transparent',
            },
            {
              label: 'Overall',
              value: `${overallPct}%`,
              color: 'text-[#00d98a]',
              accent: '#00d98a',
            },
          ].map(({ label, value, color, accent }) => (
            <div
              key={label}
              className="bg-bg rounded-xl border border-border p-3.5 relative overflow-hidden"
            >
              {accent !== 'transparent' && (
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${accent}cc, ${accent}22 60%, transparent)`,
                  }}
                />
              )}
              <p className={`${LABEL_CLS} mb-1.5`}>
                {label}
              </p>
              <p className={`font-mono text-lg font-semibold ${color}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Goal cards */}
      <div className="space-y-3">
        {goals.map((g) => {
          const draft = editing[g.id];
          const isEditing = !!draft;

          const pct =
            g.target > 0
              ? Math.min(100, Math.round((g.saved / g.target) * 100))
              : 0;
          const remaining = Math.max(0, g.target - g.saved);
          const isDone = pct >= 100;

          const showSmartBanner =
            !isEditing &&
            isEmergencyFund(g.name) &&
            smartFundTarget !== null &&
            smartFundTarget !== g.target &&
            smartFundTarget > 0;

          return (
            <div
              key={g.id}
              className="bg-bg border border-border rounded-xl p-4 relative overflow-hidden"
            >
              {/* Top color accent stripe */}
              {isDone && (
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{
                    background:
                      'linear-gradient(90deg, #00d98acc, #00d98a22 70%, transparent)',
                  }}
                />
              )}

              {isEditing ? (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={draft.name}
                      onChange={(e) =>
                        patchDraft(g.id, { name: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(g);
                        if (e.key === 'Escape') cancelEdit(g.id);
                      }}
                      placeholder="Goal name"
                      className={`flex-1 ${inputClass}`}
                      style={{ fontFamily: 'inherit' }}
                    />
                    <select
                      value={draft.color}
                      onChange={(e) =>
                        patchDraft(g.id, { color: e.target.value })
                      }
                      className="text-sm bg-surface border border-border rounded-lg px-2.5 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
                    >
                      {GOAL_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-text-3 mb-1">Target $</p>
                      <input
                        type="number"
                        min="0"
                        value={draft.target}
                        onChange={(e) =>
                          patchDraft(g.id, { target: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(g);
                          if (e.key === 'Escape') cancelEdit(g.id);
                        }}
                        className={`w-full ${inputClass}`}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-text-3 mb-1">Saved $</p>
                      <input
                        type="number"
                        min="0"
                        value={draft.saved}
                        onChange={(e) =>
                          patchDraft(g.id, { saved: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(g);
                          if (e.key === 'Escape') cancelEdit(g.id);
                        }}
                        className={`w-full ${inputClass}`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => cancelEdit(g.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-2 hover:text-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(g)}
                      className={`text-xs px-3 py-1.5 ${BTN_BLUE_CLS}`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${GOAL_DOT_COLORS[g.color] ?? GOAL_DOT_COLORS[DEFAULT_GOAL_COLOR]}`}
                        >
                          {pct}%
                        </span>
                        <span className="text-sm font-semibold text-text truncate">
                          {g.name}
                        </span>
                        {isDone && (
                          <span className="text-xs text-[#00d98a]">🎯</span>
                        )}
                      </div>
                      <p className="text-xs text-text-3 font-mono">
                        ${Math.round(g.saved).toLocaleString()}
                        <span className="text-text-4">
                          {' / '}${Math.round(g.target).toLocaleString()}
                        </span>
                        {pct < 100 && remaining > 0 && (
                          <span className="text-text-3">
                            {' · '}${Math.round(remaining).toLocaleString()}{' '}
                            left
                          </span>
                        )}
                        {pct < 100 &&
                          insights &&
                          insights.avgMonthlyNet > 0 && (
                            <span className="text-text-4">
                              {' · '}
                              {formatMonthsToGoal(
                                Math.ceil(remaining / insights.avgMonthlyNet),
                              )}{' '}
                              at current rate
                            </span>
                          )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <button
                        onClick={() => startEdit(g)}
                        className="text-text-3 hover:text-text-2 text-xs transition-colors p-1"
                        title="Edit goal"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteGoal(g.id)}
                        className="text-text-3 hover:text-[#ff4560] text-xs transition-colors p-1"
                        title="Delete goal"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-surface rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${GOAL_BAR_COLORS[g.color] ?? GOAL_BAR_COLORS[DEFAULT_GOAL_COLOR]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Emergency fund: months covered metric */}
                  {!isEditing && isEmergencyFund(g.name) && avgMonthlyBurn !== null && avgMonthlyBurn > 0 && (
                    (() => {
                      const covered = g.saved / avgMonthlyBurn;
                      const color = monthsCoveredColor(covered);
                      return (
                        <div
                          className="mb-3 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3"
                          style={{ backgroundColor: color + '15', borderColor: color + '33', border: '1px solid' }}
                        >
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: color + '99' }}>
                              Months covered
                            </p>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-bold font-mono" style={{ color }}>
                                {formatMonthsCovered(covered)}
                              </span>
                              <span className="text-xs text-text-3">
                                mo &nbsp;·&nbsp; {formatMonthsCovered(EMERGENCY_MONTHS - covered > 0 ? EMERGENCY_MONTHS - covered : 0)} mo to 3-month goal
                              </span>
                            </div>
                            <p className="text-[10px] text-text-4 mt-0.5">
                              ${Math.round(g.saved).toLocaleString()} ÷ ${Math.round(avgMonthlyBurn).toLocaleString()}/mo (spending + committed)
                            </p>
                          </div>
                          {/* Mini coverage bar */}
                          <div className="w-16 shrink-0">
                            <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-1">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(100, (covered / EMERGENCY_MONTHS) * 100)}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-text-4 text-right">of {EMERGENCY_MONTHS} mo</p>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Smart target banner */}
                  {showSmartBanner && insights && avgMonthlyBurn !== null && (
                    <div className="mb-3 rounded-lg border border-[#00d98a]/20 bg-[#00d98a]/5 px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#00d98a]/60 mb-0.5">
                          Smart target
                        </p>
                        <p className="text-xs text-text-3 leading-snug">
                          3-month fund ·{' '}
                          <span className="font-mono">
                            ${Math.round(avgMonthlyBurn).toLocaleString()} avg/mo
                          </span>{' '}
                          (spending + bills) × {EMERGENCY_MONTHS} ={' '}
                          <span className="font-mono font-semibold text-[#00d98a]">
                            ${smartFundTarget!.toLocaleString()}
                          </span>{' '}
                          <span className="text-text-4">
                            ({insights.monthsAnalyzed} mo of data)
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => applySmartTarget(g, smartFundTarget!)}
                        className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-[#00d98a]/30 text-[#00d98a] hover:bg-[#00d98a]/10 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  {pct < 100 ? (
                    <ContributionRow
                      goal={g}
                      onAdd={(amount, note) => addContribution(g, amount, note)}
                    />
                  ) : (
                    <p className="text-xs font-semibold text-[#00d98a]">
                      Goal reached! 🎯
                    </p>
                  )}

                  {/* History toggle */}
                  <div className="mt-2">
                    <button
                      onClick={() => toggleHistory(g.id)}
                      className="text-[10px] text-text-4 hover:text-text-3 transition-colors"
                    >
                      {historyGoalId === g.id
                        ? '▾ Hide history'
                        : '▸ Show history'}
                    </button>
                    {historyGoalId === g.id && (
                      <div className="mt-2 space-y-1">
                        {contributions.length === 0 ? (
                          <p className="text-[11px] text-text-4 py-1">
                            No contributions logged yet.
                          </p>
                        ) : (
                          contributions.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-2 py-1 border-b border-border-dim"
                            >
                              <span className="text-[11px] font-mono text-[#00d98a] shrink-0">
                                +${c.amount.toLocaleString()}
                              </span>
                              {c.note && (
                                <span className="text-[11px] text-text-3 flex-1 truncate">
                                  {c.note}
                                </span>
                              )}
                              <span className="text-[10px] text-text-4 ml-auto shrink-0">
                                {new Date(c.created_at).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: 'numeric' },
                                )}
                              </span>
                              <button
                                onClick={() => removeContribution(c)}
                                className="text-text-4 hover:text-[#ff4560] text-[10px] transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* New goal form */}
      <div>
        <h3 className={`${LABEL_CLS} mb-3`}>
          New goal
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Goal name"
            className={`flex-1 min-w-40 ${INPUT_CLS}`}
          />
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Target $"
            type="number"
            className={`w-28 font-mono ${INPUT_CLS}`}
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className={`${INPUT_CLS} cursor-pointer`}
          >
            {GOAL_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={addGoal}
            className={`text-sm px-3 py-1.5 ${BTN_BLUE_CLS}`}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ContributionRow({
  goal,
  onAdd,
}: {
  goal: Goal;
  onAdd: (amount: number, note: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function submit() {
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    onAdd(v, note.trim());
    setAmount('');
    setNote('');
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Add savings $"
        className="w-32 text-sm font-mono bg-surface border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Note (optional)"
        className="flex-1 min-w-28 text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
      />
      <button
        onClick={submit}
        className={`text-sm px-3 py-1.5 ${BTN_BLUE_CLS}`}
      >
        Save
      </button>
    </div>
  );
}
