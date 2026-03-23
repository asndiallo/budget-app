import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRequestUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { userId } = getRequestUser(req);
    const db = getDb();

    const user = db
      .prepare(
        `SELECT id, username, role, display_name, branch, pay_grade, mos,
                duty_station, bah_zip, component, dependents, years_of_service,
                created_at, updated_at
         FROM users WHERE id = ?`,
      )
      .get(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
