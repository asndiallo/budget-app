'use client';

import { ASSET_CATEGORIES, LABEL_CLS } from '@/lib/config';
import type { Asset, Debt, Goal } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function NetWorthCard({
  assets,
  debts,
  goals,
  onClick,
}: {
  assets: Asset[];
  debts: Debt[];
  goals: Goal[];
  onClick?: () => void;
}) {
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalGoalsSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalLiabilities = debts.reduce((s, d) => s + d.balance, 0);
  const netWorth = totalAssets + totalGoalsSaved - totalLiabilities;
  const grandTotal = totalAssets + totalGoalsSaved;
  const noData = assets.length === 0 && totalGoalsSaved === 0;

  if (noData) {
    return (
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
        className={`bg-surface border-border flex items-center gap-3 rounded-xl border p-4 ${onClick ? 'interactive-card' : ''}`}
      >
        <div>
          <p className={`${LABEL_CLS} mb-1`}>Net Worth</p>
          <p className="text-text-4 text-sm">
            Add assets in the <span className="text-text-2">Wealth tab</span> to track your complete
            financial picture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={
        onClick
          ? `Net worth: ${netWorth >= 0 ? '' : '–'}${formatCurrency(Math.abs(netWorth))} — click to view`
          : undefined
      }
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={`bg-surface border-border relative overflow-hidden rounded-xl border p-4 ${onClick ? 'interactive-card' : ''}`}
    >
      <div
        className="absolute top-0 right-0 left-0 h-0.5"
        style={{
          background: 'linear-gradient(90deg, #00d98acc, #00d98a33 60%, transparent)',
        }}
      />
      <div className="mb-2 flex items-center justify-between">
        <p className={LABEL_CLS}>Net Worth</p>
        {onClick && <span className="text-text-4 text-[9px] tracking-wide">→ view</span>}
      </div>
      <p
        className={`font-mono text-xl leading-none font-semibold ${
          netWorth >= 0 ? 'text-[#00d98a]' : 'text-[#ff4560]'
        }`}
      >
        {netWorth >= 0 ? '' : '–'}
        {formatCurrency(Math.abs(netWorth))}
      </p>
      {totalLiabilities > 0 && (
        <p className="text-text-4 mt-1 text-[10px]">
          <span className="text-text-2">{formatCurrency(totalAssets + totalGoalsSaved)}</span>{' '}
          assets
          {' · '}
          <span className="text-[#ff4560]">{formatCurrency(totalLiabilities)}</span> liabilities
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        {ASSET_CATEGORIES.map((cat) => {
          const total = assets.filter((a) => a.category === cat).reduce((s, a) => s + a.balance, 0);
          if (total === 0) return null;
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-text-4 w-20 shrink-0 text-[10px]">{cat}</span>
              <div className="bg-bg h-1 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-[#00d98a]"
                  style={{ width: `${pct}%`, opacity: 0.4 + pct / 150 }}
                />
              </div>
              <span className="text-text-2 shrink-0 font-mono text-[10px]">
                {formatCurrency(total)}
              </span>
            </div>
          );
        })}
        {totalGoalsSaved > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-text-4 w-20 shrink-0 text-[10px]">Goals</span>
            <div className="bg-bg h-1 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-[#b085f5]"
                style={{
                  width: `${((totalGoalsSaved / grandTotal) * 100).toFixed(1)}%`,
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-text-2 shrink-0 font-mono text-[10px]">
              {formatCurrency(totalGoalsSaved)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
