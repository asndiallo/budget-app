/**
 * lib/queries.ts — shared database access helpers.
 *
 * Single source of truth for queries that would otherwise be repeated
 * across multiple API routes. Every function is pure (no side effects beyond
 * reading) and accepts the db + userId so callers stay in control of
 * the connection lifetime.
 */

import type Database from 'better-sqlite3';

import type { InvestmentExpense } from './utils';

type Db = Database.Database;

// ── User ──────────────────────────────────────────────────────────────────────

/** Returns the user's service start month (YYYY-MM), or null when not set. */
export function getJoinedAt(db: Db, userId: string): string | null {
  const row = db.prepare('SELECT joined_at FROM users WHERE id = ?').get(userId) as
    | { joined_at: string | null }
    | undefined;
  return row?.joined_at ?? null;
}

// ── Fixed expenses ─────────────────────────────────────────────────────────────

/**
 * All active investment fixed expenses for a user.
 * Used by investmentForMonth() across the overview, ytd, insights, and health-score routes.
 */
export function getInvestmentExpenses(db: Db, userId: string): InvestmentExpense[] {
  return db
    .prepare(
      `SELECT amount, period, recurrence, recurrence_anchor, end_date
       FROM fixed_expenses WHERE user_id = ? AND active = 1 AND is_investment = 1`,
    )
    .all(userId) as InvestmentExpense[];
}

// ── Debts ─────────────────────────────────────────────────────────────────────

/** Sum of monthly_payment for all debts with a positive balance. */
export function getActiveDebtPaymentsTotal(db: Db, userId: string): number {
  return (
    db
      .prepare(
        'SELECT COALESCE(SUM(monthly_payment), 0) AS total FROM debts WHERE user_id = ? AND balance > 0',
      )
      .get(userId) as { total: number }
  ).total;
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Total spending for a single month.
 * Pass excludeCategory to omit one category (e.g. INVESTMENT_CATEGORY).
 */
export function getMonthSpending(
  db: Db,
  userId: string,
  month: string,
  excludeCategory?: string,
): number {
  if (excludeCategory) {
    return (
      db
        .prepare(
          'SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE user_id = ? AND month = ? AND category != ?',
        )
        .get(userId, month, excludeCategory) as { s: number }
    ).s;
  }
  return (
    db
      .prepare(
        'SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE user_id = ? AND month = ?',
      )
      .get(userId, month) as { s: number }
  ).s;
}

/** Total of a specific category for a single month. */
export function getMonthCategoryTotal(
  db: Db,
  userId: string,
  month: string,
  category: string,
): number {
  return (
    db
      .prepare(
        'SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE user_id = ? AND month = ? AND category = ?',
      )
      .get(userId, month, category) as { s: number }
  ).s;
}

/**
 * Spending totals keyed by month for a batch of months.
 * Optionally excludes one category (e.g. INVESTMENT_CATEGORY).
 */
export function getSpendingByMonth(
  db: Db,
  userId: string,
  months: string[],
  excludeCategory?: string,
): Record<string, number> {
  if (months.length === 0) return {};
  const ph = months.map(() => '?').join(',');
  const rows = excludeCategory
    ? (db
        .prepare(
          `SELECT month, COALESCE(SUM(amount), 0) AS total
           FROM transactions WHERE user_id = ? AND month IN (${ph}) AND category != ?
           GROUP BY month`,
        )
        .all(userId, ...months, excludeCategory) as { month: string; total: number }[])
    : (db
        .prepare(
          `SELECT month, COALESCE(SUM(amount), 0) AS total
           FROM transactions WHERE user_id = ? AND month IN (${ph})
           GROUP BY month`,
        )
        .all(userId, ...months) as { month: string; total: number }[]);
  return Object.fromEntries(rows.map((r) => [r.month, r.total]));
}

/**
 * Totals for a specific category, keyed by month, for a batch of months.
 */
export function getCategoryTotalByMonth(
  db: Db,
  userId: string,
  months: string[],
  category: string,
): Record<string, number> {
  if (months.length === 0) return {};
  const ph = months.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT month, COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE user_id = ? AND month IN (${ph}) AND category = ?
       GROUP BY month`,
    )
    .all(userId, ...months, category) as { month: string; total: number }[];
  return Object.fromEntries(rows.map((r) => [r.month, r.total]));
}

// ── Assets / goals ────────────────────────────────────────────────────────────

/** Liquid assets: Checking + Savings account balances plus active goal balances. */
export function getLiquidAssets(db: Db, userId: string): number {
  const { assets } = db
    .prepare(
      "SELECT COALESCE(SUM(balance), 0) AS assets FROM assets WHERE user_id = ? AND category IN ('Checking', 'Savings')",
    )
    .get(userId) as { assets: number };
  const { goals } = db
    .prepare('SELECT COALESCE(SUM(saved), 0) AS goals FROM goals WHERE user_id = ? AND active = 1')
    .get(userId) as { goals: number };
  return assets + goals;
}

// ── Financial accounts ────────────────────────────────────────────────────────

/**
 * Active financial accounts that have an institution keyword set.
 * Used by detectAccountId() to auto-link transactions on import.
 */
export function getAccountsForDetection(
  db: Db,
  userId: string,
): { id: number; institution: string }[] {
  return db
    .prepare(
      "SELECT id, institution FROM financial_accounts WHERE user_id = ? AND active = 1 AND institution != ''",
    )
    .all(userId) as { id: number; institution: string }[];
}

// ── Categorization rules ──────────────────────────────────────────────────────

/** User-defined keyword → category rules, applied during categorization. */
export function getUserCategorizationRules(
  db: Db,
  userId: string,
): { keyword: string; category: string }[] {
  return db
    .prepare('SELECT keyword, category FROM categorization_rules WHERE user_id = ?')
    .all(userId) as { keyword: string; category: string }[];
}
