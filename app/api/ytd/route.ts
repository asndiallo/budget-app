import { NextResponse } from 'next/server';

import { computeMonthlyFinancials } from '@/lib/income';
import { INVESTMENT_CATEGORY } from '@/lib/config';
import { withAuth } from '@/lib/route-helpers';
import type { YtdSummary } from '@/lib/types';
import { currentMonth, investmentForMonth, isBeforeMonth } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();

  const year = month.slice(0, 4);
  const [, m] = month.split('-').map(Number);
  const months = Array.from({ length: m }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const placeholders = months.map(() => '?').join(',');

  const spendingRows = db
    .prepare(
      `SELECT month, SUM(amount) AS total
       FROM transactions
       WHERE user_id = ? AND month IN (${placeholders}) AND category != ?
       GROUP BY month`,
    )
    .all(userId, ...months, INVESTMENT_CATEGORY) as { month: string; total: number }[];

  const investmentTxRows = db
    .prepare(
      `SELECT month, SUM(amount) AS total
       FROM transactions
       WHERE user_id = ? AND month IN (${placeholders}) AND category = ?
       GROUP BY month`,
    )
    .all(userId, ...months, INVESTMENT_CATEGORY) as { month: string; total: number }[];

  const investmentTxByMonth = Object.fromEntries(investmentTxRows.map((r) => [r.month, r.total]));

  const spendingByMonth = Object.fromEntries(spendingRows.map((r) => [r.month, r.total]));

  const userRow = db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as {
    joined_at: string | null;
  };
  const joinedAt = userRow?.joined_at || null;

  const investmentExpenses = db
    .prepare(
      `SELECT amount, period, recurrence, recurrence_anchor, end_date
       FROM fixed_expenses
       WHERE user_id = ? AND active = 1 AND is_investment = 1`,
    )
    .all(userId) as {
    amount: number;
    period: string;
    recurrence: string | null;
    recurrence_anchor: string | null;
    end_date: string | null;
  }[];

  let totalIncome = 0;
  let totalInvested = 0;
  let totalSpending = 0;
  let monthsRecorded = 0;

  for (const mo of months) {
    if (joinedAt && isBeforeMonth(mo, joinedAt)) continue;
    const { totalIncome: inc, tsp } = computeMonthlyFinancials(db, mo, userId);
    const spending = spendingByMonth[mo] ?? 0;
    const investmentTxs = investmentTxByMonth[mo] ?? 0;
    if (inc > 0 || spending > 0 || investmentTxs > 0) {
      totalIncome += inc;
      totalInvested += tsp + investmentForMonth(investmentExpenses, mo) + investmentTxs;
      totalSpending += spending;
      monthsRecorded++;
    }
  }

  return NextResponse.json<YtdSummary>({
    year: parseInt(year),
    monthsRecorded,
    totalIncome: Math.round(totalIncome),
    totalInvested: Math.round(totalInvested),
    totalSpending: Math.round(totalSpending),
    netSaved: Math.round(totalIncome - totalInvested - totalSpending),
  });
});
