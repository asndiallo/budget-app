import { APIError } from 'better-auth/api';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { withAuth } from '@/lib/route-helpers';

// Better Auth's own setPassword endpoint has no HTTP path (it's meant to be
// called via auth.api.setPassword, not fetched directly) — this route is the
// HTTP entry point the profile UI's "Password login" form calls.
export const POST = withAuth(async (req) => {
  const { newPassword } = await req.json();
  try {
    await auth.api.setPassword({ headers: req.headers, body: { newPassword } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof APIError) {
      return NextResponse.json(
        { error: e.body?.message, code: e.body?.code },
        { status: e.statusCode },
      );
    }
    throw e;
  }
});
