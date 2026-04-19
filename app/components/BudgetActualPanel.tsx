'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { BTN_BLUE_CLS, CAT_COLORS, CHART_CAT_COLORS } from '@/lib/config';
import type { CategoryBudget, SpendingInsights, Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface CategoryRow {
  category: string;
  spent: number;
  budget: number;
  isUserBudget: boolean;
  percentage?: number | null;
  suggestedBudget: number;
}

function buildRows(
  txs: Transaction[],
  saved: Record<string, { budget: number; percentage?: number | null }>,
  insights: SpendingInsights,
  monthlyIncome?: number,
): CategoryRow[] {
  const spending: Record<string, number> = {};
  for (const tx of txs) {
    spending[tx.category] = (spending[tx.category] ?? 0) + tx.amount;
  }

  const suggestedMap = Object.fromEntries(
    insights.categoryInsights.map((ci) => [ci.category, ci.suggestedBudget]),
  );

  const allCats = new Set([...Object.keys(spending), ...Object.keys(saved)]);

  return [...allCats]
    .map((category): CategoryRow => {
      const entry = saved[category];
      const isUserBudget = category in saved;
      const isPct = entry?.percentage != null;
      const budget = isUserBudget
        ? isPct && monthlyIncome
          ? Math.round((monthlyIncome * entry.percentage!) / 100)
          : entry.budget
        : (suggestedMap[category] ?? 0);

      return {
        category,
        spent: spending[category] ?? 0,
        budget,
        isUserBudget,
        percentage: entry?.percentage,
        suggestedBudget: suggestedMap[category] ?? 0,
      };
    })
    .filter((r) => r.budget > 0 || r.spent > 0)
    .sort((a, b) => {
      // Over-budget categories first, then by % used desc
      const aOver = a.budget > 0 && a.spent > a.budget;
      const bOver = b.budget > 0 && b.spent > b.budget;
      if (aOver !== bOver) return aOver ? -1 : 1;
      const aPct = a.budget > 0 ? a.spent / a.budget : 0;
      const bPct = b.budget > 0 ? b.spent / b.budget : 0;
      return bPct - aPct;
    });
}

export default function BudgetActualPanel({
  month,
  monthlyIncome,
}: {
  month: string;
  monthlyIncome?: number;
}) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editMode, setEditMode] = useState<'$' | '%'>('$');
  const [loading, setLoading] = useState(true);

  const reload = (m: string) => {
    setLoading(true);
    Promise.all([api.transactions.list(m), api.categoryBudgets.list(), api.insights.get()])
      .then(([txs, saved, insights]) => {
        const savedMap = Object.fromEntries(
          saved.map((r) => [r.category, { budget: r.budget, percentage: r.percentage }]),
        );
        setRows(buildRows(txs, savedMap, insights, monthlyIncome));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (month) reload(month);
  }, [month, monthlyIncome]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (row: CategoryRow) => {
    setEditingCat(row.category);
    if (row.isUserBudget && row.percentage != null) {
      setEditMode('%');
      setEditValue(String(row.percentage));
    } else {
      setEditMode('$');
      setEditValue(row.budget > 0 ? String(Math.round(row.budget)) : '');
    }
  };

  const cancelEdit = () => setEditingCat(null);

  async function saveEdit(cat: string) {
    const v = parseFloat(editValue);
    if (!isNaN(v) && v >= 0) {
      if (editMode === '%') {
        const computed = monthlyIncome ? Math.round((monthlyIncome * v) / 100) : 0;
        await api.categoryBudgets.set(cat, computed, v);
      } else {
        await api.categoryBudgets.set(cat, v, null);
      }
      reload(month);
    }
    cancelEdit();
  }

  async function clearBudget(cat: string) {
    await api.categoryBudgets.remove(cat);
    reload(month);
  }

  if (loading) {
    return <p className="text-text-3 py-8 text-center text-xs">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-3 mb-3 text-xs">No spending or budgets for this month.</p>
        <button
          onClick={() => reload(month)}
          className="text-text-4 hover:text-text-2 text-xs transition-colors"
        >
          ↻ Refresh suggestions
        </button>
      </div>
    );
  }

  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalBudgeted = rows.filter((r) => r.budget > 0).reduce((s, r) => s + r.budget, 0);
  const overCount = rows.filter((r) => r.budget > 0 && r.spent > r.budget).length;
  const overallPct =
    totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="bg-surface border-border rounded-xl border px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-text-3 text-xs">
            Spent vs. budgeted
            {overCount > 0 && (
              <span className="ml-2 font-semibold text-[#ff4560]">· {overCount} over budget</span>
            )}
          </span>
          <span className="text-text-2 font-mono text-xs">
            <span
              className={
                totalBudgeted > 0 && totalSpent > totalBudgeted
                  ? 'font-semibold text-[#ff4560]'
                  : 'text-text'
              }
            >
              {formatCurrency(totalSpent)}
            </span>
            {totalBudgeted > 0 && (
              <span className="text-text-4"> / {formatCurrency(totalBudgeted)}</span>
            )}
          </span>
        </div>
        {totalBudgeted > 0 && (
          <div className="bg-bg h-1.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${overallPct}%`,
                backgroundColor:
                  totalSpent > totalBudgeted ? '#ff4560' : overallPct >= 80 ? '#f5aa2a' : '#00d98a',
              }}
            />
          </div>
        )}
      </div>

      {/* Refresh suggestions */}
      <div className="flex justify-end">
        <button
          onClick={() => reload(month)}
          className="text-text-4 hover:text-text-2 flex items-center gap-1 text-[10px] transition-colors"
          title="Recalculate suggestions from latest 6 months of spending"
        >
          ↻ Refresh suggestions
        </button>
      </div>

      {/* Category rows */}
      <div className="space-y-2">
        {rows.map((row) => {
          const { category, spent, budget, isUserBudget, percentage } = row;
          const hasBudget = budget > 0;
          const pct = hasBudget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
          const over = hasBudget && spent > budget;
          const warn = hasBudget && pct >= 80 && !over;
          const hexColor = CHART_CAT_COLORS[category] ?? '#9ca3af';
          const catClass = CAT_COLORS[category] ?? 'bg-gray-500/10 text-gray-500';
          const barColor = over ? '#ff4560' : warn ? '#f5aa2a' : hexColor;
          const isEditing = editingCat === category;

          return (
            <div key={category} className="bg-bg border-border rounded-xl border px-3.5 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${catClass}`}
                >
                  {category}
                </span>
                <span
                  className={`ml-auto font-mono text-xs ${over ? 'font-semibold text-[#ff4560]' : warn ? 'text-[#f5aa2a]' : 'text-text-2'}`}
                >
                  {formatCurrency(spent)}
                  {hasBudget && (
                    <span className="text-text-4 font-normal"> / {formatCurrency(budget)}</span>
                  )}
                </span>
                {hasBudget && (
                  <span
                    className={`shrink-0 font-mono text-[10px] ${over ? 'text-[#ff4560]' : warn ? 'text-[#f5aa2a]' : 'text-text-4'}`}
                  >
                    {pct}%
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <div className="border-border flex overflow-hidden rounded-lg border text-[10px]">
                    <button
                      onClick={() => setEditMode('$')}
                      className={`px-2 py-1 transition-colors ${editMode === '$' ? 'bg-surface-raised text-text' : 'text-text-4 hover:text-text-3'}`}
                    >
                      $
                    </button>
                    <button
                      onClick={() => setEditMode('%')}
                      className={`px-2 py-1 transition-colors ${editMode === '%' ? 'bg-surface-raised text-text' : 'text-text-4 hover:text-text-3'}`}
                    >
                      %
                    </button>
                  </div>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(category);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="bg-surface border-border text-text w-24 rounded-lg border px-2.5 py-1 font-mono text-sm transition-colors focus:border-blue-600 focus:outline-none"
                  />
                  {editMode === '%' && monthlyIncome && (
                    <span className="text-text-4 text-[10px]">
                      ≈{' '}
                      {formatCurrency(
                        Math.round((monthlyIncome * (parseFloat(editValue) || 0)) / 100),
                      )}
                      /mo
                    </span>
                  )}
                  <button
                    onClick={() => saveEdit(category)}
                    className={`px-2.5 py-1 text-xs ${BTN_BLUE_CLS}`}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="border-border text-text-2 hover:text-text rounded-lg border px-2.5 py-1 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {hasBudget ? (
                    <div className="bg-surface h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  ) : (
                    <span className="text-text-4 flex-1 text-[10px]">no budget set</span>
                  )}

                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isUserBudget && hasBudget && (
                      <span className="text-text-4 text-[10px]">est</span>
                    )}
                    {isUserBudget && percentage != null && (
                      <span className="text-text-4 font-mono text-[10px]">{percentage}%</span>
                    )}
                    <button
                      onClick={() => startEdit(row)}
                      className="text-text-3 hover:text-text-2 text-xs transition-colors"
                      title={hasBudget ? 'Edit budget' : 'Set budget'}
                    >
                      {hasBudget ? '✎' : '+ budget'}
                    </button>
                    {isUserBudget && (
                      <button
                        onClick={() => clearBudget(category)}
                        className="text-text-3 text-xs transition-colors hover:text-[#ff4560]"
                        title="Clear budget"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              {over && !isEditing && (
                <p className="mt-1.5 text-[10px] text-[#ff4560]">
                  Over by{' '}
                  <span className="font-mono font-semibold">{formatCurrency(spent - budget)}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
