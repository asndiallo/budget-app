import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY id')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label, lender, balance, monthly_payment, interest_rate } =
    await req.json();
  const result = db
    .prepare(
      'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      userId,
      label,
      lender ?? '',
      balance ?? 0,
      monthly_payment ?? 0,
      interest_rate ?? 0,
    );
  return NextResponse.json({
    id: result.lastInsertRowid,
    label,
    lender: lender ?? '',
    balance: balance ?? 0,
    monthly_payment: monthly_payment ?? 0,
    interest_rate: interest_rate ?? 0,
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const { id, label, lender, balance, monthly_payment, interest_rate } =
    await req.json();
  db.prepare(
    'UPDATE debts SET label = COALESCE(?, label), lender = COALESCE(?, lender), balance = COALESCE(?, balance), monthly_payment = COALESCE(?, monthly_payment), interest_rate = COALESCE(?, interest_rate) WHERE id = ? AND user_id = ?',
  ).run(
    label ?? null,
    lender ?? null,
    balance ?? null,
    monthly_payment ?? null,
    interest_rate ?? null,
    id,
    userId,
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
