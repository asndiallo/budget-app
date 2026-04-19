import { NextResponse } from 'next/server';

import { takeNetWorthSnapshot } from '@/lib/db';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY id').all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label, lender, balance, monthly_payment, interest_rate, day_of_month } = await req.json();
  const dom = day_of_month ? Number(day_of_month) : null;
  const result = db
    .prepare(
      'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate, day_of_month) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(userId, label, lender ?? '', balance ?? 0, monthly_payment ?? 0, interest_rate ?? 0, dom);
  takeNetWorthSnapshot(db, userId);
  return NextResponse.json({
    id: result.lastInsertRowid,
    label,
    lender: lender ?? '',
    balance: balance ?? 0,
    monthly_payment: monthly_payment ?? 0,
    interest_rate: interest_rate ?? 0,
    day_of_month: dom,
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const body = await req.json();

  // Apply a detected payment: decrement balance and record to prevent re-suggestion
  if (body.action === 'apply_payment') {
    const { debtId, transactionId, amount } = body as {
      debtId: number;
      transactionId: number;
      amount: number;
    };
    db.transaction(() => {
      db.prepare(`UPDATE debts SET balance = MAX(0, balance - ?) WHERE id = ? AND user_id = ?`).run(
        amount,
        debtId,
        userId,
      );
      db.prepare(
        `INSERT OR IGNORE INTO debt_payments (user_id, debt_id, transaction_id, amount)
         VALUES (?, ?, ?, ?)`,
      ).run(userId, debtId, transactionId, amount);
    })();
    takeNetWorthSnapshot(db, userId);
    return NextResponse.json({ ok: true });
  }

  const { id, label, lender, balance, monthly_payment, interest_rate, day_of_month } = body;
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
    label,
    lender,
    balance,
    monthly_payment,
    interest_rate,
    day_of_month ? Number(day_of_month) : null,
    id,
    userId,
  );
  takeNetWorthSnapshot(db, userId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(id, userId);
  takeNetWorthSnapshot(db, userId);
  return NextResponse.json({ ok: true });
});
