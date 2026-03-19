'use client';

import { useEffect, useState } from 'react';

interface Goal {
  id: number;
  name: string;
  target: number;
  saved: number;
  color: string;
}

const COLOR_OPTIONS = ['blue', 'green', 'amber', 'rose', 'purple'];

const BAR_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  purple: 'bg-purple-500',
};

const DOT_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  purple: 'bg-purple-100 text-purple-700',
};

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [addAmounts, setAddAmounts] = useState<Record<number, string>>({});
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newColor, setNewColor] = useState('blue');

  const fetchGoals = () => {
    fetch('/api/goals')
      .then((r) => r.json())
      .then(setGoals);
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  async function addSavings(goal: Goal) {
    const add = parseFloat(addAmounts[goal.id] || '0');
    if (!add) return;
    const newSaved = Math.min(goal.target, goal.saved + add);
    await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: goal.id, saved: newSaved }),
    });
    setAddAmounts((prev) => ({ ...prev, [goal.id]: '' }));
    fetchGoals();
  }

  async function deleteGoal(id: number) {
    await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchGoals();
  }

  async function addGoal() {
    if (!newName.trim() || !newTarget) return;
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        target: parseFloat(newTarget),
        color: newColor,
      }),
    });
    setNewName('');
    setNewTarget('');
    fetchGoals();
  }

  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      {goals.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Total saved</p>
            <p className="text-lg font-semibold text-gray-900">
              ${Math.round(totalSaved).toLocaleString()}
            </p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Total target</p>
            <p className="text-lg font-semibold text-gray-900">
              ${Math.round(totalTarget).toLocaleString()}
            </p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Overall</p>
            <p className="text-lg font-semibold text-emerald-700">
              {totalTarget > 0
                ? Math.round((totalSaved / totalTarget) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      )}

      {/* Goal list */}
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
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${DOT_COLORS[g.color] || DOT_COLORS['blue']}`}
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

              {/* Progress bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${BAR_COLORS[g.color] || BAR_COLORS['blue']}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Add savings */}
              {pct < 100 && (
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
              )}
              {pct >= 100 && (
                <p className="text-xs text-emerald-600 font-medium">
                  Goal reached!
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add goal */}
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
            {COLOR_OPTIONS.map((c) => (
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
