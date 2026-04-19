import { NextResponse } from 'next/server';

import { INVESTMENT_CATEGORY } from '@/lib/config';
import { computeMonthlyFinancials } from '@/lib/income';
import {
  getCategoryTotalByMonth,
  getInvestmentExpenses,
  getJoinedAt,
  getSpendingByMonth,
} from '@/lib/queries';
import { withAuth } from '@/lib/route-helpers';
import type { YtdSummary } from '@/lib/types';
import { currentMonth, investmentForMonth, isBeforeMonth } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();

  const year = month.slice(0, 4);
  const [, m] = month.split('-').map(Number);
  const months = Array.from({ length: m }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const joinedAt = getJoinedAt(db, userId);
  const investmentExpenses = getInvestmentExpenses(db, userId);
  const spendingByMonth = getSpendingByMonth(db, userId, months, INVESTMENT_CATEGORY);
  const investmentTxByMonth = getCategoryTotalByMonth(db, userId, months, INVESTMENT_CATEGORY);

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
