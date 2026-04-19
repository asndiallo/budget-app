// Pure CSV import helpers — extracted here so they can be unit-tested.

import { CSV_CATEGORY_MAP, DEFAULT_CATEGORY } from './config';

/**
 * Parses a date string from a CSV row into a normalised month + ISO date.
 * Accepts MM/DD/YYYY and YYYY-MM-DD formats.
 * Returns null for empty or unrecognised strings.
 */
export function parseDate(dateStr: string): { month: string; date: string } | null {
  if (!dateStr) return null;

  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return { month: `${y}-${m.padStart(2, '0')}`, date };
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso)
    return {
      month: `${iso[1]}-${iso[2]}`,
      date: `${iso[1]}-${iso[2]}-${iso[3]}`,
    };

  return null;
}

/**
 * Maps a raw CSV category label (e.g. "Food & Drink") to an internal
 * app category using CSV_CATEGORY_MAP. Falls back to DEFAULT_CATEGORY.
 */
export function mapCategory(raw: string): string {
  const lower = (raw || '').toLowerCase();
  for (const [key, val] of Object.entries(CSV_CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return DEFAULT_CATEGORY;
}
