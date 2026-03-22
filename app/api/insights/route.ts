import type { CategoryInsight, SpendingInsights } from '@/lib/types';

import { NextResponse } from 'next/server';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';

/** Generate `count` consecutive month strings ending at `to` (inclusive), oldest first. */
function prevMonths(to: string, count: number): string[] {
  const [y, m] = to.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Previous calendar month relative to the given month string. */
function lastCompleteMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * GET /api/insights
 *
 * Returns spending insights derived from the last 6 complete months:
 * - Average monthly expenses (months that have data)
 * - Suggested emergency fund target (3× avg monthly expenses)
 * - Per-category insights: 3-month avg, 6-month avg, trend, suggested budget
 */
export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();

  // Exclude the current (potentially partial) month; analyse last 6 complete months.
  const baseline = lastCompleteMonth(month);
  const months6 = prevMonths(baseline, 6);
  const months3 = months6.slice(3); // three most-recent of those six

  const rows = db
    .prepare(
      `SELECT month, category, SUM(amount) AS total
       FROM transactions
       WHERE month IN (${months6.map(() => '?').join(',')})
       GROUP BY month, category`,
    )
    .all(...months6) as { month: string; category: string; total: number }[];

  // Build month → { category → amount }
  const byMonth = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!byMonth.has(row.month)) byMonth.set(row.month, {});
    byMonth.get(row.month)![row.category] = row.total;
  }

  const withData6 = months6.filter((m) => byMonth.has(m));
  const withData3 = months3.filter((m) => byMonth.has(m));

  const empty: SpendingInsights = {
    avgMonthlyExpenses: 0,
    suggestedEmergencyFund: 0,
    monthsAnalyzed: 0,
    categoryInsights: [],
  };
  if (withData6.length === 0) return NextResponse.json(empty);

  // Total monthly spending average
  const monthlyTotals = withData6.map((m) =>
    Object.values(byMonth.get(m)!).reduce((s, v) => s + v, 0),
  );
  const avgMonthlyExpenses =
    monthlyTotals.reduce((s, v) => s + v, 0) / withData6.length;

  // All categories seen across analysed months
  const allCategories = [...new Set(rows.map((r) => r.category))];

  const avg = (months: string[], cat: string) => {
    const vals = months.map((m) => byMonth.get(m)?.[cat] ?? 0);
    return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
  };

  const categoryInsights: CategoryInsight[] = allCategories.map((category) => {
    const avg6m = avg(withData6, category);
    const avg3m = withData3.length > 0 ? avg(withData3, category) : avg6m;
    const lastMonthKey = withData6[withData6.length - 1];
    const lastMonth = byMonth.get(lastMonthKey)?.[category] ?? 0;

    // Trend: >5% change in 3m avg vs 6m avg
    const trendRatio = avg6m > 0 ? (avg3m - avg6m) / avg6m : 0;
    const trend: CategoryInsight['trend'] =
      trendRatio > 0.05 ? 'up' : trendRatio < -0.05 ? 'down' : 'stable';

    // Suggested budget: 3m avg; if trending up add a 5% buffer, round to $5
    const raw = trend === 'up' ? avg3m * 1.05 : avg3m;
    const suggestedBudget = Math.round(raw / 5) * 5;

    return { category, avg3m, avg6m, lastMonth, trend, suggestedBudget };
  });

  categoryInsights.sort((a, b) => b.avg3m - a.avg3m);

  return NextResponse.json<SpendingInsights>({
    avgMonthlyExpenses: Math.round(avgMonthlyExpenses),
    suggestedEmergencyFund: Math.round(avgMonthlyExpenses * 3),
    monthsAnalyzed: withData6.length,
    categoryInsights,
  });
}
