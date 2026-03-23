// Server-only helpers for income calculations — shared across API routes.

import { INCOME_FIELDS, TSP_CONFIG } from './config';

import { getDb } from './db';

type Db = ReturnType<typeof getDb>;

/** Nearest-prior snapshot: returns the income config as of the given month. */
export function incomeForMonth(db: Db, month: string): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT key, value FROM income_config i1
       WHERE month <= ?
         AND month = (
           SELECT MAX(month) FROM income_config i2
           WHERE i2.key = i1.key AND i2.month <= ?
         )`,
    )
    .all(month, month) as { key: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Returns total income and TSP for a given month. */
export function computeMonthlyFinancials(
  db: Db,
  month: string,
): { totalIncome: number; tsp: number } {
  const config = incomeForMonth(db, month);
  const tspRate = config.tsp_rate ?? TSP_CONFIG.rate;
  const totalIncome = INCOME_FIELDS.reduce(
    (s, f) => s + (config[f.key] ?? 0),
    0,
  );
  const tsp = Math.round((config.base_pay ?? 0) * tspRate);
  return { totalIncome, tsp };
}
