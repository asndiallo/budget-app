import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-helpers';
import type { IncomeProfile } from '@/lib/types';

type ProfileRow = Omit<IncomeProfile, 'fields'> & { fields: string };

function parseRow(row: ProfileRow): IncomeProfile {
  return { ...row, fields: JSON.parse(row.fields || '{}') };
}

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      `SELECT id, name, type, start_date, end_date, fields, notes, created_at
       FROM income_profiles WHERE user_id = ? ORDER BY start_date DESC`,
    )
    .all(userId) as ProfileRow[];
  return NextResponse.json(rows.map(parseRow));
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { name, type, start_date, end_date, fields, notes } = await req.json();
  const result = db
    .prepare(
      `INSERT INTO income_profiles (user_id, name, type, start_date, end_date, fields, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      name,
      type ?? 'custom',
      start_date,
      end_date ?? null,
      JSON.stringify(fields ?? {}),
      notes ?? null,
    );
  return NextResponse.json({ id: result.lastInsertRowid });
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const { id, name, type, start_date, end_date, fields, notes } = await req.json();
  db.prepare(
    `UPDATE income_profiles
     SET name=?, type=?, start_date=?, end_date=?, fields=?, notes=?
     WHERE id=? AND user_id=?`,
  ).run(
    name,
    type ?? 'custom',
    start_date,
    end_date ?? null,
    JSON.stringify(fields ?? {}),
    notes ?? null,
    id,
    userId,
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM income_profiles WHERE id=? AND user_id=?').run(id, userId);
  return NextResponse.json({ ok: true });
});
