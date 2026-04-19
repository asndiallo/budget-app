// Server-only helpers for income calculations — shared across API routes.

import { INCOME_FIELDS, SPECIAL_PAY_FIELDS, TSP_CONFIG } from './config';
import { type getDb } from './db';

type Db = ReturnType<typeof getDb>;

/** Nearest-prior snapshot: returns the income config as of the given month for a user. */
export function incomeForMonth(db: Db, month: string, userId: string): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT key, value FROM income_config i1
       WHERE user_id = ? AND month <= ?
         AND month = (
           SELECT MAX(month) FROM income_config i2
           WHERE i2.user_id = i1.user_id AND i2.key = i1.key AND i2.month <= ?
         )`,
    )
    .all(userId, month, month) as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Returns total income and TSP for a given month. */
export function computeMonthlyFinancials(
  db: Db,
  month: string,
  userId: string,
): { totalIncome: number; tsp: number } {
  const config = incomeForMonth(db, month, userId);
  const tspRate = config.tsp_rate ?? TSP_CONFIG.rate;
  const totalIncome = [...INCOME_FIELDS, ...SPECIAL_PAY_FIELDS].reduce(
    (s, f) => s + (config[f.key] ?? 0),
    0,
  );
  const tsp = Math.round((config.base_pay ?? 0) * tspRate);
  return { totalIncome, tsp };
}

/**
 * Builds a year-scoped carry-forward lookup for income_config rows.
 *
 * Returns a `fieldsFor(month)` function that resolves the nearest prior
 * config snapshot within the given year — cross-year carry-forward is
 * intentionally excluded (a missing Jan → treat as $0, not "use last Dec").
 *
 * Used by contribution-limits and tax-year-summary routes.
 */
export function buildYearlyConfigLookup(
  db: Db,
  userId: string,
  year: number,
): (month: string) => Record<string, number> {
  const configRows = db
    .prepare(
      `SELECT month, key, value
       FROM income_config
       WHERE user_id = ? AND month LIKE ?
       ORDER BY month`,
    )
    .all(userId, `${year}-%`) as { month: string; key: string; value: number }[];

  const configByMonth: Record<string, Record<string, number>> = {};
  for (const { month, key, value } of configRows) {
    (configByMonth[month] ??= {})[key] = value;
  }
  const configMonths = Object.keys(configByMonth).sort();

  return function fieldsFor(targetMonth: string): Record<string, number> {
    const applicable = configMonths.filter((m) => m <= targetMonth);
    if (applicable.length === 0) return {};
    return configByMonth[applicable[applicable.length - 1]];
  };
}
