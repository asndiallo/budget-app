import { NextResponse } from 'next/server';
import type { YtdSummary } from '@/lib/types';
import { computeMonthlyFinancials } from '@/lib/income';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || currentMonth();

    const year = month.slice(0, 4);
    const [, m] = month.split('-').map(Number);
    const months = Array.from({ length: m }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

    const spendingRows = db
      .prepare(
        `SELECT month, SUM(amount) AS total
         FROM transactions
         WHERE user_id = ? AND month IN (${months.map(() => '?').join(',')})
         GROUP BY month`,
      )
      .all(userId, ...months) as { month: string; total: number }[];

    const spendingByMonth = Object.fromEntries(spendingRows.map((r) => [r.month, r.total]));

    const investmentFixedMonthly = (
      db.prepare(
        "SELECT COALESCE(SUM(CASE WHEN period='annual' THEN amount/12.0 ELSE amount END),0) as s FROM fixed_expenses WHERE user_id=? AND active=1 AND is_investment=1",
      ).get(userId) as { s: number }
    ).s;

    let totalIncome = 0;
    let totalInvested = 0;
    let totalSpending = 0;
    let monthsRecorded = 0;

    for (const mo of months) {
      const { totalIncome: inc, tsp } = computeMonthlyFinancials(db, mo, userId);
      const spending = spendingByMonth[mo] ?? 0;
      if (inc > 0 || spending > 0) {
        totalIncome += inc;
        totalInvested += tsp + investmentFixedMonthly;
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
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
