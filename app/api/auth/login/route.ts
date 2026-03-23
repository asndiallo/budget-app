import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, signToken, tokenCookie } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 },
      );
    }

    const db = getDb();
    const user = db
      .prepare(
        'SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?',
      )
      .get(username) as {
      id: number;
      username: string;
      password_hash: string;
      role: UserRole;
      display_name: string;
    } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Setup wizard: if password_hash is empty, this is the placeholder admin.
    // Redirect to /setup to complete profile creation.
    if (user.password_hash === '') {
      return NextResponse.json({ setupRequired: true }, { status: 200 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({
      sub: String(user.id),
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    });

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
    });
    response.headers.set('Set-Cookie', tokenCookie(token));
    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
