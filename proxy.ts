import { type NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  if (isPublic) return NextResponse.next();

  // API routes enforce their own auth via withAuth (session cookie OR Bearer
  // API key — see lib/route-helpers.ts) and return a proper 401 JSON body.
  // Redirecting them to /login here would make the Bearer-token path
  // unreachable, since a bearer-authenticated request never carries the
  // session cookie this check looks for.
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // Better Auth stores the session in this cookie
  const sessionCookie =
    req.cookies.get('better-auth.session_token') ??
    req.cookies.get('__Secure-better-auth.session_token');

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
