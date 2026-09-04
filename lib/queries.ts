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
import { investmentForMonth, isBeforeMonth } from './utils';

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

// ── Income streams ────────────────────────────────────────────────────────────

/**
 * Total recurring non-military income credited to a given month.
 *
 * Streams are stored per-occurrence (like fixed_expenses), so biweekly streams
 * are counted by occurrence within the month via investmentForMonth() rather
 * than treated as a flat monthly amount. A stream contributes nothing to months
 * before its start_date, after its end_date, or before the user's joined_at.
 *
 * Called from computeMonthlyFinancials() so every route that reports income
 * picks streams up automatically.
 */
export function getActiveIncomeStreamsTotal(db: Db, userId: string, month: string): number {
  const joinedAt = getJoinedAt(db, userId);
  if (joinedAt && isBeforeMonth(month, joinedAt)) return 0;

  const rows = db
    .prepare(
      `SELECT amount, frequency, start_date, end_date
       FROM income_streams WHERE user_id = ? AND active = 1`,
    )
    .all(userId) as {
    amount: number;
    frequency: string | null;
    start_date: string | null;
    end_date: string | null;
  }[];

  const live = rows.filter((r) => !r.start_date || !isBeforeMonth(month, r.start_date));
  return investmentForMonth(
    live.map((r) => ({
      amount: r.amount,
      period: 'monthly',
      recurrence: r.frequency,
      recurrence_anchor: r.start_date,
      end_date: r.end_date,
    })),
    month,
  );
}

/**
 * Total ad-hoc income logged for a given month via income_entries — manual
 * one-off entries and gig-income deposits (DoorDash, Uber, etc.) detected
 * during CSV import (see GIG_INCOME_PLATFORMS).
 *
 * Called from computeMonthlyFinancials() so every route that reports income
 * picks these up automatically, the same as income_streams.
 */
export function getIncomeEntriesTotal(db: Db, userId: string, month: string): number {
  const joinedAt = getJoinedAt(db, userId);
  if (joinedAt && isBeforeMonth(month, joinedAt)) return 0;

  return (
    db
      .prepare(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM income_entries WHERE user_id = ? AND month = ?',
      )
      .get(userId, month) as { total: number }
  ).total;
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

/**
 * Debts with a match_keywords pattern set — used by isDebtServicePayment()
 * to skip importing a CSV row as spending when it's really a payment
 * already tracked here.
 */
export function getDebtsForDetection(db: Db, userId: string): { match_keywords: string | null }[] {
  return db
    .prepare(
      "SELECT match_keywords FROM debts WHERE user_id = ? AND match_keywords IS NOT NULL AND match_keywords != ''",
    )
    .all(userId) as { match_keywords: string | null }[];
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

// ── IRA contributions ─────────────────────────────────────────────────────────

/**
 * Total IRA contributions attributed to a given tax year, drawn from transactions
 * linked to roth_ira or trad_ira financial accounts.
 *
 * Uses `COALESCE(tax_year, year-from-month)` so a January 2026 transaction
 * with `tax_year = 2025` is counted under 2025, not 2026.
 *
 * @param investmentCategory  The INVESTMENT_CATEGORY constant — passed in to avoid
 *                            a circular import between queries.ts and config.ts.
 */
export function getIraContributionsByTaxYear(
  db: Db,
  userId: string,
  year: number,
  investmentCategory: string,
): number {
  return (
    db
      .prepare(
        `SELECT COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         JOIN financial_accounts fa ON fa.id = t.account_id AND fa.user_id = t.user_id
         WHERE t.user_id = ?
           AND t.category = ?
           AND COALESCE(t.tax_year, CAST(substr(t.month, 1, 4) AS INTEGER)) = ?
           AND fa.type IN ('roth_ira', 'trad_ira')`,
      )
      .get(userId, investmentCategory, year) as { total: number }
  ).total;
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
