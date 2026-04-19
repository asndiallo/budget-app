import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

export const GET = withAuth(async (req, { userId, db }) => {
  const rows = db
    .prepare(
      'SELECT * FROM financial_accounts WHERE user_id = ? AND active = 1 ORDER BY created_at ASC',
    )
    .all(userId);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const body = await req.json();

  // Back-fill: run institution detection on all existing unlinked transactions
  if (body.action === 'backfill') {
    const accounts = db
      .prepare(
        "SELECT id, institution FROM financial_accounts WHERE user_id = ? AND active = 1 AND institution != ''",
      )
      .all(userId) as { id: number; institution: string }[];

    if (!accounts.length) return NextResponse.json({ ok: true, updated: 0 });

    const unlinked = db
      .prepare('SELECT id, description FROM transactions WHERE user_id = ? AND account_id IS NULL')
      .all(userId) as { id: number; description: string }[];

    const update = db.prepare(
      'UPDATE transactions SET account_id = ? WHERE id = ? AND user_id = ?',
    );

    let updated = 0;
    db.transaction(() => {
      for (const tx of unlinked) {
        const lower = tx.description.toLowerCase();
        const matches = accounts.filter((a) => lower.includes(a.institution.toLowerCase()));
        if (matches.length === 1) {
          update.run(matches[0].id, tx.id, userId);
          updated++;
        }
      }
    })();

    return NextResponse.json({ ok: true, updated });
  }

  const { name, type, institution, notes } = body;
  const result = db
    .prepare(
      'INSERT INTO financial_accounts (user_id, name, type, institution, notes) VALUES (?, ?, ?, ?, ?)',
    )
    .run(userId, name, type || 'other', institution || '', notes ?? null);
  const row = db
    .prepare('SELECT * FROM financial_accounts WHERE id = ?')
    .get(result.lastInsertRowid);
  return NextResponse.json(row);
});

export const PATCH = withAuth(async (req, { userId, db }) => {
  const body = await req.json();
  const { id } = body;
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (body.name != null) {
    sets.push('name = ?');
    vals.push(body.name);
  }
  if (body.type != null) {
    sets.push('type = ?');
    vals.push(body.type);
  }
  if (body.institution != null) {
    sets.push('institution = ?');
    vals.push(body.institution);
  }
  if ('notes' in body) {
    sets.push('notes = ?');
    vals.push(body.notes ?? null);
  }
  if (body.active != null) {
    sets.push('active = ?');
    vals.push(body.active);
  }

  if (sets.length > 0) {
    db.prepare(`UPDATE financial_accounts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(
      ...vals,
      id,
      userId,
    );
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = await req.json();
  db.prepare('DELETE FROM financial_accounts WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
