import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';
import type { ApiKey, ApiKeyCreated } from '@/lib/types';

function generateApiKey(): string {
  return 'fld_' + randomBytes(24).toString('hex');
}

export const GET = withAuth(async (_req, { userId, db }) => {
  const rows = db
    .prepare(
      'SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    )
    .all(userId) as ApiKey[];
  return NextResponse.json(rows);
});

export const POST = withAuth(async (req, { userId, db }) => {
  const { name } = (await req.json()) as { name: string };
  const trimmed = name?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const key = generateApiKey();
  const keyHash = createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.slice(0, 16);

  const result = db
    .prepare('INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)')
    .run(userId, trimmed, keyHash, keyPrefix);

  const row = db
    .prepare('SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE id = ?')
    .get(result.lastInsertRowid) as ApiKey;

  return NextResponse.json({ ...row, key } satisfies ApiKeyCreated, { status: 201 });
});

export const DELETE = withAuth(async (req, { userId, db }) => {
  const { id } = (await req.json()) as { id: number };
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(id, userId);
  return NextResponse.json({ ok: true });
});
