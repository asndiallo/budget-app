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

// ── Military net pay ─────────────────────────────────────────────────────────

/**
 * Gross-to-net military pay for a single month, matching DFAS's own LES math:
 *   net = (INCOME_FIELDS + SPECIAL_PAY_FIELDS) − DEDUCTION_FIELDS − TSP
 *
 * This is deliberately separate from computeSavingsRate's `income` — it
 * excludes non-military income (rental, gig, etc.), which doesn't arrive on
 * the DFAS 1st/15th pay schedule this figure represents. Used to estimate
 * the actual per-paycheck deposit (halve the result) on the cash-flow
 * calendar.
 */
export function computeMilitaryNetPay(
  config: Record<string, number>,
  incomeFields: readonly { key: string }[],
  specialPayFields: readonly { key: string }[],
  deductionFields: readonly { key: string }[],
  tspDefaultRate: number,
): number {
  const gross = [...incomeFields, ...specialPayFields].reduce(
    (s, f) => s + (config[f.key] ?? 0),
    0,
  );
  const deductions = deductionFields.reduce((s, f) => s + (config[f.key] ?? 0), 0);
  const tspRate = config.tsp_rate ?? tspDefaultRate;
  const tsp = Math.round((config.base_pay ?? 0) * tspRate);
  return gross - deductions - tsp;
}

/**
 * Take-home pay: what actually lands in the bank. Military net pay
 * (computeMilitaryNetPay) minus allotments (a gross-pay deduction outside
 * IncomeConfig) plus income that arrives without payroll withholding
 * (recurring streams, one-off entries). Matches the dashboard's headline figure.
 */
export function computeTakeHomePay(
  militaryNetPay: number,
  allotments: number,
  streamsTotal: number,
  extraIncome: number,
): number {
  return militaryNetPay - allotments + streamsTotal + extraIncome;
}
