import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY id')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label, lender, balance, monthly_payment, interest_rate, day_of_month } =
    await req.json();
  const dom = day_of_month ? Number(day_of_month) : null;
  const result = db
    .prepare(
      'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(userId, label, lender ?? '', balance ?? 0, monthly_payment ?? 0, interest_rate ?? 0, dom);
  return NextResponse.json({
    id: result.lastInsertRowid,
    label, lender: lender ?? '',
    balance: balance ?? 0, monthly_payment: monthly_payment ?? 0,
    interest_rate: interest_rate ?? 0, day_of_month: dom,
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const { id, label, lender, balance, monthly_payment, interest_rate, day_of_month } =
    await req.json();
  db.prepare(
    `UPDATE debts SET
       label           = ?,
       lender          = ?,
       balance         = ?,
       monthly_payment = ?,
       interest_rate   = ?,
       day_of_month    = ?
     WHERE id = ? AND user_id = ?`,
  ).run(
    label, lender, balance, monthly_payment, interest_rate,
    day_of_month ? Number(day_of_month) : null,
    id, userId,
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
