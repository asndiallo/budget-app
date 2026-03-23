// Next.js Edge middleware — runs before every request.
// Verifies the JWT cookie and injects user info into request headers.
// Public routes (login, setup, auth API) bypass this check.

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/auth/register',
  '/_next',
  '/favicon.ico',
];

const COOKIE_NAME = 'token';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths unconditionally
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // AUTH_SECRET is injected by next.config.js from .jwt-secret file.
    const secretEnv = process.env.AUTH_SECRET ?? '';
    const secret = new TextEncoder().encode(secretEnv);

    const { payload } = await jwtVerify(token, secret);

    // Forward user context to API routes via request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.sub));
    requestHeaders.set('x-user-username', String(payload.username ?? ''));
    requestHeaders.set('x-user-role', String(payload.role ?? 'user'));
    requestHeaders.set('x-user-display-name', String(payload.displayName ?? ''));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Token invalid or expired — redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    // Apply to all routes except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
