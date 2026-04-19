import { describe, expect, it } from 'vitest';

import {
  CAT_COLORS,
  CATEGORIES,
  CHART_CAT_COLORS,
  CONTRIBUTION_LIMITS,
  CSV_CATEGORY_MAP,
  DEDUCTION_FIELDS,
  DEFAULT_CATEGORY,
  DEFAULT_GOAL_COLOR,
  GOAL_BAR_COLORS,
  GOAL_COLORS,
  GOAL_DOT_COLORS,
  INCOME_FIELDS,
  INCOME_PROFILE_FIELD_OPTIONS,
  INCOME_PROFILE_TYPES,
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
      expect(GOAL_BAR_COLORS[color], `GOAL_BAR_COLORS missing entry for "${color}"`).toBeDefined();
    }
  });

  it('GOAL_DOT_COLORS has an entry for every GOAL_COLOR', () => {
    for (const color of GOAL_COLORS) {
      expect(GOAL_DOT_COLORS[color], `GOAL_DOT_COLORS missing entry for "${color}"`).toBeDefined();
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
      expect(CHART_CAT_COLORS[cat], `CHART_CAT_COLORS missing entry for "${cat}"`).toBeDefined();
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

// ── CONTRIBUTION_LIMITS ───────────────────────────────────────────────────────

describe('CONTRIBUTION_LIMITS', () => {
  it('has entries for 2024, 2025, and 2026', () => {
    expect(CONTRIBUTION_LIMITS[2024]).toBeDefined();
    expect(CONTRIBUTION_LIMITS[2025]).toBeDefined();
    expect(CONTRIBUTION_LIMITS[2026]).toBeDefined();
  });

  it('tspCatchup is greater than tsp for every year', () => {
    for (const [year, limits] of Object.entries(CONTRIBUTION_LIMITS)) {
      expect(limits.tspCatchup, `${year}: tspCatchup should be > tsp`).toBeGreaterThan(limits.tsp);
    }
  });

  it('iraCatchup is greater than ira for every year', () => {
    for (const [year, limits] of Object.entries(CONTRIBUTION_LIMITS)) {
      expect(limits.iraCatchup, `${year}: iraCatchup should be > ira`).toBeGreaterThan(limits.ira);
    }
  });

  it('2024 values are correct (IRS announced)', () => {
    expect(CONTRIBUTION_LIMITS[2024].tsp).toBe(23_000);
    expect(CONTRIBUTION_LIMITS[2024].tspCatchup).toBe(30_500);
    expect(CONTRIBUTION_LIMITS[2024].ira).toBe(7_000);
    expect(CONTRIBUTION_LIMITS[2024].iraCatchup).toBe(8_000);
  });

  it('2025 values are correct (IRS announced)', () => {
    expect(CONTRIBUTION_LIMITS[2025].tsp).toBe(23_500);
    expect(CONTRIBUTION_LIMITS[2025].tspCatchup).toBe(31_000);
    expect(CONTRIBUTION_LIMITS[2025].ira).toBe(7_000);
    expect(CONTRIBUTION_LIMITS[2025].iraCatchup).toBe(8_000);
  });

  it('2026 values are correct (IRS announced, SECURE 2.0 super catch-up)', () => {
    expect(CONTRIBUTION_LIMITS[2026].tsp).toBe(24_500);
    // SECURE 2.0 age 60-63 super catch-up: $32,500 total ($24,500 base + $8,000 extra)
    expect(CONTRIBUTION_LIMITS[2026].tspCatchup).toBe(32_500);
    expect(CONTRIBUTION_LIMITS[2026].ira).toBe(7_500);
    expect(CONTRIBUTION_LIMITS[2026].iraCatchup).toBe(8_600);
  });

  it('limits increase or stay flat year-over-year (never decrease)', () => {
    const years = [2024, 2025, 2026] as const;
    for (let i = 1; i < years.length; i++) {
      const prev = CONTRIBUTION_LIMITS[years[i - 1]];
      const curr = CONTRIBUTION_LIMITS[years[i]];
      expect(curr.tsp).toBeGreaterThanOrEqual(prev.tsp);
      expect(curr.ira).toBeGreaterThanOrEqual(prev.ira);
    }
  });
});

// ── INCOME_PROFILE_TYPES ──────────────────────────────────────────────────────

describe('INCOME_PROFILE_TYPES', () => {
  it('has all four required profile types', () => {
    expect(INCOME_PROFILE_TYPES.combat_zone).toBeDefined();
    expect(INCOME_PROFILE_TYPES.tdy).toBeDefined();
    expect(INCOME_PROFILE_TYPES.training).toBeDefined();
    expect(INCOME_PROFILE_TYPES.custom).toBeDefined();
  });

  it('every type has a non-empty label', () => {
    for (const [key, profile] of Object.entries(INCOME_PROFILE_TYPES)) {
      expect(profile.label.trim(), `${key} missing label`).not.toBe('');
    }
  });

  it('every type has a valid hex color', () => {
    for (const [key, profile] of Object.entries(INCOME_PROFILE_TYPES)) {
      expect(profile.color, `${key} color is not a valid hex color`).toMatch(
        /^#[0-9a-f]{3}([0-9a-f]{3})?$/i,
      );
    }
  });

  it('every type has a defaultFields object (not null/undefined)', () => {
    for (const [key, profile] of Object.entries(INCOME_PROFILE_TYPES)) {
      expect(typeof profile.defaultFields, `${key}.defaultFields should be an object`).toBe(
        'object',
      );
    }
  });

  it('combat_zone defaultFields includes hostile_fire_idp and combat_zone flag', () => {
    expect(INCOME_PROFILE_TYPES.combat_zone.defaultFields.hostile_fire_idp).toBeDefined();
    expect(INCOME_PROFILE_TYPES.combat_zone.defaultFields.combat_zone).toBe(1);
  });
});

// ── INCOME_PROFILE_FIELD_OPTIONS ──────────────────────────────────────────────

describe('INCOME_PROFILE_FIELD_OPTIONS', () => {
  it('is a non-empty array', () => {
    expect(INCOME_PROFILE_FIELD_OPTIONS.length).toBeGreaterThan(0);
  });

  it('has no duplicate keys', () => {
    const keys = INCOME_PROFILE_FIELD_OPTIONS.map((f) => f.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('every entry has a non-empty key and label', () => {
    for (const field of INCOME_PROFILE_FIELD_OPTIONS) {
      expect(field.key.trim(), 'field key should not be empty').not.toBe('');
      expect(field.label.trim(), `${field.key} label should not be empty`).not.toBe('');
    }
  });

  it('every entry has a valid group (Income | Special pay | Deductions | Other)', () => {
    const validGroups = new Set(['Income', 'Special pay', 'Deductions', 'Other']);
    for (const field of INCOME_PROFILE_FIELD_OPTIONS) {
      expect(
        validGroups.has(field.group),
        `${field.key}.group "${field.group}" is not a valid group`,
      ).toBe(true);
    }
  });

  it('includes key income fields (base_pay, bas, bah)', () => {
    const keys = INCOME_PROFILE_FIELD_OPTIONS.map((f) => f.key);
    expect(keys).toContain('base_pay');
    expect(keys).toContain('bas');
    expect(keys).toContain('bah');
  });

  it('includes combat_zone and tsp_rate fields', () => {
    const keys = INCOME_PROFILE_FIELD_OPTIONS.map((f) => f.key);
    expect(keys).toContain('combat_zone');
    expect(keys).toContain('tsp_rate');
  });
});
