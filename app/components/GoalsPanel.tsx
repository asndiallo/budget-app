'use client';

import {
  DEFAULT_GOAL_COLOR,
  GOAL_BAR_COLORS,
  GOAL_COLORS,
  GOAL_DOT_COLORS,
} from '@/lib/config';
import { useEffect, useState } from 'react';

import type { Goal } from '@/lib/types';
import { api } from '@/lib/api';

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [addAmounts, setAddAmounts] = useState<Record<number, string>>({});
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_GOAL_COLOR);

  const reload = () => api.goals.list().then(setGoals);

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addSavings(goal: Goal) {
    const add = parseFloat(addAmounts[goal.id] || '0');
    if (!add) return;
    const newSaved = Math.min(goal.target, goal.saved + add);
    await api.goals.updateSaved(goal.id, newSaved);
    setAddAmounts((prev) => ({ ...prev, [goal.id]: '' }));
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

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Total saved',
              value: `$${Math.round(totalSaved).toLocaleString()}`,
              color: 'text-[#dce4f8]',
            },
            {
              label: 'Total target',
              value: `$${Math.round(totalTarget).toLocaleString()}`,
              color: 'text-[#dce4f8]',
            },
            {
              label: 'Overall',
              value: `${overallPct}%`,
              color: 'text-[#00d98a]',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-[#06080f] rounded-xl border border-[#1b2236] p-3.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#353d55] mb-1.5">
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
          const pct =
            g.target > 0
              ? Math.min(100, Math.round((g.saved / g.target) * 100))
              : 0;
          const remaining = Math.max(0, g.target - g.saved);
          return (
            <div
              key={g.id}
              className="bg-[#06080f] border border-[#1b2236] rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${GOAL_DOT_COLORS[g.color] ?? GOAL_DOT_COLORS[DEFAULT_GOAL_COLOR]}`}
                    >
                      {pct}%
                    </span>
                    <span className="text-sm font-semibold text-[#dce4f8]">
                      {g.name}
                    </span>
                  </div>
                  <p className="text-xs text-[#353d55] font-mono">
                    ${Math.round(g.saved).toLocaleString()}{' '}
                    <span className="text-[#2a3248]">
                      / ${Math.round(g.target).toLocaleString()}
                    </span>
                    {pct < 100 && remaining > 0 && (
                      <span className="text-[#353d55]">
                        {' '}
                        · ${Math.round(remaining).toLocaleString()} left
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => deleteGoal(g.id)}
                  className="text-[#353d55] hover:text-[#ff4560] text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-[#0b0e19] rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${GOAL_BAR_COLORS[g.color] ?? GOAL_BAR_COLORS[DEFAULT_GOAL_COLOR]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {pct < 100 ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={addAmounts[g.id] || ''}
                    onChange={(e) =>
                      setAddAmounts((prev) => ({
                        ...prev,
                        [g.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && addSavings(g)}
                    placeholder="Add savings $"
                    className="flex-1 text-sm font-mono bg-[#0b0e19] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#353d55] focus:outline-none focus:border-[#2d4080] transition-colors"
                  />
                  <button
                    onClick={() => addSavings(g)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-[#1b2236] text-[#6b7494] hover:border-[#2d4080] hover:text-[#dce4f8] transition-colors"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <p className="text-xs font-semibold text-[#00d98a]">
                  Goal reached! 🎯
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* New goal form */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#353d55] mb-3">
          New goal
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Goal name"
            className="flex-1 min-w-40 text-sm bg-[#06080f] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#353d55] focus:outline-none focus:border-[#2d4080] transition-colors"
          />
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Target $"
            type="number"
            className="w-28 text-sm font-mono bg-[#06080f] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#353d55] focus:outline-none focus:border-[#2d4080] transition-colors"
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="text-sm bg-[#06080f] border border-[#1b2236] rounded-lg px-3 py-1.5 text-[#dce4f8] focus:outline-none focus:border-[#2d4080] transition-colors cursor-pointer"
          >
            {GOAL_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={addGoal}
            className="text-sm px-3 py-1.5 rounded-lg bg-[#1a2650] text-[#4a8cff] hover:bg-[#1f2f63] transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
