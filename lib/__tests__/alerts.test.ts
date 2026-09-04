import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDailyDigest, type Digest, digestSubject, digestToHtml } from '../alerts';
import { initSchema } from '../db';

const USER = 'user-1';

function buildDb(): Database.Database {
  const db = new Database(':memory:');
  initSchema(db);
  // users/sessions/etc. are owned by Better Auth in production; the app tables
  // only ever touch `joined_at`, so a minimal stand-in is enough for tests.
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, joined_at TEXT)');
  db.prepare('INSERT INTO users (id, joined_at) VALUES (?, NULL)').run(USER);
  return db;
}

describe('buildDailyDigest()', () => {
  let db: Database.Database;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00'));
    db = buildDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns no sections and hasContent false for a brand-new user', () => {
    const digest = buildDailyDigest(db, USER);
    expect(digest.sections).toEqual([]);
    expect(digest.hasContent).toBe(false);
    expect(digest.snapshot).toEqual({
      month: '2026-06',
      takeHome: 0,
      spending: 0,
      savingsRatePct: 0,
      topCategories: [],
    });
  });

  describe('bills due soon', () => {
    it('includes an unpaid bill due within the window', () => {
      db.prepare(
        `INSERT INTO fixed_expenses (user_id, label, amount, period, day_of_month, active)
         VALUES (?, 'Rent', 1200, 'monthly', 12, 1)`,
      ).run(USER);

      const digest = buildDailyDigest(db, USER);
      const section = digest.sections.find((s) => s.title === 'Bills due soon');
      expect(section).toEqual({
        title: 'Bills due soon',
        tone: 'amber',
        lines: ['Rent — $1,200, due the 12'],
      });
    });

    it('excludes a bill outside the due-soon window', () => {
      db.prepare(
        `INSERT INTO fixed_expenses (user_id, label, amount, period, day_of_month, active)
         VALUES (?, 'Car insurance', 90, 'monthly', 25, 1)`,
      ).run(USER);

      const digest = buildDailyDigest(db, USER);
      expect(digest.sections.find((s) => s.title === 'Bills due soon')).toBeUndefined();
    });

    it('excludes a bill already marked paid this month', () => {
      const { lastInsertRowid: feId } = db
        .prepare(
          `INSERT INTO fixed_expenses (user_id, label, amount, period, day_of_month, active)
           VALUES (?, 'Internet', 60, 'monthly', 12, 1)`,
        )
        .run(USER);
      db.prepare(
        'INSERT INTO bill_payments (user_id, fixed_expense_id, month) VALUES (?, ?, ?)',
      ).run(USER, feId, '2026-06');

      const digest = buildDailyDigest(db, USER);
      expect(digest.sections.find((s) => s.title === 'Bills due soon')).toBeUndefined();
    });

    it('excludes a biweekly bill', () => {
      db.prepare(
        `INSERT INTO fixed_expenses (user_id, label, amount, period, day_of_month, recurrence, active)
         VALUES (?, 'Daycare', 400, 'monthly', 12, 'biweekly', 1)`,
      ).run(USER);

      const digest = buildDailyDigest(db, USER);
      expect(digest.sections.find((s) => s.title === 'Bills due soon')).toBeUndefined();
    });
  });

  describe('snapshot', () => {
    it('totals current-month spending by category, excluding Investment, sorted descending', () => {
      const insert = db.prepare(
        'INSERT INTO transactions (user_id, description, amount, category, month) VALUES (?, ?, ?, ?, ?)',
      );
      insert.run(USER, 'Groceries', 150, 'Food', '2026-06');
      insert.run(USER, 'Gas', 40, 'Transport', '2026-06');
      insert.run(USER, 'Roth IRA', 500, 'Investment', '2026-06');

      const { snapshot } = buildDailyDigest(db, USER);
      expect(snapshot.spending).toBe(190);
      expect(snapshot.topCategories).toEqual([
        { category: 'Food', amount: 150 },
        { category: 'Transport', amount: 40 },
      ]);
    });
  });

  describe('spending pace', () => {
    it('flags a category running well over its trailing average', () => {
      const insert = db.prepare(
        "INSERT INTO transactions (user_id, description, amount, category, month) VALUES (?, 'x', ?, 'Family', ?)",
      );
      for (const month of ['2026-03', '2026-04', '2026-05']) insert.run(USER, 100, month);
      insert.run(USER, 300, '2026-06'); // day 10 of 30 → projected $900, 800% over avg

      const digest = buildDailyDigest(db, USER);
      const section = digest.sections.find((s) => s.title === 'Spending pace');
      expect(section?.lines).toEqual(['Family — projected $900, 800% over its $100 average']);
    });

    it('stays silent with no spending history', () => {
      const digest = buildDailyDigest(db, USER);
      expect(digest.sections.find((s) => s.title === 'Spending pace')).toBeUndefined();
    });
  });

  describe('health score drop', () => {
    it('reports no drop on the first run (no stored baseline)', () => {
      const digest = buildDailyDigest(db, USER);
      expect(
        digest.sections.find((s) => s.title === 'Financial health score drop'),
      ).toBeUndefined();
    });

    it('flags a drop against a previously stored score', () => {
      db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(
        `health_score_last:${USER}`,
        '50',
      );

      const digest = buildDailyDigest(db, USER);
      // Zero income/budgets/debts data → health score total is 12/100 (default budget-adherence score).
      const section = digest.sections.find((s) => s.title === 'Financial health score drop');
      expect(section).toEqual({
        title: 'Financial health score drop',
        tone: 'red',
        lines: ['12/100, down from 50/100 since the last check'],
      });
    });

    it('overwrites the stored baseline after each run', () => {
      buildDailyDigest(db, USER);
      const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ?')
        .get(`health_score_last:${USER}`) as { value: string };
      expect(row.value).toBe('12');
    });
  });
});

