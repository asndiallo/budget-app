import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare('SELECT * FROM income_streams WHERE user_id = ? AND active = 1 ORDER BY id')
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const {
    label,
    amount,
    frequency,
    day_of_month,
    category,
    variable,
    start_date,
    end_date,
    notes,
  } = await req.json();
  const freq = frequency === 'biweekly' ? 'biweekly' : 'monthly';
  const dom = day_of_month ? Number(day_of_month) : null;
  const cat = typeof category === 'string' && category.trim() ? category : 'Other';
  const isVariable = variable ? 1 : 0;
  const start = start_date ?? null;
  const end = end_date ?? null;
  if (freq === 'biweekly' && !start) {
    return NextResponse.json(
      { error: 'start_date is required for biweekly frequency' },
      { status: 400 },
    );
  }
  const result = db
    .prepare(
      'INSERT INTO income_streams (user_id, label, amount, frequency, day_of_month, category, variable, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(userId, label, amount, freq, dom, cat, isVariable, start, end, notes ?? null);
  return NextResponse.json({
    id: result.lastInsertRowid,
    label,
    amount,
    frequency: freq,
    day_of_month: dom,
    category: cat,
    variable: isVariable,
    start_date: start,
    end_date: end,
    notes: notes ?? null,
    active: 1,
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const {
    id,
    label,
    amount,
    frequency,
    day_of_month,
    category,
    variable,
    start_date,
    end_date,
    notes,
  } = await req.json();
  const freq = frequency === 'biweekly' ? 'biweekly' : 'monthly';
  const dom = day_of_month ? Number(day_of_month) : null;
  const start = start_date ?? null;
  const end = end_date ?? null;
  if (freq === 'biweekly' && !start) {
    return NextResponse.json(
      { error: 'start_date is required for biweekly frequency' },
      { status: 400 },
    );
  }
  db.prepare(
    'UPDATE income_streams SET label = ?, amount = ?, frequency = ?, day_of_month = ?, category = ?, variable = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ? AND user_id = ?',
  ).run(
    label,
    amount,
    freq,
    dom,
    typeof category === 'string' && category.trim() ? category : 'Other',
    variable ? 1 : 0,
    start,
    end,
    notes ?? null,
    id,
    userId,
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('UPDATE income_streams SET active = 0 WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
