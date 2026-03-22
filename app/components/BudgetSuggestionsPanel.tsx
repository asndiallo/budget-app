'use client';

import { CAT_COLORS, CHART_CAT_COLORS } from '@/lib/config';
import type {
  CategoryBudget,
  CategoryInsight,
  SpendingInsights,
} from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

const TREND_META: Record<
  CategoryInsight['trend'],
  { icon: string; label: string; className: string }
> = {
  up: { icon: '↑', label: 'Trending up', className: 'text-[#ff4560]' },
  down: { icon: '↓', label: 'Trending down', className: 'text-[#00d98a]' },
  stable: { icon: '→', label: 'Stable', className: 'text-text-2' },
};

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function usagePct(lastMonth: number, budget: number) {
  if (budget === 0) return 0;
  return Math.min(100, Math.round((lastMonth / budget) * 100));
}

export default function BudgetSuggestionsPanel() {
  const [insights, setInsights] = useState<SpendingInsights | null>(null);
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const reloadBudgets = () =>
    api.categoryBudgets
      .list()
      .then((rows: CategoryBudget[]) =>
        setSaved(Object.fromEntries(rows.map((r) => [r.category, r.budget]))),
      );

  useEffect(() => {
    api.insights.get().then(setInsights);
    reloadBudgets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit helpers ─────────────────────────────────────────────────────────────

  const startEdit = (cat: string, currentBudget: number) => {
    setEditingCat(cat);
    setEditValue(String(Math.round(currentBudget)));
  };

  const cancelEdit = () => setEditingCat(null);

  async function saveEdit(cat: string) {
    const v = parseFloat(editValue);
    if (!isNaN(v) && v >= 0) {
      await api.categoryBudgets.set(cat, v);
      reloadBudgets();
    }
    cancelEdit();
  }

  async function clearBudget(cat: string) {
    await api.categoryBudgets.remove(cat);
    reloadBudgets();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!insights) {
    return (
      <p className="text-xs text-text-3 text-center py-4">
        Loading budget suggestions…
      </p>
    );
  }

  if (insights.monthsAnalyzed === 0) {
    return (
      <p className="text-xs text-text-3 text-center py-4">
        No spending history yet — suggestions appear once you have transactions
        across multiple months.
      </p>
    );
  }

  const { categoryInsights, avgMonthlyExpenses, monthsAnalyzed } = insights;

  return (
    <div className="space-y-3">
      {/* Header */}
      <p className="text-xs text-text-2">
        Based on <span className="text-text font-mono">{monthsAnalyzed}</span>{' '}
        months of data · avg total{' '}
        <span className="text-text font-mono">
          {fmt(avgMonthlyExpenses)}/mo
        </span>
      </p>

      {/* Category rows */}
      <div className="space-y-2">
        {categoryInsights.map((ci) => {
          const trend = TREND_META[ci.trend];
          const hexColor = CHART_CAT_COLORS[ci.category] ?? '#9ca3af';
          const catClass =
            CAT_COLORS[ci.category] ?? 'bg-gray-500/10 text-gray-500';

          // Active budget: user-set takes priority, falls back to computed suggestion
          const hasUserBudget = ci.category in saved;
          const activeBudget = hasUserBudget
            ? saved[ci.category]
            : ci.suggestedBudget;
          const pct = usagePct(ci.lastMonth, activeBudget);
          const overBudget = ci.lastMonth > activeBudget && activeBudget > 0;

          const isEditing = editingCat === ci.category;

          return (
            <div
              key={ci.category}
              className="bg-bg border border-border rounded-xl p-3.5"
            >
              {/* Top row */}
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${catClass}`}
                >
                  {ci.category}
                </span>

                <span
                  className={`text-[11px] font-semibold ${trend.className}`}
                  title={trend.label}
                >
                  {trend.icon}
                </span>

                <div className="ml-auto flex items-center gap-3 text-xs font-mono">
                  <span className="text-text-3">avg {fmt(ci.avg3m)}</span>
                  <span
                    className={overBudget ? 'text-[#ff4560]' : 'text-text-2'}
                  >
                    last {fmt(ci.lastMonth)}
                  </span>
                </div>
              </div>

              {/* Budget row: view or edit */}
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-3 shrink-0">
                    Budget $
                  </span>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(ci.category);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="w-28 text-sm font-mono bg-surface border border-border rounded-lg px-2.5 py-1 text-text focus:outline-none focus:border-blue-600 transition-colors"
                  />
                  <button
                    onClick={() => saveEdit(ci.category)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-2 hover:text-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Usage bar */}
                  <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: overBudget ? '#ff4560' : hexColor,
                      }}
                    />
                  </div>

                  <span className="text-xs font-mono font-semibold text-text shrink-0">
                    {fmt(activeBudget)}
                  </span>

                  {!hasUserBudget && (
                    <span className="text-[10px] text-text-3 shrink-0">
                      suggested
                    </span>
                  )}

                  <button
                    onClick={() => startEdit(ci.category, activeBudget)}
                    className="text-text-3 hover:text-text-2 text-xs transition-colors shrink-0"
                    title="Edit budget"
                  >
                    ✎
                  </button>

                  {hasUserBudget && (
                    <button
                      onClick={() => clearBudget(ci.category)}
                      className="text-text-3 hover:text-[#ff4560] text-xs transition-colors shrink-0"
                      title="Reset to suggestion"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {overBudget && !isEditing && (
                <p className="mt-1.5 text-[10px] text-[#ff4560]">
                  Over budget by{' '}
                  <span className="font-mono font-semibold">
                    {fmt(ci.lastMonth - activeBudget)}
                  </span>{' '}
                  last month
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
