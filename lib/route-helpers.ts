// Route handler middleware — wraps authenticated handlers to eliminate boilerplate.
// Server-only: never import this in client components.
//
// Usage:
//   export const GET = withAuth(async (_req, { userId, db }) => {
//     const rows = db.prepare('SELECT ...').all(userId);
//     return NextResponse.json(rows);
//   });

import { NextResponse } from 'next/server';
import type { RequestUser } from './auth';
import { getDb } from './db';
import { requireAuth } from './auth';

export type AuthContext = {
  userId: string;
  user: RequestUser;
  db: ReturnType<typeof getDb>;
};

type AuthHandler = (req: Request, ctx: AuthContext) => Promise<Response>;

/**
 * Wraps a route handler with session authentication and unified error handling.
 * - Injects { userId, user, db } into the handler.
 * - Returns 401 automatically when the session is absent (thrown by requireAuth).
 * - Returns 500 for all other unhandled errors.
 */
export function withAuth(
  handler: AuthHandler,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const user = await requireAuth(req);
      const db = getDb();
      return await handler(req, { userId: user.userId, user, db });
    } catch (err) {
      if (err instanceof Response) return err;
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  };
}
