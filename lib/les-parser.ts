/**
 * DFAS Leave & Earnings Statement (LES) text parser.
 *
 * Handles both the modern myPay two-column layout and the older single-column
 * format. Input is the raw text content of the LES (copy-pasted from PDF or
 * loaded from a .txt file).
 *
 * Output maps directly to the income_config keys used throughout the app.
 */

export interface LesParseResult {
  /** Detected pay period end month as "YYYY-MM", or null if not found */
  month: string | null;
  /** Parsed income / deduction fields ready to pass to api.income.update() */
  fields: Record<string, number>;
  /** Human-readable labels for each found field (for the preview UI) */
  preview: { label: string; key: string; value: number }[];
  /** Warnings for missing expected fields or ambiguous values */
  warnings: string[];
}

// ── Field matcher table ──────────────────────────────────────────────────────
// Each entry maps one or more regex patterns against LES label text to an
// income_config key. Order within each key matters: more-specific first.

interface FieldMatcher {
  pattern: RegExp;
  key: string;
  label: string;
}

const FIELD_MATCHERS: FieldMatcher[] = [
  // ── Entitlements ────────────────────────────────────────────────────────
  { pattern: /\bbase\s*pay\b/i,                      key: 'base_pay',          label: 'Base pay' },
  { pattern: /\bbas[\s-]rate\b/i,                    key: 'bas',               label: 'BAS' },
  { pattern: /\bsubsistence\s+allow/i,               key: 'bas',               label: 'BAS' },
  { pattern: /\bbasic\s+allow\w*\s+sub/i,            key: 'bas',               label: 'BAS' },
  { pattern: /\bBAS\b(?!.*(?:deduct|with))/i,        key: 'bas',               label: 'BAS' },
  // BAH — many variants across branches and formats
  { pattern: /\bbah\s*w\/\s*dep\b/i,                 key: 'bah',               label: 'BAH w/dep' },
  { pattern: /\bbah\s*w\/o\s*dep\b/i,                key: 'bah',               label: 'BAH w/o dep' },
  { pattern: /\bbah\s+type\b/i,                      key: 'bah',               label: 'BAH' },
  { pattern: /\bbasic\s+allow\w*\s+hous/i,           key: 'bah',               label: 'BAH' },
  { pattern: /\boha\b/i,                             key: 'bah',               label: 'OHA' },
  { pattern: /\bbah\b/i,                             key: 'bah',               label: 'BAH' },
  // ── Deductions ──────────────────────────────────────────────────────────
  { pattern: /\bfed(?:eral)?\s+tax(?:es)?\b/i,       key: 'taxes',             label: 'Federal taxes' },
  { pattern: /\bfed(?:eral)?\s+with(?:hold)?/i,      key: 'taxes',             label: 'Federal taxes' },
  { pattern: /\bfica[\s-]soc(?:\s+sec(?:urity)?)?\b/i, key: 'fica_soc_security', label: 'FICA-Soc Security' },
  { pattern: /\bsoc(?:ial)?\s+sec(?:urity)?\b(?!.*fica)/i, key: 'fica_soc_security', label: 'FICA-Soc Security' },
  { pattern: /\bfica[\s-]medicare\b/i,               key: 'fica_medicare',     label: 'FICA-Medicare' },
  { pattern: /\bmedicare\b(?!.*part)/i,              key: 'fica_medicare',     label: 'FICA-Medicare' },
  { pattern: /\bsgli\b/i,                            key: 'sgli',              label: 'SGLI' },
  { pattern: /\bafrh\b/i,                            key: 'afrh',              label: 'AFRH' },
  { pattern: /\bmeal\s+deduct/i,                     key: 'meal_deduction',    label: 'Meal deduction' },
  { pattern: /\bmeal\s+ded\b/i,                      key: 'meal_deduction',    label: 'Meal deduction' },
  { pattern: /\bsubsistence\s+deduct/i,              key: 'meal_deduction',    label: 'Meal deduction' },
];

// TSP handled separately because we derive a rate, not a raw dollar amount
const TSP_TRADITIONAL_RE = /\btsp\b(?!\s*roth)(?!.*roth)/i;
const TSP_ROTH_RE = /\broth\s*tsp\b|\btsp\s*roth\b/i;

// ── Date extraction ──────────────────────────────────────────────────────────
// Try several patterns for pay date / period-end date.  We only need YYYY-MM.

