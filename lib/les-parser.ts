/**
 * DFAS Leave & Earnings Statement (LES) text parser.
 *
 * Handles both the modern myPay two-column layout and the older single-column
 * format. Input is the raw text content of the LES (copy-pasted from PDF or
 * extracted from a PDF file).
 *
 * Output maps directly to the income_config and leave_tracker keys used
 * throughout the app.
 */

export interface LesParseResult {
  /** Detected pay period end month as "YYYY-MM", or null if not found */
  month: string | null;
  /** Full YYYY-MM-DD of the period-end date — used for the leave anchor */
  lesPeriodDate: string | null;
  /** End-of-period leave balance in days — null when not found in the LES */
  leaveBalance: number | null;
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
  { pattern: /\bbase\s*pay\b/i, key: 'base_pay', label: 'Base pay' },
  { pattern: /\bbas[\s-]rate\b/i, key: 'bas', label: 'BAS' },
  { pattern: /\bsubsistence\s+allow/i, key: 'bas', label: 'BAS' },
  { pattern: /\bbasic\s+allow\w*\s+sub/i, key: 'bas', label: 'BAS' },
  { pattern: /\bBAS\b(?!.*(?:deduct|with))/i, key: 'bas', label: 'BAS' },
  // BAH — many variants across branches and formats
  { pattern: /\bbah\s*w\/\s*dep\b/i, key: 'bah', label: 'BAH w/dep' },
  { pattern: /\bbah\s*w\/o\s*dep\b/i, key: 'bah', label: 'BAH w/o dep' },
  { pattern: /\bbah\s+type\b/i, key: 'bah', label: 'BAH' },
  { pattern: /\bbasic\s+allow\w*\s+hous/i, key: 'bah', label: 'BAH' },
  { pattern: /\boha\b/i, key: 'bah', label: 'OHA' },
  { pattern: /\bbah\b/i, key: 'bah', label: 'BAH' },
  // ── Deductions ──────────────────────────────────────────────────────────
  { pattern: /\bfed(?:eral)?\s+tax(?:es)?\b/i, key: 'taxes', label: 'Federal taxes' },
  { pattern: /\bfed(?:eral)?\s+with(?:hold)?/i, key: 'taxes', label: 'Federal taxes' },
  {
    pattern: /\bfica[\s-]soc(?:\s+sec(?:urity)?)?\b/i,
    key: 'fica_soc_security',
    label: 'FICA-Soc Security',
  },
  {
    pattern: /\bsoc(?:ial)?\s+sec(?:urity)?\b(?!.*fica)/i,
    key: 'fica_soc_security',
    label: 'FICA-Soc Security',
  },
  { pattern: /\bfica[\s-]medicare\b/i, key: 'fica_medicare', label: 'FICA-Medicare' },
  { pattern: /\bmedicare\b(?!.*part)/i, key: 'fica_medicare', label: 'FICA-Medicare' },
  // SGLI Family/Spouse coverage is a distinct deduction line from base SGLI —
  // must come first, or the generic \bsgli\b pattern below claims the 'sgli'
  // key on this line first and the real SGLI amount never gets matched.
  {
    pattern: /\bsgli\s+fam(?:ily)?\s*\/?\s*spouse\b/i,
    key: 'sgli_family',
    label: 'SGLI Family/Spouse',
  },
  { pattern: /\bsgli\b/i, key: 'sgli', label: 'SGLI' },
  { pattern: /\bafrh\b/i, key: 'afrh', label: 'AFRH' },
  { pattern: /\bmeal\s+deduct/i, key: 'meal_deduction', label: 'Meal deduction' },
  { pattern: /\bmeal\s+ded\b/i, key: 'meal_deduction', label: 'Meal deduction' },
  { pattern: /\bsubsistence\s+deduct/i, key: 'meal_deduction', label: 'Meal deduction' },
  // Indebtedness repayment — an amortizing payroll deduction toward an overpayment
  // or other debt owed to the government. Anchored to the start of the line (not
  // just \bdebt\b) since "debt" is common enough elsewhere that a bare word-boundary
  // match risks false positives on unrelated LES lines.
  { pattern: /^debt\b/i, key: 'debt_repayment', label: 'Debt repayment' },
  // ── Special & incentive pays ─────────────────────────────────────────────
  { pattern: /\baviation\s+career\s+incentive\b/i, key: 'flight_pay', label: 'Flight pay (ACIP)' },
  { pattern: /\bacip\b/i, key: 'flight_pay', label: 'Flight pay (ACIP)' },
  { pattern: /\bflight\s+(?:incentive\s+)?pay\b/i, key: 'flight_pay', label: 'Flight pay' },
  { pattern: /\bhazardous\s+duty\b/i, key: 'hazardous_duty_pay', label: 'Hazardous duty pay' },
  { pattern: /\bhdzp\b/i, key: 'hazardous_duty_pay', label: 'Hazardous duty pay' },
  { pattern: /\bjump\s+pay\b/i, key: 'jump_pay', label: 'Jump pay' },
  { pattern: /\bparachute\s+duty\b/i, key: 'jump_pay', label: 'Jump pay' },
  { pattern: /\bhostile\s+fire\b/i, key: 'hostile_fire_idp', label: 'Hostile fire / IDP' },
  { pattern: /\bimminent\s+danger\b/i, key: 'hostile_fire_idp', label: 'IDP' },
  { pattern: /\bidp\b/i, key: 'hostile_fire_idp', label: 'IDP' },
  { pattern: /\bsdap\b/i, key: 'sdap', label: 'SDAP' },
  { pattern: /\bspecial\s+duty\s+assignment\b/i, key: 'sdap', label: 'SDAP' },
  {
    pattern: /\bselective\s+reenlist(?:ment)?\b/i,
    key: 'sep',
    label: 'Reenlistment bonus (SRB)',
  },
  { pattern: /\bsrb\b/i, key: 'sep', label: 'Reenlistment bonus (SRB)' },
];

