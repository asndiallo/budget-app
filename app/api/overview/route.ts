import { NextResponse } from 'next/server';

import { computeMonthlyFinancials } from '@/lib/income';
import { withAuth } from '@/lib/route-helpers';
import type { YearOverview } from '@/lib/types';
import { investmentForMonth, isBeforeMonth, isFutureMonth } from '@/lib/utils';

export const GET = withAuth(async (req, { userId, db }) => {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const placeholders = months.map(() => '?').join(',');

  const userRow = db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as {
    joined_at: string | null;
  };
  const joinedAt = userRow?.joined_at || null;

  const spendingRows = db
    .prepare(
      `SELECT month, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND month IN (${placeholders}) GROUP BY month`,
    )
    .all(userId, ...months) as { month: string; total: number }[];

  const categoryRows = db
    .prepare(
      `SELECT category, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND month IN (${placeholders})
       GROUP BY category ORDER BY total DESC`,
    )
    .all(userId, ...months) as { category: string; total: number }[];

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

  const spendingByMonth = Object.fromEntries(spendingRows.map((r) => [r.month, r.total]));

  const monthly = months.map((mo) => {
    const projected = isFutureMonth(mo);
    const preService = joinedAt ? isBeforeMonth(mo, joinedAt) : false;

    const { totalIncome: income, tsp } = preService
      ? { totalIncome: 0, tsp: 0 }
      : computeMonthlyFinancials(db, mo, userId);

    const spending = spendingByMonth[mo] ?? 0;
    const hasData = preService ? false : income > 0 || (!projected && spending > 0);

    const invested = hasData ? tsp + investmentForMonth(investmentExpenses, mo) : 0;
    const net = income - invested - spending;
    const savingsRate =
      income > 0 ? Math.round(((invested + Math.max(0, net)) / income) * 100) : 0;
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
