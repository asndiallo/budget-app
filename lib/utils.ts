// Pure utility functions — usable in both server (API routes) and client (components)
import { addMonths, format, isBefore, parseISO, subMonths } from 'date-fns';

// ── Month helpers ──────────────────────────────────────────────────────────────
// Months are always stored as "YYYY-MM" strings.

/** Returns today's month as "YYYY-MM". */
export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

/** Returns the month before the given "YYYY-MM" string. */
export function prevMonth(month: string): string {
  return format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
}

/** Returns the month after the given "YYYY-MM" string. */
export function nextMonth(month: string): string {
  return format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
}

/** Returns true if the given "YYYY-MM" is strictly after the current month. */
export function isFutureMonth(month: string): boolean {
  const now = parseISO(`${currentMonth()}-01`);
  const target = parseISO(`${month}-01`);
  return isBefore(now, target);
}

/**
 * Returns true if `month` ("YYYY-MM") is strictly before `boundary`.
 * `boundary` may be "YYYY-MM" or a full "YYYY-MM-DD" date.
 */
export function isBeforeMonth(month: string, boundary: string): boolean {
  const boundaryMonth = boundary.slice(0, 7); // normalise to YYYY-MM
  return isBefore(parseISO(`${month}-01`), parseISO(`${boundaryMonth}-01`));
}

/** Formats "YYYY-MM" as "Jan 2026". */
export function formatMonthLabel(month: string): string {
  return format(parseISO(`${month}-01`), 'MMM yyyy');
}

export function formatCurrency(n: number): string {
  return '$' + Math.abs(Math.round(n)).toLocaleString();
}

export function generateYearMonths(year = new Date().getFullYear()): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

const BIWEEKLY_MS = 14 * 86_400_000;

interface InvestmentExpense {
  amount: number;
  period: string;
  recurrence?: string | null;
  recurrence_anchor?: string | null;
  end_date?: string | null;
}

/**
 * Returns the total investment contribution from a set of active fixed expenses
 * for a specific YYYY-MM month, correctly counting biweekly recurrence occurrences
 * within that month rather than treating the per-occurrence amount as a monthly flat.
 */
export function investmentForMonth(expenses: InvestmentExpense[], month: string): number {
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1, 12, 0, 0).getTime();
  // Last millisecond of the month
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999).getTime();

  return expenses.reduce((sum, exp) => {
    if (!exp.amount) return sum;

    const endMs = exp.end_date ? new Date(exp.end_date + 'T23:59:59').getTime() : Infinity;

    // Expense ended before this month — skip
    if (endMs < monthStart) return sum;

    if (exp.recurrence === 'biweekly' && exp.recurrence_anchor) {
      const anchorMs = new Date(exp.recurrence_anchor + 'T12:00:00').getTime();
      const cutoff = Math.min(monthEnd, endMs);
      // Walk forward from anchor to find first occurrence >= monthStart
      const diff = monthStart - anchorMs;
      const skip = Math.ceil(diff / BIWEEKLY_MS);
      let cur = anchorMs + skip * BIWEEKLY_MS;
      let count = 0;
      while (cur <= cutoff) {
        count++;
        cur += BIWEEKLY_MS;
      }
      return sum + exp.amount * count;
    }

    if (exp.period === 'annual') return sum + exp.amount / 12;

    // Monthly (default)
    return sum + exp.amount;
  }, 0);
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
