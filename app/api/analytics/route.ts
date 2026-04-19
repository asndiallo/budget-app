import { NextResponse } from 'next/server';

import { INVESTMENT_CATEGORY } from '@/lib/config';
import { computeSavingsRatePct } from '@/lib/financials';
import { computeMonthlyFinancials } from '@/lib/income';
import { getInvestmentExpenses } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import { currentMonth, formatMonthShort, investmentForMonth, prevMonths } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();
  const count = Math.min(parseInt(searchParams.get('count') ?? '6'), 12);
  const months = prevMonths(month, count);

  const spendingRows = db
    .prepare(
      `SELECT month, category, SUM(amount) as total
       FROM transactions
       WHERE user_id = ? AND month IN (${months.map(() => '?').join(',')})
       GROUP BY month, category`,
    )
    .all(userId, ...months) as { month: string; category: string; total: number }[];

  const spendingMap = new Map<string, Record<string, number>>();
  for (const row of spendingRows) {
    if (!spendingMap.has(row.month)) spendingMap.set(row.month, {});
    spendingMap.get(row.month)![row.category] = row.total;
  }

  // Investment fixed expenses — needed for per-month invested calculation
  const investmentExpenses = getInvestmentExpenses(db, userId);

  const result = months.map((m) => {
    const { totalIncome, tsp } = computeMonthlyFinancials(db, m, userId);
    const categories = spendingMap.get(m) ?? {};

    // Separate investment transactions from living-expense spending
    const investmentTxs = categories[INVESTMENT_CATEGORY] ?? 0;
    const spending = Object.entries(categories)
      .filter(([cat]) => cat !== INVESTMENT_CATEGORY)
      .reduce((s, [, v]) => s + v, 0);

    const invested = tsp + investmentForMonth(investmentExpenses, m) + investmentTxs;
    const net = totalIncome - invested - spending;
    const savingsRate =
      totalIncome > 0 ? computeSavingsRatePct(totalIncome, invested, spending) : null;

    return {
      month: m,
      label: formatMonthShort(m),
      totalIncome,
      tsp,
      spending,
      net,
      savingsRate,
      categories,
    };
  });

  return NextResponse.json(result);
});
