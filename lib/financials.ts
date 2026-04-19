/**
 * lib/financials.ts — canonical financial computation helpers.
 *
 * Single source of truth for the savings rate formula used across
 * overview, ytd, health-score, analytics, and streak routes.
 */

// ── Savings rate ───────────────────────────────────────────────────────────────

/**
 * Canonical savings rate formula:
 *   rate = (invested + max(0, net)) / income
 * where net = income − invested − spending
 *
 * Interpretation:
 * - `invested`  money intentionally set aside (TSP + investment expenses + investment transactions)
 * - `spending`  living-expense transactions (Investment category excluded)
 * - The formula rewards both investment contributions and positive end-of-month surplus.
 * - Returns 0 when income is zero to avoid division-by-zero.
 */
export function computeSavingsRate(income: number, invested: number, spending: number): number {
  if (income <= 0) return 0;
  const net = income - invested - spending;
  return (invested + Math.max(0, net)) / income;
}

/** Same as `computeSavingsRate` but returns a rounded integer percentage (0–100+). */
export function computeSavingsRatePct(income: number, invested: number, spending: number): number {
  return Math.round(computeSavingsRate(income, invested, spending) * 100);
}
