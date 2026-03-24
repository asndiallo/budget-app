import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CAT_COLORS,
  CHART_CAT_COLORS,
  CSV_CATEGORY_MAP,
  DEFAULT_CATEGORY,
  DEFAULT_GOAL_COLOR,
  DEDUCTION_FIELDS,
  GOAL_BAR_COLORS,
  GOAL_COLORS,
  GOAL_DOT_COLORS,
  INCOME_FIELDS,
} from '../config';

// ── CATEGORIES ────────────────────────────────────────────────────────────────

describe('CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it('contains no duplicate entries', () => {
    const unique = new Set(CATEGORIES);
    expect(unique.size).toBe(CATEGORIES.length);
  });

  it('includes DEFAULT_CATEGORY', () => {
    expect(CATEGORIES).toContain(DEFAULT_CATEGORY);
  });
});

// ── CSV_CATEGORY_MAP ──────────────────────────────────────────────────────────

describe('CSV_CATEGORY_MAP', () => {
  it('every value is a valid CATEGORIES member', () => {
    const valid = new Set<string>(CATEGORIES);
    for (const [key, value] of Object.entries(CSV_CATEGORY_MAP)) {
      expect(
        valid.has(value),
        `CSV_CATEGORY_MAP["${key}"] = "${value}" is not a valid category`,
      ).toBe(true);
    }
  });

  it('all keys are lowercase (used for case-insensitive substring matching)', () => {
    for (const key of Object.keys(CSV_CATEGORY_MAP)) {
      expect(key, `key "${key}" should be lowercase`).toBe(key.toLowerCase());
    }
  });

  it('has no empty keys or values', () => {
    for (const [key, value] of Object.entries(CSV_CATEGORY_MAP)) {
      expect(key.trim()).not.toBe('');
      expect(value.trim()).not.toBe('');
    }
  });
});

// ── INCOME_FIELDS ─────────────────────────────────────────────────────────────

describe('INCOME_FIELDS', () => {
  it('includes base_pay, bas, bah, other', () => {
    const keys = INCOME_FIELDS.map((f) => f.key);
    expect(keys).toContain('base_pay');
    expect(keys).toContain('bas');
    expect(keys).toContain('bah');
    expect(keys).toContain('other');
  });

  it('has no duplicate keys', () => {
    const keys = INCOME_FIELDS.map((f) => f.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('every field has a non-empty key and label', () => {
    for (const field of INCOME_FIELDS) {
      expect(field.key.trim()).not.toBe('');
      expect(field.label.trim()).not.toBe('');
    }
  });
});

// ── DEDUCTION_FIELDS ──────────────────────────────────────────────────────────

describe('DEDUCTION_FIELDS', () => {
  it('has no duplicate keys', () => {
    const keys = DEDUCTION_FIELDS.map((f) => f.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('every field has a non-empty key and label', () => {
    for (const field of DEDUCTION_FIELDS) {
      expect(field.key.trim()).not.toBe('');
      expect(field.label.trim()).not.toBe('');
    }
  });

  it('INCOME_FIELDS and DEDUCTION_FIELDS have no overlapping keys', () => {
    const incomeKeys = new Set(INCOME_FIELDS.map((f) => f.key));
    for (const field of DEDUCTION_FIELDS) {
      expect(
        incomeKeys.has(field.key),
        `"${field.key}" appears in both INCOME_FIELDS and DEDUCTION_FIELDS`,
      ).toBe(false);
    }
  });
});

// ── GOAL_COLORS ───────────────────────────────────────────────────────────────

describe('GOAL_COLORS', () => {
  it('DEFAULT_GOAL_COLOR is a member of GOAL_COLORS', () => {
    expect(GOAL_COLORS).toContain(DEFAULT_GOAL_COLOR);
  });

  it('has no duplicates', () => {
    const unique = new Set(GOAL_COLORS);
    expect(unique.size).toBe(GOAL_COLORS.length);
  });

  it('GOAL_BAR_COLORS has an entry for every GOAL_COLOR', () => {
    for (const color of GOAL_COLORS) {
      expect(
        GOAL_BAR_COLORS[color],
        `GOAL_BAR_COLORS missing entry for "${color}"`,
      ).toBeDefined();
    }
  });

  it('GOAL_DOT_COLORS has an entry for every GOAL_COLOR', () => {
    for (const color of GOAL_COLORS) {
      expect(
        GOAL_DOT_COLORS[color],
        `GOAL_DOT_COLORS missing entry for "${color}"`,
      ).toBeDefined();
    }
  });
});

// ── CAT_COLORS / CHART_CAT_COLORS ─────────────────────────────────────────────

describe('category color maps', () => {
  it('CAT_COLORS has an entry for every category', () => {
    for (const cat of CATEGORIES) {
      expect(CAT_COLORS[cat], `CAT_COLORS missing entry for "${cat}"`).toBeDefined();
    }
  });

  it('CHART_CAT_COLORS has an entry for every category', () => {
    for (const cat of CATEGORIES) {
      expect(
        CHART_CAT_COLORS[cat],
        `CHART_CAT_COLORS missing entry for "${cat}"`,
      ).toBeDefined();
    }
  });

  it('CHART_CAT_COLORS values are valid hex colors', () => {
    for (const [cat, color] of Object.entries(CHART_CAT_COLORS)) {
      expect(color, `CHART_CAT_COLORS["${cat}"] is not a valid hex color`).toMatch(
        /^#[0-9a-f]{3}([0-9a-f]{3})?$/i,
      );
    }
  });
});
