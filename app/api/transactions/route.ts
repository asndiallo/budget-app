import { DEFAULT_CATEGORY } from '@/lib/config';
import { NextResponse } from 'next/server';
import { currentMonth } from '@/lib/utils';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || currentMonth();
  const rows = db
    .prepare(
      'SELECT * FROM transactions WHERE month = ? ORDER BY created_at DESC',
    )
    .all(month);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { description, amount, category, month, source } = await req.json();
  const m = month || currentMonth();
  const result = db
    .prepare(
      'INSERT INTO transactions (description, amount, category, month, source) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      description,
      amount,
      category || DEFAULT_CATEGORY,
      m,
      source || 'manual',
    );
  return NextResponse.json({
    id: result.lastInsertRowid,
    description,
    amount,
    category,
    month: m,
  });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json();
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
