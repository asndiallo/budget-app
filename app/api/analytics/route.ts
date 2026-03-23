import { NextResponse } from 'next/server';
import { DEDUCTION_FIELDS } from '@/lib/config';
import { computeMonthlyFinancials, incomeForMonth } from '@/lib/income';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

function prevMonths(to: string, count: number): string[] {
  const [y, m] = to.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function shortLabel(month: string): string {
  const [y, m] = month.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();
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

    const fixedMonthly = (
      db.prepare(
        "SELECT COALESCE(SUM(CASE WHEN period='annual' THEN amount/12.0 ELSE amount END),0) as s FROM fixed_expenses WHERE user_id=? AND active=1 AND (is_investment IS NULL OR is_investment=0)",
      ).get(userId) as { s: number }
    ).s;
    const investmentFixed = (
      db.prepare(
        "SELECT COALESCE(SUM(CASE WHEN period='annual' THEN amount/12.0 ELSE amount END),0) as s FROM fixed_expenses WHERE user_id=? AND active=1 AND is_investment=1",
      ).get(userId) as { s: number }
    ).s;
    const debtPayments = (
      db.prepare('SELECT COALESCE(SUM(monthly_payment),0) as s FROM debts WHERE user_id=? AND balance > 0').get(userId) as { s: number }
    ).s;
    const committed = fixedMonthly + debtPayments;

    const result = months.map((m) => {
      const { totalIncome, tsp } = computeMonthlyFinancials(db, m, userId);
      const config = incomeForMonth(db, m, userId);
      const deductions = tsp + DEDUCTION_FIELDS.reduce((s, f) => s + (config[f.key] ?? 0), 0);
      const categories = spendingMap.get(m) ?? {};
      const spending = Object.values(categories).reduce((s, v) => s + v, 0);
      const net = totalIncome - deductions - committed - spending;
      const savingsRate =
        totalIncome > 0
          ? Math.round(((tsp + investmentFixed + Math.max(0, net)) / totalIncome) * 100)
          : null;

      return { month: m, label: shortLabel(m), totalIncome, tsp, spending, net: totalIncome - tsp - investmentFixed - spending, savingsRate, categories };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
