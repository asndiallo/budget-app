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
  const { label, amount } = await req.json();
  const result = db
    .prepare('INSERT INTO fixed_expenses (label, amount) VALUES (?, ?)')
    .run(label, amount);
  return NextResponse.json({
    id: result.lastInsertRowid,
    label,
    amount,
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
  const { id, label, amount } = await req.json();
  db.prepare(
    'UPDATE fixed_expenses SET label = ?, amount = ? WHERE id = ?',
  ).run(label, amount, id);
  return NextResponse.json({ ok: true });
}
