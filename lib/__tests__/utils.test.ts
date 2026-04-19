import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  currentMonth,
  formatCurrency,
  formatMonthLabel,
  generateYearMonths,
  isBeforeMonth,
  isFutureMonth,
  nextMonth,
  parseCSVLine,
  prevMonth,
} from '../utils';

// ── prevMonth ────────────────────────────────────────────────────────────────

describe('prevMonth', () => {
  it('goes back within the same year', () => {
    expect(prevMonth('2026-06')).toBe('2026-05');
    expect(prevMonth('2026-03')).toBe('2026-02');
  });

  it('wraps December → November across the year boundary', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
  });

  it('handles end-of-year correctly', () => {
    expect(prevMonth('2025-12')).toBe('2025-11');
  });

  it('handles February → January', () => {
    expect(prevMonth('2026-02')).toBe('2026-01');
  });

  it('handles leap-year month correctly', () => {
    expect(prevMonth('2024-03')).toBe('2024-02');
  });

  it('returns a valid YYYY-MM string', () => {
    expect(prevMonth('2026-03')).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ── nextMonth ────────────────────────────────────────────────────────────────

describe('nextMonth', () => {
  it('advances within the same year', () => {
    expect(nextMonth('2026-03')).toBe('2026-04');
    expect(nextMonth('2026-11')).toBe('2026-12');
  });

  it('wraps December → January of next year', () => {
    expect(nextMonth('2025-12')).toBe('2026-01');
    expect(nextMonth('2026-12')).toBe('2027-01');
  });

  it('handles January → February', () => {
    expect(nextMonth('2026-01')).toBe('2026-02');
  });

  it('returns a valid YYYY-MM string', () => {
    expect(nextMonth('2026-03')).toMatch(/^\d{4}-\d{2}$/);
  });

  it('is the inverse of prevMonth', () => {
    const months = ['2026-01', '2026-06', '2025-12', '2024-02'];
    for (const m of months) {
      expect(prevMonth(nextMonth(m))).toBe(m);
      expect(nextMonth(prevMonth(m))).toBe(m);
    }
  });
});

// ── currentMonth ─────────────────────────────────────────────────────────────

describe('currentMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM format', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    expect(currentMonth()).toBe('2026-03');
  });

  it('reflects the mocked date', () => {
    // Use noon to avoid UTC midnight crossing a day boundary in local timezones
    vi.setSystemTime(new Date('2025-01-15T12:00:00'));
    expect(currentMonth()).toBe('2025-01');
  });

  it('returns a string matching YYYY-MM pattern', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ── isFutureMonth ────────────────────────────────────────────────────────────

describe('isFutureMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a month after current', () => {
    expect(isFutureMonth('2026-04')).toBe(true);
    expect(isFutureMonth('2026-12')).toBe(true);
    expect(isFutureMonth('2027-01')).toBe(true);
  });

  it('returns false for current month', () => {
    expect(isFutureMonth('2026-03')).toBe(false);
  });

  it('returns false for past months', () => {
    expect(isFutureMonth('2026-02')).toBe(false);
    expect(isFutureMonth('2025-01')).toBe(false);
  });
});

// ── isBeforeMonth ────────────────────────────────────────────────────────────

describe('isBeforeMonth', () => {
  it('returns true when month is strictly before boundary', () => {
    expect(isBeforeMonth('2026-01', '2026-03')).toBe(true);
    expect(isBeforeMonth('2025-12', '2026-01')).toBe(true);
    expect(isBeforeMonth('2024-06', '2026-03')).toBe(true);
  });

  it('returns false when month equals boundary', () => {
    expect(isBeforeMonth('2026-03', '2026-03')).toBe(false);
  });

  it('returns false when month is after boundary', () => {
    expect(isBeforeMonth('2026-04', '2026-03')).toBe(false);
    expect(isBeforeMonth('2027-01', '2026-12')).toBe(false);
  });

  it('accepts full YYYY-MM-DD boundary string', () => {
    expect(isBeforeMonth('2026-01', '2026-03-01')).toBe(true);
    expect(isBeforeMonth('2026-03', '2026-03-15')).toBe(false);
  });

  it('handles year boundary', () => {
    expect(isBeforeMonth('2025-12', '2026-01')).toBe(true);
    expect(isBeforeMonth('2026-01', '2025-12')).toBe(false);
  });
});

// ── formatMonthLabel ─────────────────────────────────────────────────────────

describe('formatMonthLabel', () => {
  it('formats months correctly', () => {
    expect(formatMonthLabel('2026-01')).toBe('Jan 2026');
    expect(formatMonthLabel('2026-03')).toBe('Mar 2026');
    expect(formatMonthLabel('2026-06')).toBe('Jun 2026');
    expect(formatMonthLabel('2026-12')).toBe('Dec 2026');
  });

  it('formats all 12 months of 2026', () => {
    const expected = [
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
      'Apr 2026',
      'May 2026',
      'Jun 2026',
      'Jul 2026',
      'Aug 2026',
      'Sep 2026',
      'Oct 2026',
      'Nov 2026',
      'Dec 2026',
    ];
    for (let i = 1; i <= 12; i++) {
      const m = `2026-${String(i).padStart(2, '0')}`;
      expect(formatMonthLabel(m)).toBe(expected[i - 1]);
    }
  });

  it('handles year transitions', () => {
    expect(formatMonthLabel('2025-12')).toBe('Dec 2025');
    expect(formatMonthLabel('2026-01')).toBe('Jan 2026');
  });
});

// ── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole numbers', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(2500)).toBe('$2,500');
  });

  it('rounds to nearest dollar', () => {
    expect(formatCurrency(2836.8)).toBe('$2,837');
    expect(formatCurrency(1234.4)).toBe('$1,234');
    expect(formatCurrency(1234.5)).toBe('$1,235');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('uses absolute value for negative numbers', () => {
    expect(formatCurrency(-500)).toBe('$500');
    expect(formatCurrency(-1234.56)).toBe('$1,235');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(100000)).toBe('$100,000');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });
});

