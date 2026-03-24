/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * Seeds a default admin account if no users exist yet, so the app is
 * immediately usable for testing without going through /register first.
 *
 * Default credentials: admin@example.com / admin123
 * (Change via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    // Importing auth initialises Better Auth and creates its tables (users,
    // sessions, accounts, verifications) if they don't exist yet.
    const { auth } = await import('@/lib/auth');
    const { getDb } = await import('@/lib/db');
    const db = getDb();

    const { n } = db.prepare('SELECT count(*) as n FROM users').get() as {
      n: number;
    };

    if (n > 0) return; // already has users, nothing to do

    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

    await auth.api.signUpEmail({
      body: { email, password, name: 'Admin' },
    });

    console.log(`[budget] Default admin created → ${email} / ${password}`);
  } catch (e) {
    // Non-fatal — user can still register manually at /register
    console.warn('[budget] Could not seed default admin:', e);
  }
}
