import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM fixed_expenses WHERE active = 1 ORDER BY id')
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { label, amount, period, day_of_month } = await req.json();
  const p = period === 'annual' ? 'annual' : 'monthly';
  const dom = day_of_month ? Number(day_of_month) : null;
  const result = db
    .prepare(
      'INSERT INTO fixed_expenses (label, amount, period, day_of_month) VALUES (?, ?, ?, ?)',
    )
    .run(label, amount, p, dom);
  return NextResponse.json({
    id: result.lastInsertRowid,
    label,
    amount,
    period: p,
    day_of_month: dom,
    active: 1,
  });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json();
  db.prepare('UPDATE fixed_expenses SET active = 0 WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const db = getDb();
  const { id, label, amount, period, day_of_month } = await req.json();
  const dom = day_of_month ? Number(day_of_month) : null;
  db.prepare(
    'UPDATE fixed_expenses SET label = ?, amount = ?, period = ?, day_of_month = ? WHERE id = ?',
  ).run(label, amount, period ?? 'monthly', dom, id);
  return NextResponse.json({ ok: true });
}
