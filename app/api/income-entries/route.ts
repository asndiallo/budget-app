import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const month = new URL(req.url).searchParams.get('month');
  if (!month) return NextResponse.json([]);
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM income_entries WHERE month = ? ORDER BY id DESC')
    .all(month);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { description, amount, month, source } = await req.json();
  const db = getDb();
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO income_entries (description, amount, month, source) VALUES (?, ?, ?, ?)',
    )
    .run(description, amount, month, source || 'Other');
  const row = db
    .prepare('SELECT * FROM income_entries WHERE id = ?')
    .get(lastInsertRowid);
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  getDb().prepare('DELETE FROM income_entries WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
