// Auth utilities: JWT signing/verification + password hashing.
// Server-only — never import this in client components.

import { SignJWT, jwtVerify } from 'jose';

import bcrypt from 'bcryptjs';
import { getDb } from './db';

const JWT_EXPIRY = '7d';
const COOKIE_NAME = 'token';

export { COOKIE_NAME };

// ── JWT secret ────────────────────────────────────────────────────────────────
// Loaded from AUTH_SECRET env var (injected by next.config.js on every startup).
// Falls back to DB-stored value for contexts that don't have the env var.

function getJwtSecret(): Uint8Array {
  if (process.env.AUTH_SECRET) {
    return new TextEncoder().encode(process.env.AUTH_SECRET);
  }
  // DB fallback (should not be reached in normal operation)
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = 'jwt_secret'")
    .get() as { value: string } | undefined;

  if (row) return new TextEncoder().encode(row.value);
  throw new Error('AUTH_SECRET not configured. Start the app via `bun dev`.');
}

// ── Token payload ─────────────────────────────────────────────────────────────

export interface TokenPayload {
  sub: string; // user id as string
  username: string;
  role: UserRole;
  displayName: string;
}

export type UserRole = 'admin' | 'user' | 'viewer';

// ── JWT helpers ───────────────────────────────────────────────────────────────

export async function signToken(payload: TokenPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as TokenPayload;
}

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Cookie helpers (for API routes, not middleware) ───────────────────────────

export function tokenCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearTokenCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

// ── Request user extractor (used in API routes) ───────────────────────────────

export interface RequestUser {
  userId: number;
  username: string;
  role: UserRole;
  displayName: string;
}

/**
 * Extract the authenticated user from request headers.
 * Middleware injects x-user-* headers after JWT verification.
 * Throws a Response (401) if not authenticated.
 */
export function getRequestUser(req: Request): RequestUser {
  const userId = req.headers.get('x-user-id');
  const username = req.headers.get('x-user-username');
  const role = req.headers.get('x-user-role') as UserRole | null;
  const displayName = req.headers.get('x-user-display-name') ?? '';

  if (!userId || !username || !role) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return {
    userId: parseInt(userId, 10),
    username,
    role,
    displayName,
  };
}

/**
 * Check if the current user is an admin.
 * Throws 403 if not.
 */
export function requireAdmin(user: RequestUser): void {
  if (user.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
