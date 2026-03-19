import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM payment_sources ORDER BY id').all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { label } = await req.json();
  const result = db
    .prepare('INSERT INTO payment_sources (label) VALUES (?)')
    .run(label);
  return NextResponse.json({ id: result.lastInsertRowid, label });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json();
  db.prepare('DELETE FROM payment_sources WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
