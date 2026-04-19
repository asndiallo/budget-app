import { NextResponse } from 'next/server';

import { computeMonthlyFinancials } from '@/lib/income';
import { INVESTMENT_CATEGORY } from '@/lib/config';
import { withAuth } from '@/lib/route-helpers';
import type { CategoryInsight, SpendingInsights } from '@/lib/types';
import { currentMonth, investmentForMonth, isBeforeMonth } from '@/lib/utils';

function prevMonths(to: string, count: number): string[] {
  const [y, m] = to.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function lastCompleteMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();

  const baseline = lastCompleteMonth(month);
  const userRow = db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as {
    joined_at: string | null;
  };
  const joinedAt = userRow?.joined_at || null;

  // Build a 6-month window, but exclude pre-service months (before joined_at)
  const months6All = prevMonths(baseline, 6);
  const months6 = joinedAt ? months6All.filter((m) => !isBeforeMonth(m, joinedAt)) : months6All;
  const months3 = months6.slice(-3);

  const rows = db
    .prepare(
      `SELECT month, category, SUM(amount) AS total
       FROM transactions
       WHERE user_id = ? AND month IN (${months6.map(() => '?').join(',')})
       GROUP BY month, category`,
    )
    .all(userId, ...months6) as {
    month: string;
    category: string;
    total: number;
  }[];

  const byMonth = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!byMonth.has(row.month)) byMonth.set(row.month, {});
    byMonth.get(row.month)![row.category] = row.total;
  }

  const withData6 = months6.filter((m) => byMonth.has(m));
  const withData3 = months3.filter((m) => byMonth.has(m));

  // Committed = non-investment fixed expenses + active debt payments (current snapshot)
  const committedFixed = (
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN period='annual' THEN amount/12.0 ELSE amount END),0) AS s
         FROM fixed_expenses WHERE user_id=? AND active=1 AND is_investment=0`,
      )
      .get(userId) as { s: number }
  ).s;
  const debtPayments = (
    db
      .prepare(
        `SELECT COALESCE(SUM(monthly_payment),0) AS s FROM debts WHERE user_id=? AND balance > 0`,
      )
      .get(userId) as { s: number }
  ).s;
  const avgMonthlyCommitted = Math.round(committedFixed + debtPayments);

  const empty: SpendingInsights = {
    avgMonthlyExpenses: 0,
    avgMonthlyNet: 0,
    suggestedEmergencyFund: 0,
    avgMonthlyCommitted,
    monthsAnalyzed: 0,
    categoryInsights: [],
  };
  if (withData6.length === 0) return NextResponse.json(empty);

  const investmentExpenses = db
    .prepare(
      `SELECT amount, period, recurrence, recurrence_anchor, end_date
       FROM fixed_expenses WHERE user_id = ? AND active = 1 AND is_investment = 1`,
    )
    .all(userId) as {
    amount: number;
    period: string;
    recurrence: string | null;
    recurrence_anchor: string | null;
    end_date: string | null;
  }[];

  const monthlyData = withData6.map((m) => {
    const { totalIncome, tsp } = computeMonthlyFinancials(db, m, userId);
    // Exclude investment-category transactions from spending
    const catSpend = byMonth.get(m)!;
    const spending = Object.entries(catSpend)
      .filter(([cat]) => cat !== INVESTMENT_CATEGORY)
      .reduce((s, [, v]) => s + v, 0);
    const investmentTxs = catSpend[INVESTMENT_CATEGORY] ?? 0;
    const invested = tsp + investmentForMonth(investmentExpenses, m) + investmentTxs;
    return { spending, net: totalIncome - invested - spending };
  });

  const avgMonthlyExpenses = monthlyData.reduce((s, d) => s + d.spending, 0) / withData6.length;
  const avgMonthlyNet = monthlyData.reduce((s, d) => s + d.net, 0) / withData6.length;
  // Exclude Investment category from category insights (it's tracked separately)
  const allCategories = [...new Set(rows.map((r) => r.category))].filter(
    (c) => c !== INVESTMENT_CATEGORY,
  );

  const avg = (months: string[], cat: string) => {
    const vals = months.map((m) => byMonth.get(m)?.[cat] ?? 0);
    return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
  };

  const categoryInsights: CategoryInsight[] = allCategories.map((category) => {
    const avg6m = avg(withData6, category);
    const avg3m = withData3.length > 0 ? avg(withData3, category) : avg6m;
    const lastMonth = byMonth.get(withData6[withData6.length - 1])?.[category] ?? 0;
    const trendRatio = avg6m > 0 ? (avg3m - avg6m) / avg6m : 0;
    const trend: CategoryInsight['trend'] =
      trendRatio > 0.05 ? 'up' : trendRatio < -0.05 ? 'down' : 'stable';
    const suggestedBudget = Math.round((trend === 'up' ? avg3m * 1.05 : avg3m) / 5) * 5;
    return { category, avg3m, avg6m, lastMonth, trend, suggestedBudget };
  });

  categoryInsights.sort((a, b) => b.avg3m - a.avg3m);

  return NextResponse.json<SpendingInsights>({
    avgMonthlyExpenses: Math.round(avgMonthlyExpenses),
    avgMonthlyNet: Math.round(avgMonthlyNet),
    suggestedEmergencyFund: Math.round(avgMonthlyExpenses * 3),
    avgMonthlyCommitted,
    monthsAnalyzed: withData6.length,
    categoryInsights,
  });
});
