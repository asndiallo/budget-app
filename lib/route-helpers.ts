// Route handler middleware — wraps authenticated handlers to eliminate boilerplate.
// Server-only: never import this in client components.
//
// Usage:
//   export const GET = withAuth(async (_req, { userId, db }) => {
//     const rows = db.prepare('SELECT ...').all(userId);
//     return NextResponse.json(rows);
//   });

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

import type { RequestUser, UserRole } from './auth';
import { requireAuth } from './auth';
import { getDb } from './db';

export type AuthContext = {
  userId: string;
  user: RequestUser;
  db: ReturnType<typeof getDb>;
};

type AuthHandler = (req: Request, ctx: AuthContext) => Promise<Response>;

async function resolveUser(req: Request, db: ReturnType<typeof getDb>): Promise<RequestUser> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = db.prepare('SELECT user_id FROM api_keys WHERE key_hash = ?').get(tokenHash) as
      | { user_id: string }
      | undefined;
    if (!row) {
      throw new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?").run(
      tokenHash,
    );
    const u = db
      .prepare('SELECT id, email, role, name FROM users WHERE id = ?')
      .get(row.user_id) as { id: string; email: string; role: string; name: string } | undefined;
    if (!u) {
      throw new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return {
      userId: u.id,
      email: u.email,
      role: (u.role as UserRole) ?? 'user',
      displayName: u.name ?? '',
    };
  }
  return requireAuth(req);
}

export function withAuth(handler: AuthHandler): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const db = getDb();
      const user = await resolveUser(req, db);
      return await handler(req, { userId: user.userId, user, db });
    } catch (err) {
      if (err instanceof Response) return err;
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  };
}
