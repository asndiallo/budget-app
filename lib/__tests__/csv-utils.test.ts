import { describe, expect, it } from 'vitest';

import { CATEGORIES, CSV_CATEGORY_MAP, DEFAULT_CATEGORY } from '../config';
import { mapCategory, parseDate } from '../csv-utils';

// ── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  describe('MM/DD/YYYY format (Apple Card, Capital One, Chase)', () => {
    it('parses a standard date', () => {
      expect(parseDate('01/15/2026')).toEqual({
        month: '2026-01',
        date: '2026-01-15',
      });
    });

    it('zero-pads single-digit month and day', () => {
      expect(parseDate('3/5/2026')).toEqual({
        month: '2026-03',
        date: '2026-03-05',
      });
    });

    it('handles December', () => {
      expect(parseDate('12/31/2025')).toEqual({
        month: '2025-12',
        date: '2025-12-31',
      });
    });

    it('handles January', () => {
      expect(parseDate('01/01/2026')).toEqual({
        month: '2026-01',
        date: '2026-01-01',
      });
    });

    it('extracts month correctly across all months', () => {
      for (let m = 1; m <= 12; m++) {
        const padded = String(m).padStart(2, '0');
        const result = parseDate(`${padded}/15/2026`);
        expect(result?.month).toBe(`2026-${padded}`);
      }
    });
  });

  describe('YYYY-MM-DD format (ISO)', () => {
    it('parses ISO format', () => {
      expect(parseDate('2026-03-15')).toEqual({
        month: '2026-03',
        date: '2026-03-15',
      });
    });

    it('handles ISO with trailing content', () => {
      // The regex uses a non-anchored match, accepts extra chars after the date
      const result = parseDate('2026-03-15T00:00:00');
      expect(result?.month).toBe('2026-03');
      expect(result?.date).toBe('2026-03-15');
    });
  });

  describe('invalid / empty input', () => {
    it('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('returns null for unrecognised format', () => {
      expect(parseDate('March 15 2026')).toBeNull();
      expect(parseDate('15-03-2026')).toBeNull();
      expect(parseDate('2026/03/15')).toBeNull();
    });

    it('returns null for partial dates', () => {
      expect(parseDate('01/2026')).toBeNull();
      expect(parseDate('2026-03')).toBeNull();
    });
  });
});

// ── mapCategory ──────────────────────────────────────────────────────────────

describe('mapCategory', () => {
  describe('Food mappings', () => {
    it('maps "food and drink" → Food', () => {
      expect(mapCategory('Food and Drink')).toBe('Food');
    });

    it('maps "food & drink" → Food', () => {
      expect(mapCategory('Food & Drink')).toBe('Food');
    });

    it('maps "restaurants" → Food', () => {
      expect(mapCategory('Restaurants')).toBe('Food');
    });

    it('maps "groceries" → Food', () => {
      expect(mapCategory('Groceries')).toBe('Food');
    });

    it('maps "grocery" → Food', () => {
      expect(mapCategory('Grocery')).toBe('Food');
    });
  });

  describe('Transport mappings', () => {
    it('maps "transportation" → Transport', () => {
      expect(mapCategory('Transportation')).toBe('Transport');
    });

    it('maps "gas" → Transport', () => {
      expect(mapCategory('Gas')).toBe('Transport');
    });

    it('maps "tolls" → Transport', () => {
      expect(mapCategory('Tolls')).toBe('Transport');
    });

    it('maps "automotive" → Transport', () => {
      expect(mapCategory('Automotive')).toBe('Transport');
    });

    it('maps "travel" → Transport', () => {
      expect(mapCategory('Travel')).toBe('Transport');
    });
  });

  describe('Shopping mappings', () => {
    it('maps "shopping" → Shopping', () => {
      expect(mapCategory('Shopping')).toBe('Shopping');
    });

    it('maps "home" → Shopping', () => {
      expect(mapCategory('Home')).toBe('Shopping');
    });
  });

  describe('Entertainment mappings', () => {
    it('maps "entertainment" → Entertainment', () => {
      expect(mapCategory('Entertainment')).toBe('Entertainment');
    });
  });

  describe('Personal care mappings', () => {
    it('maps "health" → Personal care', () => {
      expect(mapCategory('Health')).toBe('Personal care');
    });

    it('maps "health & wellness" → Personal care', () => {
      expect(mapCategory('Health & Wellness')).toBe('Personal care');
    });
  });

  describe('Subscriptions mappings', () => {
    it('maps "subscriptions" → Subscriptions', () => {
      expect(mapCategory('Subscriptions')).toBe('Subscriptions');
    });

    it('maps "utilities" → Subscriptions', () => {
      expect(mapCategory('Utilities')).toBe('Subscriptions');
    });

    it('maps "bills & utilities" → Subscriptions', () => {
      expect(mapCategory('Bills & Utilities')).toBe('Subscriptions');
    });
  });

  describe('Family mappings', () => {
    it('maps "family" → Family', () => {
      expect(mapCategory('Family')).toBe('Family');
    });
  });

  describe('Other / fallback mappings', () => {
    it('maps "services" → Other', () => {
      expect(mapCategory('Services')).toBe('Other');
    });

    it('maps "fees & adjustments" → Other', () => {
      expect(mapCategory('Fees & Adjustments')).toBe('Other');
    });

    it('returns DEFAULT_CATEGORY for completely unknown input', () => {
      expect(mapCategory('Totally Unknown Category')).toBe(DEFAULT_CATEGORY);
      expect(mapCategory('')).toBe(DEFAULT_CATEGORY);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      expect(mapCategory('GROCERIES')).toBe('Food');
      expect(mapCategory('groceries')).toBe('Food');
      expect(mapCategory('Groceries')).toBe('Food');
    });
  });

  describe('substring matching', () => {
    it('matches when the key appears anywhere in the string', () => {
      // "groceries" inside a longer category label
      expect(mapCategory('supermarket groceries')).toBe('Food');
      expect(mapCategory('auto gas station')).toBe('Transport');
    });
  });

  describe('all CSV_CATEGORY_MAP values are valid app categories', () => {
    it('every mapped value is a member of CATEGORIES', () => {
      const validCategories = new Set<string>(CATEGORIES);
      for (const [key, value] of Object.entries(CSV_CATEGORY_MAP)) {
        expect(
          validCategories.has(value),
          `CSV_CATEGORY_MAP["${key}"] = "${value}" is not a valid category`,
        ).toBe(true);
      }
    });
  });
});