// ── generateYearMonths ───────────────────────────────────────────────────────

describe('generateYearMonths', () => {
  it('returns exactly 12 months', () => {
    expect(generateYearMonths(2026)).toHaveLength(12);
  });

  it('starts in January and ends in December', () => {
    const months = generateYearMonths(2026);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });

  it('all months match YYYY-MM format', () => {
    for (const m of generateYearMonths(2026)) {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('months are sequential with no gaps', () => {
    const months = generateYearMonths(2026);
    for (let i = 1; i < months.length; i++) {
      expect(nextMonth(months[i - 1])).toBe(months[i]);
    }
  });

  it('works for different years', () => {
    expect(generateYearMonths(2025)[0]).toBe('2025-01');
    expect(generateYearMonths(2030)[11]).toBe('2030-12');
  });

  it('uses current year when no argument provided', () => {
    const year = new Date().getFullYear();
    const months = generateYearMonths();
    expect(months[0]).toBe(`${year}-01`);
  });
});

// ── parseCSVLine ─────────────────────────────────────────────────────────────

describe('parseCSVLine', () => {
  describe('simple (unquoted) fields', () => {
    it('parses comma-separated values', () => {
      expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('trims whitespace around fields', () => {
      expect(parseCSVLine('a, b , c')).toEqual(['a', 'b', 'c']);
    });

    it('parses a single field', () => {
      expect(parseCSVLine('hello')).toEqual(['hello']);
    });

    it('handles empty fields', () => {
      expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
    });

    it('handles trailing comma', () => {
      expect(parseCSVLine('a,b,')).toEqual(['a', 'b', '']);
    });
  });

  describe('quoted fields', () => {
    it('strips surrounding double-quotes', () => {
      expect(parseCSVLine('"hello","world"')).toEqual(['hello', 'world']);
    });

    it('preserves commas inside quoted fields', () => {
      expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    });

    it('handles a mix of quoted and unquoted fields', () => {
      expect(parseCSVLine('2026-01-15,"Amazon, Inc.",29.99,Shopping')).toEqual([
        '2026-01-15',
        'Amazon, Inc.',
        '29.99',
        'Shopping',
      ]);
    });

    it('handles multiple commas inside quotes', () => {
      expect(parseCSVLine('"a,b,c",d')).toEqual(['a,b,c', 'd']);
    });
  });

  describe('real-world CSV rows', () => {
    it('parses a typical Apple Card transaction', () => {
      const line = '01/15/2026,"NETFLIX.COM",15.49,Entertainment';
      const result = parseCSVLine(line);
      expect(result[0]).toBe('01/15/2026');
      expect(result[1]).toBe('NETFLIX.COM');
      expect(result[2]).toBe('15.49');
      expect(result[3]).toBe('Entertainment');
    });

    it('parses a transaction with a merchant containing a comma', () => {
      const line = '01/20/2026,"Target, Inc.",84.32,Shopping,manual';
      const result = parseCSVLine(line);
      expect(result).toHaveLength(5);
      expect(result[1]).toBe('Target, Inc.');
      expect(result[2]).toBe('84.32');
    });

    it('handles dollar amounts with currency symbol', () => {
      const line = 'desc,$1,234.56,category';
      const result = parseCSVLine(line);
      expect(result[1]).toBe('$1');
      expect(result[2]).toBe('234.56');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(parseCSVLine('')).toEqual(['']);
    });

    it('returns correct field count for known row length', () => {
      // Apple Card header: Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)
      const header =
        'Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)';
      expect(parseCSVLine(header)).toHaveLength(7);
    });
  });
});
