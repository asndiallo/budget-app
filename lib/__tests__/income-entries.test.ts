import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { computeMonthlyFinancials } from '../income';
import { getIncomeEntriesTotal } from '../queries';

// ── In-memory schema ──────────────────────────────────────────────────────────
// Real SQL (not a mock) because the helper filters on month and joins
// conceptually against the user's joined_at.

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

function addEntry(
  db: Db,
  e: { description: string; amount: number; month: string; source?: string },
) {
  db.prepare(
    'INSERT INTO income_entries (user_id, description, amount, month, source) VALUES (?, ?, ?, ?, ?)',
  ).run(USER, e.description, e.amount, e.month, e.source ?? 'Other');
}

function setJoinedAt(db: Db, joinedAt: string) {
  db.prepare('UPDATE users SET joined_at = ? WHERE id = ?').run(joinedAt, USER);
}

// ── getIncomeEntriesTotal ─────────────────────────────────────────────────────

describe('getIncomeEntriesTotal', () => {
  let db: Db;
  beforeEach(() => {
    db = makeDb();
  });

  it('returns 0 when there are no entries at all', () => {
    expect(getIncomeEntriesTotal(db, USER, '2026-08')).toBe(0);
  });

  it('sums a single entry for the month', () => {
    addEntry(db, {
      description: 'DoorDash payout',
      amount: 62.4,
      month: '2026-08',
      source: 'DoorDash',
    });
    expect(getIncomeEntriesTotal(db, USER, '2026-08')).toBe(62.4);
  });

  it('sums multiple entries across gig platforms in the same month', () => {
    addEntry(db, {
      description: 'DoorDash payout',
      amount: 62.4,
      month: '2026-08',
      source: 'DoorDash',
    });
    addEntry(db, { description: 'Uber payout', amount: 38.15, month: '2026-08', source: 'Uber' });
    addEntry(db, {
      description: 'Spark payout',
      amount: 21,
      month: '2026-08',
      source: 'Walmart Spark',
    });
    expect(getIncomeEntriesTotal(db, USER, '2026-08')).toBeCloseTo(121.55, 2);
  });

  it('does not leak an entry from a different month', () => {
    addEntry(db, { description: 'DoorDash payout', amount: 62.4, month: '2026-07' });
    expect(getIncomeEntriesTotal(db, USER, '2026-08')).toBe(0);
    expect(getIncomeEntriesTotal(db, USER, '2026-07')).toBe(62.4);
  });

  it('scopes entries to the owning user', () => {
    addEntry(db, { description: 'DoorDash payout', amount: 62.4, month: '2026-08' });
    expect(getIncomeEntriesTotal(db, 'someone-else', '2026-08')).toBe(0);
  });

  it('returns 0 for months before the user joined_at', () => {
    setJoinedAt(db, '2026-03');
    addEntry(db, { description: 'DoorDash payout', amount: 62.4, month: '2026-02' });
    expect(getIncomeEntriesTotal(db, USER, '2026-02')).toBe(0);
  });

  it('treats an empty-string joined_at as "no boundary set"', () => {
    addEntry(db, { description: 'DoorDash payout', amount: 62.4, month: '2020-01' });
    expect(getIncomeEntriesTotal(db, USER, '2020-01')).toBe(62.4);
  });
});

// ── Integration with computeMonthlyFinancials ─────────────────────────────────

describe('computeMonthlyFinancials — income_entries integration', () => {
  let db: Db;
  beforeEach(() => {
    db = makeDb();
    const ins = db.prepare(
      'INSERT INTO income_config (user_id, month, key, value) VALUES (?,?,?,?)',
    );
    ins.run(USER, '2026-08', 'base_pay', 2836.8);
    ins.run(USER, '2026-08', 'bas', 470.88);
    ins.run(USER, '2026-08', 'bah', 1410);
  });

  const MILITARY = 2836.8 + 470.88 + 1410;

  it('reports military pay only when there are no entries', () => {
    const { totalIncome, entries } = computeMonthlyFinancials(db, '2026-08', USER);
    expect(entries).toBe(0);
    expect(totalIncome).toBeCloseTo(MILITARY, 2);
  });

  it('adds gig-income entries into totalIncome', () => {
    addEntry(db, {
      description: 'DoorDash payout',
      amount: 62.4,
      month: '2026-08',
      source: 'DoorDash',
    });
    addEntry(db, { description: 'Uber payout', amount: 38.15, month: '2026-08', source: 'Uber' });
    const { totalIncome, entries } = computeMonthlyFinancials(db, '2026-08', USER);
    expect(entries).toBeCloseTo(100.55, 2);
    expect(totalIncome).toBeCloseTo(MILITARY + 100.55, 2);
  });

  it('leaves tsp and allowances untouched by income_entries', () => {
    const before = computeMonthlyFinancials(db, '2026-08', USER);
    addEntry(db, { description: 'DoorDash payout', amount: 62.4, month: '2026-08' });
    const after = computeMonthlyFinancials(db, '2026-08', USER);
    expect(after.tsp).toBe(before.tsp);
    expect(after.allowances).toBe(before.allowances);
    expect(after.totalIncome).toBeGreaterThan(before.totalIncome);
  });
});
