import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (req, { userId, db }) => {
  const month = new URL(req.url).searchParams.get('month');
  if (!month)
    return NextResponse.json({ error: 'month required' }, { status: 400 });
  const rows = db
    .prepare(
      'SELECT id, fixed_expense_id, month, paid_at FROM bill_payments WHERE user_id = ? AND month = ?',
    )
    .all(userId, month) as {
    id: number;
    fixed_expense_id: number;
    month: string;
    paid_at: string;
  }[];
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { fixed_expense_id, month } = await req.json();
  db.prepare(
    'INSERT OR IGNORE INTO bill_payments (user_id, fixed_expense_id, month) VALUES (?, ?, ?)',
  ).run(userId, fixed_expense_id, month);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { fixed_expense_id, month } = await req.json();
  db.prepare(
    'DELETE FROM bill_payments WHERE user_id = ? AND fixed_expense_id = ? AND month = ?',
  ).run(userId, fixed_expense_id, month);
  return NextResponse.json({ ok: true });
});
