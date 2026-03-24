import { NextResponse } from 'next/server';
import type { YearOverview } from '@/lib/types';
import { computeMonthlyFinancials } from '@/lib/income';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get('year') || String(new Date().getFullYear()),
    );

    const months = Array.from(
      { length: 12 },
      (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
    );
    const placeholders = months.map(() => '?').join(',');

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

    const investmentFixed = (
      db
        .prepare(
          "SELECT COALESCE(SUM(CASE WHEN period='annual' THEN amount/12.0 ELSE amount END),0) as s FROM fixed_expenses WHERE user_id=? AND active=1 AND is_investment=1",
        )
        .get(userId) as { s: number }
    ).s;

    const spendingByMonth = Object.fromEntries(
      spendingRows.map((r) => [r.month, r.total]),
    );

    const monthly = months.map((mo) => {
      const { totalIncome: income, tsp } = computeMonthlyFinancials(
        db,
        mo,
        userId,
      );
      const spending = spendingByMonth[mo] ?? 0;
      const hasData = income > 0 || spending > 0;
      const invested = hasData ? tsp + investmentFixed : 0;
      const net = income - invested - spending;
      const savingsRate =
        income > 0
          ? Math.round(
              ((tsp + investmentFixed + Math.max(0, net)) / income) * 100,
            )
          : 0;
      return {
        month: mo,
        income: Math.round(income),
        invested: Math.round(invested),
        spending: Math.round(spending),
        net: Math.round(net),
        savingsRate,
        hasData,
      };
    });

    const quarters = [1, 2, 3, 4].map((q) => {
      const slice = monthly.slice((q - 1) * 3, q * 3);
      const hasData = slice.some((m) => m.hasData);
      const income = slice.reduce((s, m) => s + (m.hasData ? m.income : 0), 0);
      const invested = slice.reduce(
        (s, m) => s + (m.hasData ? m.invested : 0),
        0,
      );
      const spending = slice.reduce(
        (s, m) => s + (m.hasData ? m.spending : 0),
        0,
      );
      const net = income - invested - spending;
      const savingsRate =
        income > 0
          ? Math.round(((invested + Math.max(0, net)) / income) * 100)
          : 0;
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

    const monthsWithData = monthly.filter((m) => m.hasData).length;
    const annualIncome = quarters.reduce((s, q) => s + q.income, 0);
    const annualInvested = quarters.reduce((s, q) => s + q.invested, 0);
    const annualSpending = quarters.reduce((s, q) => s + q.spending, 0);
    const annualNet = annualIncome - annualInvested - annualSpending;
    const annualSavingsRate =
      annualIncome > 0
        ? Math.round(
            ((annualInvested + Math.max(0, annualNet)) / annualIncome) * 100,
          )
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
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
