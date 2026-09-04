import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { computeMonthlyFinancials } from '../income';
import { getActiveIncomeStreamsTotal } from '../queries';

// ── In-memory schema ──────────────────────────────────────────────────────────
// Real SQL (not a mock) because the helper filters on active/start_date/end_date
// and joins conceptually against the user's joined_at.

const USER = 'u1';

type Db = ReturnType<typeof makeDb>;

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id        TEXT PRIMARY KEY,
      joined_at TEXT
    );
    CREATE TABLE income_config (
      user_id TEXT NOT NULL,
      month   TEXT NOT NULL,
      key     TEXT NOT NULL,
      value   REAL NOT NULL,
      PRIMARY KEY (user_id, month, key)
    );
    CREATE TABLE income_streams (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT    NOT NULL,
      label        TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      frequency    TEXT    NOT NULL DEFAULT 'monthly',
      day_of_month INTEGER,
      category     TEXT    NOT NULL DEFAULT 'Other',
      variable     INTEGER NOT NULL DEFAULT 0,
      start_date   TEXT,
      end_date     TEXT,
      notes        TEXT,
      active       INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE income_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'Other'
    );
  `);
  db.prepare('INSERT INTO users (id, joined_at) VALUES (?, ?)').run(USER, '');
  return db;
}

function addStream(
  db: Db,
  s: {
    label: string;
    amount: number;
    frequency?: string;
    category?: string;
    variable?: number;
    start_date?: string | null;
    end_date?: string | null;
    active?: number;
  },
) {
  db.prepare(
    `INSERT INTO income_streams (user_id, label, amount, frequency, category, variable, start_date, end_date, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    USER,
    s.label,
    s.amount,
    s.frequency ?? 'monthly',
    s.category ?? 'Other',
    s.variable ?? 0,
    s.start_date ?? null,
    s.end_date ?? null,
    s.active ?? 1,
  );
}

function setJoinedAt(db: Db, joinedAt: string) {
  db.prepare('UPDATE users SET joined_at = ? WHERE id = ?').run(joinedAt, USER);
}

// ── getActiveIncomeStreamsTotal ───────────────────────────────────────────────

describe('getActiveIncomeStreamsTotal', () => {
  let db: Db;
  beforeEach(() => {
    db = makeDb();
  });

  it('returns 0 when the user has no streams at all', () => {
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(0);
  });

  it('returns the amount for a single active monthly stream', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, start_date: '2026-08-10' });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(750);
  });

  it('excludes an inactive (soft-deleted) stream', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, active: 0 });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(0);
  });

  it('sums a mix of active monthly streams and ignores the inactive one', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, category: 'Rental' });
    addStream(db, { label: 'Airbnb — master bedroom', amount: 438, category: 'Airbnb' });
    addStream(db, { label: 'Old tenant', amount: 600, active: 0 });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(1188);
  });

  it('does not credit a stream to months before its start_date', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, start_date: '2026-08-10' });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-07')).toBe(0);
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(750);
  });

  it('credits the full amount in the start month regardless of day within it', () => {
    addStream(db, { label: 'Late-month start', amount: 500, start_date: '2026-08-28' });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(500);
  });

  it('does not credit a stream to months after its end_date', () => {
    addStream(db, {
      label: 'Departed tenant',
      amount: 750,
      start_date: '2026-01-01',
      end_date: '2026-06-30',
    });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-06')).toBe(750);
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-07')).toBe(0);
  });

  it('returns 0 for months before the user joined_at', () => {
    setJoinedAt(db, '2026-03');
    addStream(db, { label: 'Brian — room rental', amount: 750, start_date: '2026-01-01' });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-02')).toBe(0);
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-03')).toBe(750);
  });

  it('treats an empty-string joined_at as "no boundary set"', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750 });
    expect(getActiveIncomeStreamsTotal(db, USER, '2020-01')).toBe(750);
  });

  it('counts biweekly streams by occurrence within the month, not as a flat amount', () => {
    // Anchor Fri 2026-08-07; occurrences in Aug: 7, 21 → 2 hits (the 14th and 28th
    // are off-cycle). September gets 4, 18 → 2 hits.
    addStream(db, {
      label: 'Biweekly gig',
      amount: 100,
      frequency: 'biweekly',
      start_date: '2026-08-07',
    });
    expect(getActiveIncomeStreamsTotal(db, USER, '2026-08')).toBe(200);
  });

  it('scopes streams to the owning user', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750 });
    expect(getActiveIncomeStreamsTotal(db, 'someone-else', '2026-08')).toBe(0);
  });
});

// ── Integration with computeMonthlyFinancials ─────────────────────────────────

describe('computeMonthlyFinancials — income stream integration', () => {
  let db: Db;
  beforeEach(() => {
    db = makeDb();
    const ins = db.prepare(
      'INSERT INTO income_config (user_id, month, key, value) VALUES (?,?,?,?)',
    );
    ins.run(USER, '2026-08', 'base_pay', 2836.8);
    ins.run(USER, '2026-08', 'bas', 470.88);
    ins.run(USER, '2026-08', 'bah', 1410);
    ins.run(USER, '2026-08', 'tsp_rate', 0.05);
  });

  const MILITARY = 2836.8 + 470.88 + 1410;

  it('reports military pay only when there are no streams', () => {
    const { totalIncome, streams } = computeMonthlyFinancials(db, '2026-08', USER);
    expect(streams).toBe(0);
    expect(totalIncome).toBeCloseTo(MILITARY, 2);
  });

  it('adds an active stream into totalIncome', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, start_date: '2026-08-10' });
    const { totalIncome, streams } = computeMonthlyFinancials(db, '2026-08', USER);
    expect(streams).toBe(750);
    expect(totalIncome).toBeCloseTo(MILITARY + 750, 2);
  });

  it('adds both real streams (Brian + Airbnb) into totalIncome', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, category: 'Rental' });
    addStream(db, {
      label: 'Airbnb — master bedroom',
      amount: 438,
      category: 'Airbnb',
      variable: 1,
    });
    const { totalIncome, streams } = computeMonthlyFinancials(db, '2026-08', USER);
    expect(streams).toBe(1188);
    expect(totalIncome).toBeCloseTo(MILITARY + 1188, 2);
  });

  it('leaves tsp and allowances untouched by streams', () => {
    const before = computeMonthlyFinancials(db, '2026-08', USER);
    addStream(db, { label: 'Brian — room rental', amount: 750 });
    const after = computeMonthlyFinancials(db, '2026-08', USER);
    expect(after.tsp).toBe(before.tsp);
    expect(after.allowances).toBe(before.allowances);
    expect(after.totalIncome).toBeGreaterThan(before.totalIncome);
  });

  it('does not add a stream to a month before it started', () => {
    addStream(db, { label: 'Brian — room rental', amount: 750, start_date: '2026-08-10' });
    const { streams } = computeMonthlyFinancials(db, '2026-07', USER);
    expect(streams).toBe(0);
  });
});
