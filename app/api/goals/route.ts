import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM goals WHERE active = 1 ORDER BY id')
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { name, target, saved, color } = await req.json();
  const result = db
    .prepare(
      'INSERT INTO goals (name, target, saved, color) VALUES (?, ?, ?, ?)',
    )
    .run(name, target, saved || 0, color || 'blue');
  return NextResponse.json({
    id: result.lastInsertRowid,
    name,
    target,
    saved: saved || 0,
    color: color || 'blue',
  });
}

export async function PATCH(req: Request) {
  const db = getDb();
  const { id, saved } = await req.json();
  db.prepare('UPDATE goals SET saved = ? WHERE id = ?').run(saved, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json();
  db.prepare('UPDATE goals SET active = 0 WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