const emptySnapshot: Digest['snapshot'] = {
  month: '2026-06',
  takeHome: 3847,
  spending: 312,
  savingsRatePct: 95,
  topCategories: [],
};

describe('digestToHtml() / digestSubject()', () => {
  it('renders each section title and its lines', () => {
    const digest: Digest = {
      snapshot: emptySnapshot,
      sections: [{ title: 'Bills due soon', tone: 'amber', lines: ['Rent — $1,200, due the 12'] }],
      hasContent: true,
    };
    const html = digestToHtml(digest);
    expect(html).toContain('Bills due soon');
    expect(html).toContain('Rent — $1,200, due the 12');
    expect(html).toContain('$3,847'); // take-home stat
    expect(digestSubject(digest)).toBe('Fieldbook: Bills due soon');
  });

  it('renders the top-categories bar chart when present', () => {
    const digest: Digest = {
      snapshot: { ...emptySnapshot, topCategories: [{ category: 'Family', amount: 292 }] },
      sections: [],
      hasContent: false,
    };
    const html = digestToHtml(digest);
    expect(html).toContain('Top categories this month');
    expect(html).toContain('Family');
    expect(html).toContain('$292');
  });

  it('handles an empty digest', () => {
    const digest: Digest = { snapshot: emptySnapshot, sections: [], hasContent: false };
    expect(digestToHtml(digest)).toContain('Fieldbook');
    expect(digestSubject(digest)).toBe('Fieldbook: ');
  });

  it('escapes HTML in section lines and category names', () => {
    const digest: Digest = {
      snapshot: {
        ...emptySnapshot,
        topCategories: [{ category: '<script>alert(1)</script>', amount: 50 }],
      },
      sections: [{ title: 'Bills due soon', tone: 'amber', lines: ['<b>Rent</b> & fees'] }],
      hasContent: true,
    };
    const html = digestToHtml(digest);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>Rent</b> & fees');
    expect(html).toContain('&lt;b&gt;Rent&lt;/b&gt; &amp; fees');
  });
});
