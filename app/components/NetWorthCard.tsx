'use client';

import type { Asset, Debt, Goal } from '@/lib/types';

import { ASSET_CATEGORIES, LABEL_CLS } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

export default function NetWorthCard({
  assets,
  debts,
  goals,
}: {
  assets: Asset[];
  debts: Debt[];
  goals: Goal[];
}) {
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalGoalsSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalLiabilities = debts.reduce((s, d) => s + d.balance, 0);
  const netWorth = totalAssets + totalGoalsSaved - totalLiabilities;
  const grandTotal = totalAssets + totalGoalsSaved;
  const noData = assets.length === 0 && totalGoalsSaved === 0;

  if (noData) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div>
          <p className={`${LABEL_CLS} mb-1`}>
            Net Worth
          </p>
          <p className="text-sm text-text-4">
            Add assets in the <span className="text-text-2">Net Worth tab</span>{' '}
            to track your complete financial picture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background:
            'linear-gradient(90deg, #00d98acc, #00d98a33 60%, transparent)',
        }}
      />
      <p className={`${LABEL_CLS} mb-2`}>
        Net Worth
      </p>
      <p
        className={`text-xl font-mono font-semibold leading-none ${
          netWorth >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]'
        }`}
      >
        {netWorth >= 0 ? '' : '–'}
        {formatCurrency(Math.abs(netWorth))}
      </p>
      {totalLiabilities > 0 && (
        <p className="text-[10px] text-text-4 mt-1">
          <span className="text-text-2">
            {formatCurrency(totalAssets + totalGoalsSaved)}
          </span>{' '}
          assets
          {' · '}
          <span className="text-[#ff4560]">
            {formatCurrency(totalLiabilities)}
          </span>{' '}
          liabilities
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        {ASSET_CATEGORIES.map((cat) => {
          const total = assets
            .filter((a) => a.category === cat)
            .reduce((s, a) => s + a.balance, 0);
          if (total === 0) return null;
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[10px] text-text-4 w-20 shrink-0">
                {cat}
              </span>
              <div className="flex-1 h-1 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#00d98a]"
                  style={{ width: `${pct}%`, opacity: 0.4 + pct / 150 }}
                />
              </div>
              <span className="text-[10px] font-mono text-text-2 shrink-0">
                {formatCurrency(total)}
              </span>
            </div>
          );
        })}
        {totalGoalsSaved > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-4 w-20 shrink-0">Goals</span>
            <div className="flex-1 h-1 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#b085f5]"
                style={{
                  width: `${((totalGoalsSaved / grandTotal) * 100).toFixed(1)}%`,
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-text-2 shrink-0">
              {formatCurrency(totalGoalsSaved)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
