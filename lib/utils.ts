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
  return Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
  );
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
