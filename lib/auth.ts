// Better Auth server instance + request helpers.
// Server-only — never import this in client components.

import {
  SEED_DEBTS,
  SEED_FIXED_EXPENSES,
  SEED_GOALS,
  SEED_PAYMENT_SOURCES,
} from './config';
import { getBAH, getBAS, getBasePay, isOfficer } from './pay-tables';

import Database from 'better-sqlite3';
import type { PayGrade } from './pay-tables';
import { betterAuth } from 'better-auth';
import { getDb } from './db';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'budget.db');

export const auth = betterAuth({
  database: new Database(DB_PATH),

  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://172.20.10.3:3000'],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  // Social providers — only enabled when env vars are set
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
  },

  user: {
    modelName: 'users',
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
      branch: { type: 'string', defaultValue: 'Air Force', input: true },
      pay_grade: { type: 'string', defaultValue: 'E-3', input: true },
      mos: { type: 'string', defaultValue: '', input: true },
      duty_station: {
        type: 'string',
        defaultValue: 'JBSA Fort Sam Houston',
        input: true,
      },
      bah_zip: { type: 'string', defaultValue: '', input: true },
      component: { type: 'string', defaultValue: 'Active', input: true },
      dependents: { type: 'number', defaultValue: 0, input: true },
      years_of_service: { type: 'number', defaultValue: 0, input: true },
      joined_at: { type: 'string', defaultValue: '', input: true },
    },
  },

  session: {
    modelName: 'sessions',
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },

  account: { modelName: 'accounts' },
  verification: { modelName: 'verifications' },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const db = getDb();
          const userId = user.id;

          // First user becomes admin
          const count = (
            db.prepare('SELECT count(*) as n FROM users').get() as { n: number }
          ).n;
          if (count === 1) {
            db.prepare('UPDATE users SET role = ? WHERE id = ?').run(
              'admin',
              userId,
            );
          }

          // Seed income config from pay tables
          const grade =
            ((user as Record<string, unknown>).pay_grade as PayGrade) ?? 'E-3';
          const yos =
            ((user as Record<string, unknown>).years_of_service as number) ?? 0;
          const ds =
            ((user as Record<string, unknown>).duty_station as string) ?? '';
          const deps =
            ((user as Record<string, unknown>).dependents as number) ?? 0;

          const basePay = getBasePay(grade, yos);
          const bas = getBAS(grade);
          const bah = getBAH(ds, grade, deps > 0);

          const incomeSeed: Record<string, number> = {
            base_pay: basePay,
            bas,
            bah,
            other: 0,
            tsp_rate: 0.05,
            taxes:
              Math.round(basePay * (isOfficer(grade) ? 0.12 : 0.06) * 100) /
              100,
            fica_soc_security: Math.round(basePay * 0.062 * 100) / 100,
            fica_medicare: Math.round(basePay * 0.0145 * 100) / 100,
            sgli: 26.0,
            afrh: 0.5,
            meal_deduction: 0,
            roth_ira: 0,
          };

          const seedRows = (sql: string, rows: unknown[][]): void => {
            const stmt = db.prepare(sql);
            db.transaction(() => {
              for (const vals of rows) stmt.run(userId, ...vals);
            })();
          };

          seedRows(
            'INSERT OR IGNORE INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
            Object.entries(incomeSeed).map(([key, value]) => [
              '0000-00',
              key,
              value,
            ]),
          );

          seedRows(
            'INSERT INTO fixed_expenses (user_id, label, amount, period) VALUES (?, ?, ?, ?)',
            SEED_FIXED_EXPENSES.map(({ label, amount, period }) => [
              label,
              amount,
              period,
            ]),
          );

          seedRows(
            'INSERT INTO goals (user_id, name, target, saved, color) VALUES (?, ?, ?, ?, ?)',
            SEED_GOALS.map(({ name, target, saved, color }) => [
              name,
              target,
              saved,
              color,
            ]),
          );

          seedRows(
            'INSERT INTO payment_sources (user_id, label) VALUES (?, ?)',
            SEED_PAYMENT_SOURCES.map(({ label }) => [label]),
          );

          seedRows(
            'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
            SEED_DEBTS.map(
              ({ label, lender, balance, monthly_payment, interest_rate }) => [
                label,
                lender,
                balance,
                monthly_payment,
                interest_rate,
              ],
            ),
          );
        },
      },
    },
  },
});

// ── Request helpers ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user' | 'viewer';

export interface RequestUser {
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
}

/**
 * Extracts the authenticated user from the current request via Better Auth session.
 * Throws a 401 Response if unauthenticated — caught by the route's try/catch.
 */
export async function requireAuth(req: Request): Promise<RequestUser> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const u = session.user as Record<string, unknown>;
  return {
    userId: u.id as string,
    email: u.email as string,
    role: (u.role as UserRole) ?? 'user',
    displayName: (u.name as string) ?? '',
  };
}

/** Throws 403 if the user is not an admin. */
export function requireAdmin(user: RequestUser): void {
  if (user.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