const DATE_PATTERNS: RegExp[] = [
  /pay\s*date\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /period\s*(?:covered|end(?:ing)?)\s*[:\s]+\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /les\s+for\s+period\s+end(?:ing)?\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /end\s*date\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  // ISO date in pay-date context
  /pay\s*date\s*[:\s]+(\d{4}-\d{2}-\d{2})/i,
  // Fallback: last occurrence of a full MM/DD/YYYY date (pay dates are usually at end)
  /(\d{2}\/\d{2}\/\d{4})/g,
];

function parseDateToMonth(raw: string): string | null {
  // Handle MM/DD/YYYY, MM/DD/YY, and YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const parts = raw.split('/');
  if (parts.length === 3) {
    const [m, , y] = parts;
    const year = y.length === 2 ? (parseInt(y) >= 50 ? '19' + y : '20' + y) : y;
    return `${year}-${m.padStart(2, '0')}`;
  }
  return null;
}

function extractMonth(text: string): string | null {
  for (let i = 0; i < DATE_PATTERNS.length - 1; i++) {
    const m = text.match(DATE_PATTERNS[i]);
    if (m?.[1]) {
      const parsed = parseDateToMonth(m[1]);
      if (parsed) return parsed;
    }
  }
  // Fallback: collect all full dates, take the last one (pay dates are at bottom)
  const allDates = [...text.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)];
  for (const d of allDates.reverse()) {
    const parsed = parseDateToMonth(d[1]);
    if (parsed) return parsed;
  }
  return null;
}

// ── Amount extraction ────────────────────────────────────────────────────────

const AMOUNT_RE = /\$?([\d,]+\.\d{2})/g;

function extractAmounts(line: string): number[] {
  const amounts: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_RE.source, 'g');
  while ((m = re.exec(line)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) amounts.push(val);
  }
  return amounts;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseLes(text: string): LesParseResult {
  const fields: Record<string, number> = {};
  const labelMap: Record<string, string> = {};
  const warnings: string[] = [];

  const month = extractMonth(text);

  let tspAmount = 0;
  let rothTspAmount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    // TSP patterns — checked before generic matchers to avoid false matches
    if (TSP_ROTH_RE.test(line)) {
      // Use rightmost amount (some lines show YTD total on left, current on right)
      rothTspAmount = amounts[amounts.length - 1];
      continue;
    }
    if (TSP_TRADITIONAL_RE.test(line)) {
      tspAmount = amounts[amounts.length - 1];
      continue;
    }

    // Generic field matchers — first match wins per key
    for (const { pattern, key, label } of FIELD_MATCHERS) {
      if (pattern.test(line) && !(key in fields)) {
        fields[key] = amounts[amounts.length - 1];
        labelMap[key] = label;
        break;
      }
    }
  }

  // ── Derived fields ────────────────────────────────────────────────────────

  // TSP rate: computed from TSP dollar amount / base pay
  if (tspAmount > 0 && fields['base_pay'] > 0) {
    const rate = tspAmount / fields['base_pay'];
    // Round to 3 decimal places, clamp to [0, 1]
    fields['tsp_rate'] = Math.min(1, Math.round(rate * 1000) / 1000);
    labelMap['tsp_rate'] = `TSP (${Math.round(rate * 100)}% of base)`;
  }
  // Roth TSP stored as roth_ira
  if (rothTspAmount > 0) {
    fields['roth_ira'] = rothTspAmount;
    labelMap['roth_ira'] = 'Roth TSP';
  }

  // ── Warnings ─────────────────────────────────────────────────────────────

  if (!month) {
    warnings.push('Pay period date not found — confirm the month before importing');
  }
  const criticalFields = ['base_pay', 'bas', 'taxes', 'fica_soc_security', 'fica_medicare'];
  for (const key of criticalFields) {
    if (!(key in fields)) {
      const label = FIELD_MATCHERS.find((m) => m.key === key)?.label ?? key;
      warnings.push(`"${label}" not found — verify manually`);
    }
  }
  if (Object.keys(fields).length === 0) {
    warnings.push('No recognizable LES fields found — check that the text is a valid DFAS LES');
  }

  // ── Build preview list ────────────────────────────────────────────────────

  const FIELD_ORDER = [
    'base_pay', 'bas', 'bah', 'tsp_rate', 'roth_ira',
    'taxes', 'fica_soc_security', 'fica_medicare', 'sgli', 'afrh', 'meal_deduction',
  ];
  const preview = FIELD_ORDER
    .filter((k) => k in fields)
    .map((k) => ({ key: k, label: labelMap[k] ?? k, value: fields[k] }));

  return { month, fields, preview, warnings };
}
