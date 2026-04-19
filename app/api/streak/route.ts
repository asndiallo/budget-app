import { NextResponse } from 'next/server';

import { INVESTMENT_CATEGORY } from '@/lib/config';
import { computeMonthlyFinancials } from '@/lib/income';
import { getInvestmentExpenses, getJoinedAt } from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import { investmentForMonth, isBeforeMonth, lastCompleteMonths } from '@/lib/utils';

export const GET = withAuth(async (_req, { userId, db }) => {
  const joinedAt = getJoinedAt(db, userId);
  const investmentExpenses = getInvestmentExpenses(db, userId);

  let streak = 0;
  for (const month of lastCompleteMonths(12)) {
    if (joinedAt && isBeforeMonth(month, joinedAt)) break;

    const { totalIncome, tsp } = computeMonthlyFinancials(db, month, userId);
    if (totalIncome === 0) break;

    const investmentTxs = (
      db
        .prepare(
          'SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE user_id=? AND month=? AND category=?',
        )
        .get(userId, month, INVESTMENT_CATEGORY) as { s: number }
    ).s;

    const spending = (
      db
        .prepare(
          'SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE user_id=? AND month=? AND category!=?',
        )
        .get(userId, month, INVESTMENT_CATEGORY) as { s: number }
    ).s;

    const invested = tsp + investmentForMonth(investmentExpenses, month) + investmentTxs;
    const net = totalIncome - invested - spending;

    if (net >= 0) streak++;
    else break;
  }

  return NextResponse.json({ streak });
});
