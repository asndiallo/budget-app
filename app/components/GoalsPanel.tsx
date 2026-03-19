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

  const summaryCards = [
    {
      label: 'Total saved',
      value: `$${Math.round(totalSaved).toLocaleString()}`,
      green: false,
    },
    {
      label: 'Total target',
      value: `$${Math.round(totalTarget).toLocaleString()}`,
      green: false,
    },
    {
      label: 'Overall',
      value: `${totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%`,
      green: true,
    },
  ];

  return (
    <div className="space-y-5">
      {goals.length > 0 && (
        <div className="flex gap-3">
          {summaryCards.map(({ label, value, green }) => (
            <div
              key={label}
              className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100"
            >
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p
                className={`text-lg font-semibold ${green ? 'text-emerald-700' : 'text-gray-900'}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {goals.map((g) => {
          const pct =
            g.target > 0
              ? Math.min(100, Math.round((g.saved / g.target) * 100))
              : 0;
          return (
            <div key={g.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${GOAL_DOT_COLORS[g.color] ?? GOAL_DOT_COLORS[DEFAULT_GOAL_COLOR]}`}
                    >
                      {pct}%
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {g.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ${Math.round(g.saved).toLocaleString()} of $
                    {Math.round(g.target).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteGoal(g.id)}
                  className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${GOAL_BAR_COLORS[g.color] ?? GOAL_BAR_COLORS[DEFAULT_GOAL_COLOR]}`}
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
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => addSavings(g)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <p className="text-xs text-emerald-600 font-medium">
                  Goal reached!
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          New goal
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Goal name"
            className="flex-1 min-w-40 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGoal()}
            placeholder="Target $"
            type="number"
            className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {GOAL_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={addGoal}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
