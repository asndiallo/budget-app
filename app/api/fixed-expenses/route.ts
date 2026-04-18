import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      'SELECT * FROM fixed_expenses WHERE user_id = ? AND active = 1 ORDER BY id',
    )
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { label, amount, period, day_of_month, notes, is_investment, goal_id, recurrence, recurrence_anchor, end_date } =
    await req.json();
  const p = period === 'annual' ? 'annual' : 'monthly';
  const dom = day_of_month ? Number(day_of_month) : null;
  const inv = is_investment ? 1 : 0;
  const gid = goal_id ? Number(goal_id) : null;
  const rec = recurrence === 'biweekly' ? 'biweekly' : 'monthly';
  const anchor = rec === 'biweekly' ? (recurrence_anchor ?? null) : null;
  const edate = rec === 'biweekly' ? (end_date ?? null) : null;
  if (rec === 'biweekly' && !anchor) {
    return NextResponse.json({ error: 'start_date is required for biweekly recurrence' }, { status: 400 });
  }
  const result = db
    .prepare(
      'INSERT INTO fixed_expenses (user_id, label, amount, period, day_of_month, notes, is_investment, goal_id, recurrence, recurrence_anchor, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(userId, label, amount, p, dom, notes ?? null, inv, gid, rec, anchor, edate);
  return NextResponse.json({
    id: result.lastInsertRowid,
    label, amount, period: p, day_of_month: dom,
    notes: notes ?? null, is_investment: inv, goal_id: gid,
    recurrence: rec, recurrence_anchor: anchor, end_date: edate, active: 1,
  });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const { id, label, amount, period, day_of_month, notes, is_investment, goal_id, recurrence, recurrence_anchor, end_date } =
    await req.json();
  const dom = day_of_month ? Number(day_of_month) : null;
  const gid = goal_id ? Number(goal_id) : null;
  const rec = recurrence === 'biweekly' ? 'biweekly' : 'monthly';
  const anchor = rec === 'biweekly' ? (recurrence_anchor ?? null) : null;
  const edate = rec === 'biweekly' ? (end_date ?? null) : null;
  if (rec === 'biweekly' && !anchor) {
    return NextResponse.json({ error: 'start_date is required for biweekly recurrence' }, { status: 400 });
  }
  db.prepare(
    'UPDATE fixed_expenses SET label = ?, amount = ?, period = ?, day_of_month = ?, notes = ?, is_investment = ?, goal_id = ?, recurrence = ?, recurrence_anchor = ?, end_date = ? WHERE id = ? AND user_id = ?',
  ).run(label, amount, period ?? 'monthly', dom, notes ?? null, is_investment ? 1 : 0, gid, rec, anchor, edate, id, userId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare(
    'UPDATE fixed_expenses SET active = 0 WHERE id = ? AND user_id = ?',
  ).run(id, userId);
  return NextResponse.json({ ok: true });
});