// TSP handled separately because we derive a rate, not a raw dollar amount
const TSP_TRADITIONAL_RE = /\btsp\b(?!\s*roth)(?!.*roth)/i;
const TSP_ROTH_RE = /\broth\s*tsp\b|\btsp\s*roth\b/i;

// ── Date extraction ──────────────────────────────────────────────────────────

const DATE_PATTERNS: RegExp[] = [
  /pay\s*date\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /period\s*(?:covered|end(?:ing)?)\s*[:\s]+\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /les\s+for\s+period\s+end(?:ing)?\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /end\s*date\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /pay\s*date\s*[:\s]+(\d{4}-\d{2}-\d{2})/i,
];

/** Parses a raw date string into both the YYYY-MM month and the full YYYY-MM-DD date. */
function parseDateString(raw: string): { month: string; date: string } | null {
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return { month: `${isoMatch[1]}-${isoMatch[2]}`, date: raw };

  const parts = raw.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    const year = y.length === 2 ? (parseInt(y) >= 50 ? '19' + y : '20' + y) : y;
    return {
      month: `${year}-${m.padStart(2, '0')}`,
      date: `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
    };
  }
  return null;
}

/** Extracts the period-end date, returning both YYYY-MM and YYYY-MM-DD. */
function extractDateInfo(text: string): { month: string; date: string } | null {
  for (const pattern of DATE_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const parsed = parseDateString(m[1]);
      if (parsed) return parsed;
    }
  }
  // Fallback: last MM/DD/YYYY date in text (pay dates are typically at the bottom)
  const allDates = [...text.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)];
  for (const d of allDates.reverse()) {
    const parsed = parseDateString(d[1]);
    if (parsed) return parsed;
  }
  return null;
}

// ── Leave balance extraction ─────────────────────────────────────────────────
// DFAS LES leave section appears in two formats:
//   Single-line: "EOM BAL 35.0" or "LEAVE BALANCE 42.5"
//   Table:       "BF BAL  ERND  USED  CR LDFTED  EOM BAL  USE/LOSE"
//                "32.5    2.5   0.0   0.0        35.0     19OCT26"

function extractLeaveBalance(text: string): number | null {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Single-line format: label immediately followed by the balance
    const sameLineMatch = line.match(
      /(?:eom\s+bal(?:ance)?|end[\s-]of[\s-]month\s+bal(?:ance)?|leave\s+bal(?:ance)?)\s*:?\s*([\d]+(?:\.\d+)?)\b/i,
    );
    if (sameLineMatch) {
      const val = parseFloat(sameLineMatch[1]);
      if (val >= 0 && val <= 365) return val;
    }

    // Columnar header row: "... EOM BAL ..." with no digit content, data on next line
    if (/\beom\s+bal\b/i.test(line) && !/\d/.test(line)) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const dataLine = lines[j].trim();
        if (!dataLine) continue;

        // Strip trailing USE/LOSE date (e.g. "19OCT26" or "19 OCT 26") to avoid
        // those digits being picked up as the balance
        const stripped = dataLine
          .replace(/\s+\d{1,2}\s+[A-Z]{3}\s+\d{2,4}\s*$/i, '')
          .replace(/\s+\d{1,2}[A-Z]{3}\d{2,4}\s*$/i, '')
          .trim();

        // EOM BAL is the last numeric column before USE/LOSE
        const nums = [...stripped.matchAll(/\b(\d+(?:\.\d+)?)\b/g)]
          .map((m) => parseFloat(m[1]))
          .filter((n) => n >= 0 && n <= 365);

        if (nums.length > 0) return nums[nums.length - 1];
        break;
      }
    }
  }

  return null;
}

// ── Amount extraction ────────────────────────────────────────────────────────

// [\d,]* (not +) — DFAS prints small amounts with no leading zero (e.g. "AFRH   .50"),
// and requiring a leading digit silently dropped every such line.
const AMOUNT_RE = /\$?([\d,]*\.\d{2})/g;

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

  const dateInfo = extractDateInfo(text);
  const month = dateInfo?.month ?? null;
  const lesPeriodDate = dateInfo?.date ?? null;
  const leaveBalance = extractLeaveBalance(text);

  let tspAmount = 0;
  let rothTspAmount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;

    // TSP patterns — checked before generic matchers to avoid false matches
    if (TSP_ROTH_RE.test(line)) {
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

  // tsp_rate is the combined TSP contribution rate — traditional and Roth TSP
  // both count (they're the same account, just different tax treatment), and
  // an LES may show either or both. Note: Roth TSP is NOT a Roth IRA — the
  // roth_ira income_config key tracks a separate outside IRA contribution
  // (against its own $7k/yr limit) and must not be populated from this line.
  const totalTsp = tspAmount + rothTspAmount;
  if (totalTsp > 0 && fields['base_pay'] > 0) {
    const rate = totalTsp / fields['base_pay'];
    fields['tsp_rate'] = Math.min(1, Math.round(rate * 1000) / 1000);
    labelMap['tsp_rate'] = `TSP (${Math.round(rate * 100)}% of base)`;
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
    'base_pay',
    'bas',
    'bah',
    'flight_pay',
    'hazardous_duty_pay',
    'jump_pay',
    'hostile_fire_idp',
    'sdap',
    'sep',
    'tsp_rate',
    'roth_ira',
    'taxes',
    'fica_soc_security',
    'fica_medicare',
    'sgli',
    'sgli_family',
    'afrh',
    'meal_deduction',
    'debt_repayment',
  ];
  const preview = FIELD_ORDER.filter((k) => k in fields).map((k) => ({
    key: k,
    label: labelMap[k] ?? k,
    value: fields[k],
  }));

  return { month, lesPeriodDate, leaveBalance, fields, preview, warnings };
}
