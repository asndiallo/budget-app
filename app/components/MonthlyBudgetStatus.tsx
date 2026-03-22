'use client';

import { CAT_COLORS, CHART_CAT_COLORS } from '@/lib/config';
import type {
  CategoryBudget,
  SpendingInsights,
  Transaction,
} from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface CategoryStatus {
  category: string;
  spent: number;
  budget: number;
  isUserBudget: boolean;
}

function buildStatus(
  txs: Transaction[],
  saved: CategoryBudget[],
  insights: SpendingInsights,
): CategoryStatus[] {
  const spending: Record<string, number> = {};
  for (const tx of txs) {
    spending[tx.category] = (spending[tx.category] ?? 0) + tx.amount;
  }

  const savedMap = Object.fromEntries(saved.map((b) => [b.category, b.budget]));
  const suggestedMap = Object.fromEntries(
    insights.categoryInsights.map((ci) => [ci.category, ci.suggestedBudget]),
  );

  const allCats = new Set([...Object.keys(spending), ...Object.keys(savedMap)]);

  return [...allCats]
    .map((category) => {
      const budget = savedMap[category] ?? suggestedMap[category] ?? 0;
      return {
        category,
        spent: spending[category] ?? 0,
        budget,
        isUserBudget: category in savedMap,
      };
    })
    .filter((s) => s.budget > 0 || s.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}

export default function MonthlyBudgetStatus({ month }: { month: string }) {
  const [statuses, setStatuses] = useState<CategoryStatus[]>([]);

  useEffect(() => {
    if (!month) return;
    Promise.all([
      api.transactions.list(month),
      api.categoryBudgets.list(),
      api.insights.get(),
    ]).then(([txs, saved, insights]) =>
      setStatuses(buildStatus(txs, saved, insights)),
    );
  }, [month]);

  if (statuses.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3 mb-3">
        Budget status — this month
      </h3>
      <div className="space-y-2">
        {statuses.map(({ category, spent, budget, isUserBudget }) => {
          const hasBudget = budget > 0;
          const pct = hasBudget
            ? Math.min(100, Math.round((spent / budget) * 100))
            : 0;
          const over = hasBudget && spent > budget;
          const warn = hasBudget && pct >= 80 && !over;
          const hexColor = CHART_CAT_COLORS[category] ?? '#9ca3af';
          const catClass =
            CAT_COLORS[category] ?? 'bg-gray-500/10 text-gray-500';
          const barColor = over ? '#ff4560' : warn ? '#f5aa2a' : hexColor;

          return (
            <div key={category} className="flex items-center gap-3">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${catClass}`}
              >
                {category}
              </span>

              {hasBudget ? (
                <>
                  <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span
                    className={`text-xs font-mono shrink-0 ${over ? 'text-[#ff4560]' : warn ? 'text-[#f5aa2a]' : 'text-text-3'}`}
                  >
                    ${Math.round(spent).toLocaleString()}
                    <span className="text-text-4">
                      /{Math.round(budget).toLocaleString()}
                    </span>
                  </span>
                  {!isUserBudget && (
                    <span className="text-[10px] text-text-4 shrink-0">
                      est
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs font-mono text-text-2">
                  ${Math.round(spent).toLocaleString()}
                  <span className="text-text-4"> · no budget set</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
