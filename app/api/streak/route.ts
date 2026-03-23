import { computeMonthlyFinancials, incomeForMonth } from '@/lib/income';

import { DEDUCTION_FIELDS } from '@/lib/config';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function recentCompleteMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  for (let i = 0; i < n; i++) {
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth(req);
    const db = getDb();

    const fixedExpenses = (
      db
        .prepare(
          'SELECT amount, period FROM fixed_expenses WHERE user_id=? AND active = 1',
        )
        .all(userId) as { amount: number; period: string }[]
    ).reduce(
      (s, f) => s + (f.period === 'annual' ? f.amount / 12 : f.amount),
      0,
    );

    const debtPayments = (
      db
        .prepare(
          'SELECT monthly_payment FROM debts WHERE user_id=? AND balance > 0',
        )
        .all(userId) as { monthly_payment: number }[]
    ).reduce((s, d) => s + d.monthly_payment, 0);

    const committed = fixedExpenses + debtPayments;

    let streak = 0;
    for (const month of recentCompleteMonths(12)) {
      const { totalIncome, tsp } = computeMonthlyFinancials(db, month, userId);
      if (totalIncome === 0) break;

      const config = incomeForMonth(db, month, userId);
      const deductions =
        tsp + DEDUCTION_FIELDS.reduce((s, f) => s + (config[f.key] ?? 0), 0);
      const extraIncome = (
        db
          .prepare(
            'SELECT COALESCE(SUM(amount), 0) as s FROM income_entries WHERE user_id=? AND month = ?',
          )
          .get(userId, month) as { s: number }
      ).s;
      const spending = (
        db
          .prepare(
            'SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE user_id=? AND month = ?',
          )
          .get(userId, month) as { s: number }
      ).s;

      const net = totalIncome + extraIncome - deductions - committed - spending;
      if (net > 0) streak++;
      else break;
    }

    return NextResponse.json({ streak });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
