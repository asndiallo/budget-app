import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM receivables WHERE user_id = ? ORDER BY paid ASC, id DESC')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { name, description, amount, month_created } = await req.json();
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO receivables (user_id, name, description, amount, month_created) VALUES (?, ?, ?, ?, ?)',
    )
    .run(userId, name, description || '', amount, month_created);
  const row = db.prepare('SELECT * FROM receivables WHERE id = ?').get(lastInsertRowid);
  return NextResponse.json(row);
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const body = await req.json();

  if (!('payment' in body)) {
    const { id, name, description, amount } = body as {
      id: number;
      name?: string;
      description?: string;
      amount?: number;
    };
    db.prepare(
      `UPDATE receivables SET
         name        = COALESCE(?, name),
         description = COALESCE(?, description),
         amount      = COALESCE(?, amount)
       WHERE id = ? AND user_id = ?`,
    ).run(name ?? null, description ?? null, amount ?? null, id, userId);
    return NextResponse.json({ ok: true });
  }

  const { id, payment, month } = body as {
    id: number;
    payment: number;
    month: string;
  };
  const row = db
    .prepare('SELECT * FROM receivables WHERE id = ? AND user_id = ?')
    .get(id, userId) as
    | { name: string; description: string; amount: number; amount_paid: number }
    | undefined;
  if (!row) return NextResponse.json({ ok: false }, { status: 404 });

  const newPaid = Math.min(row.amount_paid + payment, row.amount);
  const fullyPaid = newPaid >= row.amount;
  const label = `From ${row.name}${row.description ? ` — ${row.description}` : ''}`;

  db.transaction(() => {
    db.prepare(
      'UPDATE receivables SET amount_paid = ?, paid = ?, month_paid = ? WHERE id = ? AND user_id = ?',
    ).run(newPaid, fullyPaid ? 1 : 0, fullyPaid ? month : null, id, userId);
    db.prepare(
      'INSERT INTO income_entries (user_id, description, amount, month, source) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, label, payment, month, 'Receivable');
  })();

  return NextResponse.json({ ok: true, fullyPaid });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM receivables WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
