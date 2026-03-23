import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM assets ORDER BY category, label')
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const db = getDb();
  const { label, category, balance } = await req.json();
  const row = db
    .prepare(
      'INSERT INTO assets (label, category, balance) VALUES (?, ?, ?) RETURNING *',
    )
    .get(label, category ?? 'Other', balance ?? 0);
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  const db = getDb();
  const { id, label, category, balance } = await req.json();
  db.prepare(
    `UPDATE assets SET
       label      = COALESCE(?, label),
       category   = COALESCE(?, category),
       balance    = COALESCE(?, balance),
       updated_at = datetime('now')
     WHERE id = ?`,
  ).run(label ?? null, category ?? null, balance ?? null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = getDb();
  const { id } = await req.json();
  db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
