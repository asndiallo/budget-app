'use client';

import {
  DEFAULT_GOAL_COLOR,
  GOAL_BAR_COLORS,
  GOAL_COLORS,
  GOAL_DOT_COLORS,
} from '@/lib/config';
import type { Goal, SpendingInsights } from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

const EMERGENCY_PATTERN = /emergency/i;
const EMERGENCY_MONTHS = 3;

const isEmergencyFund = (name: string) => EMERGENCY_PATTERN.test(name);

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
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_GOAL_COLOR);

  const reload = () => api.goals.list().then(setGoals);

  useEffect(() => {
    reload();
    api.insights.get().then(setInsights);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit helpers ─────────────────────────────────────────────────────────────

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

  // ── Add savings (non-edit mode quick-add) ────────────────────────────────────

  async function applySmartTarget(g: Goal, suggested: number) {
    await api.goals.update(g.id, { target: suggested });
    reload();
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

  const smartFundTarget =
    insights && insights.monthsAnalyzed > 0
      ? Math.round(insights.avgMonthlyExpenses * EMERGENCY_MONTHS)
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
            },
            {
              label: 'Total target',
              value: `$${Math.round(totalTarget).toLocaleString()}`,
              color: 'text-text',
            },
            {
              label: 'Overall',
              value: `${overallPct}%`,
              color: 'text-[#00d98a]',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-bg rounded-xl border border-border p-3.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-1.5">
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

          const showSmartBanner =
            !isEditing &&
            isEmergencyFund(g.name) &&
            smartFundTarget !== null &&
            smartFundTarget !== g.target &&
            smartFundTarget > 0;

          return (
            <div
              key={g.id}
              className="bg-bg border border-border rounded-xl p-4"
            >
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
                      className="text-xs px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${GOAL_DOT_COLORS[g.color] ?? GOAL_DOT_COLORS[DEFAULT_GOAL_COLOR]}`}
                        >
                          {pct}%
                        </span>
                        <span className="text-sm font-semibold text-text">
                          {g.name}
                        </span>
                      </div>
                      <p className="text-xs text-text-3 font-mono">
                        ${Math.round(g.saved).toLocaleString()}{' '}
                        <span className="text-text-4">
                          / ${Math.round(g.target).toLocaleString()}
                        </span>
                        {pct < 100 && remaining > 0 && (
                          <span className="text-text-3">
                            {' '}
                            · ${Math.round(remaining).toLocaleString()} left
                          </span>
                        )}
                        {pct < 100 &&
                          insights &&
                          insights.avgMonthlyNet > 0 && (
                            <span className="text-text-4">
                              {' '}
                              ·{' '}
                              {formatMonthsToGoal(
                                Math.ceil(remaining / insights.avgMonthlyNet),
                              )}{' '}
                              at current rate
                            </span>
                          )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(g)}
                        className="text-text-3 hover:text-text-2 text-xs transition-colors"
                        title="Edit goal"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteGoal(g.id)}
                        className="text-text-3 hover:text-[#ff4560] text-xs transition-colors"
                        title="Delete goal"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${GOAL_BAR_COLORS[g.color] ?? GOAL_BAR_COLORS[DEFAULT_GOAL_COLOR]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Smart target banner for emergency fund goals */}
                  {showSmartBanner && insights && (
                    <div className="mb-3 rounded-lg border border-[#1a2e1a] bg-[#0a150a] px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2d6a2d] mb-0.5">
                          Smart target
                        </p>
                        <p className="text-xs text-[#4a8f4a] leading-snug">
                          3-month fund ·{' '}
                          <span className="font-mono">
                            ${insights.avgMonthlyExpenses.toLocaleString()}{' '}
                            avg/mo
                          </span>{' '}
                          × {EMERGENCY_MONTHS} ={' '}
                          <span className="font-mono font-semibold text-[#00d98a]">
                            ${smartFundTarget!.toLocaleString()}
                          </span>{' '}
                          <span className="text-[#2d6a2d]">
                            ({insights.monthsAnalyzed} months of data)
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => applySmartTarget(g, smartFundTarget!)}
                        className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-[#2d6a2d] text-[#00d98a] hover:bg-[#0f2a0f] transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  {pct < 100 ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Add savings $"
                        onKeyDown={async (e) => {
                          if (e.key !== 'Enter') return;
                          const v = parseFloat(
                            (e.target as HTMLInputElement).value,
                          );
                          if (!v) return;
                          const newSaved = Math.min(g.target, g.saved + v);
                          await api.goals.update(g.id, { saved: newSaved });
                          (e.target as HTMLInputElement).value = '';
                          reload();
                        }}
                        className="flex-1 text-sm font-mono bg-surface border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
                      />
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-[#00d98a]">
                      Goal reached! 🎯
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* New goal form */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
          New goal
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Goal name"
            className="flex-1 min-w-40 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Target $"
            type="number"
            className="w-28 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors cursor-pointer"
          >
            {GOAL_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={addGoal}
            className="text-sm px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
