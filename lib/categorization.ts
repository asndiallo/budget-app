/**
 * lib/categorization.ts — shared transaction categorization and account detection.
 *
 * Extracted from api/transactions and api/csv-import to eliminate duplication
 * and ensure consistent behaviour across all ingestion paths (manual entry,
 * CSV import, backfill).
 */

import { DEFAULT_CATEGORY, INVESTMENT_CATEGORY, INVESTMENT_KEYWORDS } from './config';
import { mapCategory } from './csv-utils';

// ── Categorization ─────────────────────────────────────────────────────────────

/**
 * Resolves the final category for a transaction.
 *
 * Priority (highest → lowest):
 * 1. User-defined keyword rules — first matching rule wins (CSV import path)
 * 2. Explicit non-default category override — honours the caller's intent (manual entry path)
 * 3. Investment keyword detection — description matches a known investment term
 * 4. CSV-mapped category — bank-provided category string passed through `mapCategory`
 * 5. DEFAULT_CATEGORY fallback
 *
 * For **manual entry**: pass `explicitCategory` only (no rules, no csvCategory).
 * For **CSV import**: pass `csvCategory` and `rules` (explicitCategory is omitted).
 */
export function categorizeTransaction(
  description: string,
  {
    explicitCategory,
    csvCategory,
    rules = [],
  }: {
    explicitCategory?: string;
    csvCategory?: string;
    rules?: { keyword: string; category: string }[];
  } = {},
): string {
  const lower = description.toLowerCase();

  // 1. User rules (highest priority — allows overriding both bank category and keywords)
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) return rule.category;
  }

  // 2. Explicit non-default override
  if (explicitCategory && explicitCategory !== DEFAULT_CATEGORY) return explicitCategory;

  // 3. Investment keyword detection
  if (INVESTMENT_KEYWORDS.some((kw) => lower.includes(kw))) return INVESTMENT_CATEGORY;

  // 4. CSV category mapping
  if (csvCategory) return mapCategory(csvCategory);

  // 5. Fallback
  return explicitCategory ?? DEFAULT_CATEGORY;
}

// ── Account detection ──────────────────────────────────────────────────────────

/**
 * Detects which financial account a transaction belongs to by matching the
 * transaction description against each account's institution keyword
 * (case-insensitive substring match).
 *
 * Returns the account ID only when exactly one account matches to avoid
 * ambiguous auto-assignment.
 */
export function detectAccountId(
  description: string,
  accounts: { id: number; institution: string }[],
): number | null {
  const lower = description.toLowerCase();
  const matches = accounts.filter(
    (a) => a.institution && lower.includes(a.institution.toLowerCase()),
  );
  return matches.length === 1 ? matches[0].id : null;
}

// ── Debt-service detection ───────────────────────────────────────────────────────

/**
 * True when a CSV row is a debt-service payment (mortgage, car loan, etc.)
 * already tracked via a debts row's balance/monthly_payment — matching
 * against each debt's match_keywords (comma-separated, case-insensitive
 * substring match, same pattern as detectAccountId's institution matching).
 *
 * Used to skip inserting the row as a spending transaction during CSV
 * import: counting it there too would double-count the same cash flow
 * against both `transactions` and `debts`, inflating "spending" and
 * understating net/savings rate.
 */
export function isDebtServicePayment(
  description: string,
  debts: { match_keywords: string | null }[],
): boolean {
  const lower = description.toLowerCase();
  return debts.some((d) =>
    (d.match_keywords ?? '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .some((kw) => lower.includes(kw)),
  );
}
