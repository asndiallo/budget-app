// Better Auth server instance + request helpers.
// Server-only — never import this in client components.

import {
  SEED_DEBTS,
  SEED_FIXED_EXPENSES,
  SEED_GOALS,
  SEED_PAYMENT_SOURCES,
} from './config';
import { getBAH, getBAS, getBasePay, isOfficer } from './pay-tables';
import type { PayGrade } from './pay-tables';

import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';
import { getDb } from './db';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'budget.db');

export const auth = betterAuth({
  database: {
    db: new Database(DB_PATH),
    type: 'sqlite',
  },

  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',

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
      role:             { type: 'string',  defaultValue: 'user',   input: false },
      branch:           { type: 'string',  defaultValue: 'Army',   input: true  },
      pay_grade:        { type: 'string',  defaultValue: 'E-3',    input: true  },
      mos:              { type: 'string',  defaultValue: '',        input: true  },
      duty_station:     { type: 'string',  defaultValue: '',        input: true  },
      bah_zip:          { type: 'string',  defaultValue: '',        input: true  },
      component:        { type: 'string',  defaultValue: 'Active', input: true  },
      dependents:       { type: 'number',  defaultValue: 0,         input: true  },
      years_of_service: { type: 'number',  defaultValue: 0,         input: true  },
    },
  },

  session: {
    modelName: 'sessions',
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },

  account:      { modelName: 'accounts'     },
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
          const grade = ((user as Record<string, unknown>).pay_grade as PayGrade) ?? 'E-3';
          const yos   = ((user as Record<string, unknown>).years_of_service as number) ?? 0;
          const ds    = ((user as Record<string, unknown>).duty_station as string) ?? '';
          const deps  = ((user as Record<string, unknown>).dependents as number) ?? 0;

          const basePay = getBasePay(grade, yos);
          const bas     = getBAS(grade);
          const bah     = getBAH(ds, grade, deps > 0);

          const incomeSeed: Record<string, number> = {
            base_pay:         basePay,
            bas,
            bah,
            other:            0,
            tsp_rate:         0.05,
            taxes:            Math.round(basePay * (isOfficer(grade) ? 0.12 : 0.06) * 100) / 100,
            fica_soc_security: Math.round(basePay * 0.062 * 100) / 100,
            fica_medicare:    Math.round(basePay * 0.0145 * 100) / 100,
            sgli:             26.0,
            afrh:             0.5,
            meal_deduction:   0,
            roth_ira:         0,
          };

          const ins = db.prepare(
            'INSERT OR IGNORE INTO income_config (user_id, month, key, value) VALUES (?, ?, ?, ?)',
          );
          db.transaction(() => {
            for (const [key, value] of Object.entries(incomeSeed))
              ins.run(userId, '0000-00', key, value);
          })();

          // Seed fixed expenses
          const fxIns = db.prepare(
            'INSERT INTO fixed_expenses (user_id, label, amount, period) VALUES (?, ?, ?, ?)',
          );
          db.transaction(() => {
            for (const { label, amount, period } of SEED_FIXED_EXPENSES)
              fxIns.run(userId, label, amount, period);
          })();

          // Seed goals
          const goIns = db.prepare(
            'INSERT INTO goals (user_id, name, target, saved, color) VALUES (?, ?, ?, ?, ?)',
          );
          db.transaction(() => {
            for (const { name, target, saved, color } of SEED_GOALS)
              goIns.run(userId, name, target, saved, color);
          })();

          // Seed payment sources
          const psIns = db.prepare(
            'INSERT INTO payment_sources (user_id, label) VALUES (?, ?)',
          );
          db.transaction(() => {
            for (const { label } of SEED_PAYMENT_SOURCES) psIns.run(userId, label);
          })();

          // Seed debts
          const dtIns = db.prepare(
            'INSERT INTO debts (user_id, label, lender, balance, monthly_payment, interest_rate) VALUES (?, ?, ?, ?, ?, ?)',
          );
          db.transaction(() => {
            for (const { label, lender, balance, monthly_payment, interest_rate } of SEED_DEBTS)
              dtIns.run(userId, label, lender, balance, monthly_payment, interest_rate);
          })();
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
    userId:      u.id as string,
    email:       u.email as string,
    role:        (u.role as UserRole) ?? 'user',
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
