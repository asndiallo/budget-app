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
import type { YearOverview } from '@/lib/types';
import { investmentForMonth, isBeforeMonth, isFutureMonth } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const joinedAt = getJoinedAt(db, userId);
  const investmentExpenses = getInvestmentExpenses(db, userId);
  const spendingByMonth = getSpendingByMonth(db, userId, months, INVESTMENT_CATEGORY);
  const investmentTxByMonth = getCategoryTotalByMonth(db, userId, months, INVESTMENT_CATEGORY);

  const categoryRows = db
    .prepare(
      `SELECT category, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND month IN (${months.map(() => '?').join(',')})
       GROUP BY category ORDER BY total DESC`,
    )
    .all(userId, ...months) as { category: string; total: number }[];

  const monthly = months.map((mo) => {
    const projected = isFutureMonth(mo);
    const preService = joinedAt ? isBeforeMonth(mo, joinedAt) : false;

    const { totalIncome: income, tsp } = preService
      ? { totalIncome: 0, tsp: 0 }
      : computeMonthlyFinancials(db, mo, userId);

    const spending = spendingByMonth[mo] ?? 0;
    const investmentTxs = investmentTxByMonth[mo] ?? 0;
    const hasData = preService
      ? false
      : income > 0 || (!projected && (spending > 0 || investmentTxs > 0));

    const invested = hasData ? tsp + investmentForMonth(investmentExpenses, mo) + investmentTxs : 0;
    const net = income - invested - spending;
    const savingsRate = income > 0 ? Math.round(((invested + Math.max(0, net)) / income) * 100) : 0;
    return {
      month: mo,
      income: Math.round(income),
      invested: Math.round(invested),
      spending: Math.round(spending),
      net: Math.round(net),
      savingsRate,
      hasData,
      projected,
      preService,
    };
  });

  const quarters = [1, 2, 3, 4].map((q) => {
    const slice = monthly.slice((q - 1) * 3, q * 3);
    const hasData = slice.some((m) => m.hasData && !m.projected);
    const income = slice.filter((m) => !m.preService).reduce((s, m) => s + m.income, 0);
    const invested = slice.reduce((s, m) => s + (m.hasData ? m.invested : 0), 0);
    const spending = slice.reduce((s, m) => s + (m.projected ? 0 : m.spending), 0);
    const net = income - invested - spending;
    const savingsRate = income > 0 ? Math.round(((invested + Math.max(0, net)) / income) * 100) : 0;
    return {
      q,
      months: months.slice((q - 1) * 3, q * 3),
      income,
      invested,
      spending,
      net,
      savingsRate,
      hasData,
    };
  });

  const actualMonths = monthly.filter((m) => !m.projected && !m.preService);
  const monthsWithData = actualMonths.filter((m) => m.hasData).length;
  const annualIncome = actualMonths.reduce((s, m) => s + m.income, 0);
  const annualInvested = actualMonths.reduce((s, m) => s + (m.hasData ? m.invested : 0), 0);
  const annualSpending = actualMonths.reduce((s, m) => s + m.spending, 0);
  const annualNet = annualIncome - annualInvested - annualSpending;
  const annualSavingsRate =
    annualIncome > 0
      ? Math.round(((annualInvested + Math.max(0, annualNet)) / annualIncome) * 100)
      : 0;

  return NextResponse.json<YearOverview>({
    year,
    annual: {
      income: annualIncome,
      invested: annualInvested,
      spending: annualSpending,
      net: annualNet,
      savingsRate: annualSavingsRate,
      monthsWithData,
    },
    quarters,
    monthly,
    categories: categoryRows,
  });
});
