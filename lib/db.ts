// App database schema.
// The `users`, `sessions`, `accounts`, and `verifications` tables are owned by
// Better Auth (lib/auth.ts) and created automatically — do NOT define them here.

import Database from 'better-sqlite3';
import path from 'path';

export const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'budget.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  return _db;
}

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- user_id is TEXT (Better Auth UUIDs)

    CREATE TABLE IF NOT EXISTS income_config (
      user_id TEXT NOT NULL,
      month   TEXT NOT NULL,
      key     TEXT NOT NULL,
      value   REAL NOT NULL,
      PRIMARY KEY (user_id, month, key)
    );

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      label         TEXT    NOT NULL,
      amount        REAL    NOT NULL,
      period        TEXT    NOT NULL DEFAULT 'monthly',
      day_of_month  INTEGER,
      notes         TEXT,
      is_investment INTEGER NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'Other',
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'manual',
      date        TEXT,
      import_id   TEXT,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_dedup
      ON transactions(user_id, description, amount, date, source)
      WHERE date IS NOT NULL;

    CREATE TABLE IF NOT EXISTS goals (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT    NOT NULL,
      name    TEXT    NOT NULL,
      target  REAL    NOT NULL,
      saved   REAL    NOT NULL DEFAULT 0,
      color   TEXT    NOT NULL DEFAULT 'blue',
      active  INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id    INTEGER NOT NULL,
      amount     REAL    NOT NULL,
      note       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_sources (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT    NOT NULL,
      label   TEXT    NOT NULL,
      UNIQUE(user_id, label)
    );

    CREATE TABLE IF NOT EXISTS debts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT    NOT NULL,
      label           TEXT    NOT NULL,
      lender          TEXT    NOT NULL DEFAULT '',
      balance         REAL    NOT NULL DEFAULT 0,
      monthly_payment REAL    NOT NULL DEFAULT 0,
      interest_rate   REAL    NOT NULL DEFAULT 0,
      day_of_month    INTEGER,
      match_keywords  TEXT
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'Other'
    );

    CREATE TABLE IF NOT EXISTS income_streams (
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

    CREATE TABLE IF NOT EXISTS receivables (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT    NOT NULL,
      name          TEXT    NOT NULL,
      description   TEXT    NOT NULL DEFAULT '',
      amount        REAL    NOT NULL,
      amount_paid   REAL    NOT NULL DEFAULT 0,
      month_created TEXT    NOT NULL,
      month_paid    TEXT,
      paid          INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS category_budgets (
      user_id  TEXT NOT NULL,
      category TEXT NOT NULL,
      budget   REAL NOT NULL,
      PRIMARY KEY (user_id, category)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      label      TEXT    NOT NULL,
      category   TEXT    NOT NULL DEFAULT 'Other',
      balance    REAL    NOT NULL DEFAULT 0,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT    NOT NULL,
      debt_id        INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL,
      amount         REAL    NOT NULL,
      applied_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, transaction_id)
    );

    CREATE TABLE IF NOT EXISTS bill_payments (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          TEXT    NOT NULL,
      fixed_expense_id INTEGER NOT NULL,
      month            TEXT    NOT NULL,
      paid_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, fixed_expense_id, month)
    );

    CREATE TABLE IF NOT EXISTS categorization_rules (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  TEXT    NOT NULL,
      keyword  TEXT    NOT NULL,
      category TEXT    NOT NULL,
      UNIQUE(user_id, keyword)
    );

    -- Leave balance: one row per user, updated in-place (kept for backwards compat)
    CREATE TABLE IF NOT EXISTS leave_tracker (
      user_id      TEXT NOT NULL PRIMARY KEY,
      balance_days REAL NOT NULL DEFAULT 0,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Leave events: individual leave periods taken
    CREATE TABLE IF NOT EXISTS leave_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      taken_at   TEXT    NOT NULL, -- YYYY-MM-DD start date of leave
      days       REAL    NOT NULL,
      note       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Net worth snapshots: one row per user per day (upserted on asset/debt changes)
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      recorded_at TEXT    NOT NULL, -- YYYY-MM-DD
      assets      REAL    NOT NULL DEFAULT 0,
      liabilities REAL    NOT NULL DEFAULT 0,
      net_worth   REAL    NOT NULL DEFAULT 0,
      UNIQUE(user_id, recorded_at)
    );

    -- Financial accounts: named accounts (Fidelity Roth IRA, USAA Checking, etc.)
    -- used to link transactions to specific accounts for richer context.
    CREATE TABLE IF NOT EXISTS financial_accounts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'other',
      institution TEXT NOT NULL DEFAULT '',
      notes       TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Allotments: fixed amounts automatically deducted from military gross pay.
    -- Active for months in [start_date, end_date] (both inclusive, end NULL = ongoing).
    CREATE TABLE IF NOT EXISTS allotments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      label      TEXT    NOT NULL,
      amount     REAL    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'other',
      start_date TEXT    NOT NULL, -- YYYY-MM
      end_date   TEXT,             -- YYYY-MM, NULL = ongoing
      notes      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Income profiles: named sets of income field overrides with a date range.
    -- Applied manually to a month's income_config via the UI banner.
    CREATE TABLE IF NOT EXISTS income_profiles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      name       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'custom',
      start_date TEXT    NOT NULL, -- YYYY-MM (inclusive)
      end_date   TEXT,             -- YYYY-MM (inclusive), NULL = ongoing
      fields     TEXT    NOT NULL DEFAULT '{}', -- JSON: Record<string, number>
      notes      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT    NOT NULL,
      name         TEXT    NOT NULL,
      key_hash     TEXT    NOT NULL UNIQUE,
      key_prefix   TEXT    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    );
  `);

  migrateSchema(db);
}

function migrateSchema(db: Database.Database) {
  // Add account_id to transactions for financial account linking
  const txCols = db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[];
  if (!txCols.some((c) => c.name === 'account_id')) {
    db.exec('ALTER TABLE transactions ADD COLUMN account_id INTEGER');
  }
  // tax_year: explicit IRS tax year override (null = derive from month).
  // Allows a Jan 2026 IRA contribution to count toward 2025 limits.
  if (!txCols.some((c) => c.name === 'tax_year')) {
    db.exec('ALTER TABLE transactions ADD COLUMN tax_year INTEGER');
  }

  const cbCols = db.prepare('PRAGMA table_info(category_budgets)').all() as {
    name: string;
  }[];
  if (!cbCols.some((c) => c.name === 'percentage')) {
    db.exec('ALTER TABLE category_budgets ADD COLUMN percentage REAL');
  }

  const bpCols = db.prepare('PRAGMA table_info(bill_payments)').all() as { name: string }[];
  if (!bpCols.some((c) => c.name === 'matched_tx_id')) {
    db.exec('ALTER TABLE bill_payments ADD COLUMN matched_tx_id INTEGER');
  }

  const debtCols = db.prepare('PRAGMA table_info(debts)').all() as { name: string }[];
  if (!debtCols.some((c) => c.name === 'day_of_month')) {
    db.exec('ALTER TABLE debts ADD COLUMN day_of_month INTEGER');
  }
  if (!debtCols.some((c) => c.name === 'match_keywords')) {
    db.exec('ALTER TABLE debts ADD COLUMN match_keywords TEXT');
  }

  const feCols = db.prepare('PRAGMA table_info(fixed_expenses)').all() as {
    name: string;
  }[];
  if (!feCols.some((c) => c.name === 'goal_id')) {
    db.exec('ALTER TABLE fixed_expenses ADD COLUMN goal_id INTEGER');
  }
  if (!feCols.some((c) => c.name === 'recurrence')) {
    db.exec("ALTER TABLE fixed_expenses ADD COLUMN recurrence TEXT DEFAULT 'monthly'");
  }
  if (!feCols.some((c) => c.name === 'recurrence_anchor')) {
    db.exec('ALTER TABLE fixed_expenses ADD COLUMN recurrence_anchor TEXT');
  }
  if (!feCols.some((c) => c.name === 'end_date')) {
    db.exec('ALTER TABLE fixed_expenses ADD COLUMN end_date TEXT');
  }

  // Leave tracker: add les_period column (YYYY-MM-DD end of the LES period)
  const ltCols = db.prepare('PRAGMA table_info(leave_tracker)').all() as {
    name: string;
  }[];
  if (!ltCols.some((c) => c.name === 'les_period')) {
    db.exec('ALTER TABLE leave_tracker ADD COLUMN les_period TEXT');
  }

  const akCols = db.prepare('PRAGMA table_info(api_keys)').all() as { name: string }[];
  if (
    akCols.length > 0 &&
    akCols.some((c) => c.name === 'key') &&
    !akCols.some((c) => c.name === 'key_hash')
  ) {
    db.exec(`
      DROP TABLE api_keys;
      CREATE TABLE api_keys (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      TEXT    NOT NULL,
        name         TEXT    NOT NULL,
        key_hash     TEXT    NOT NULL UNIQUE,
        key_prefix   TEXT    NOT NULL,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT
      );
    `);
  }
}

/**
 * Upserts a net worth snapshot for today (one snapshot per user per day).
 * Should be called after any asset or debt balance mutation.
 */
export function takeNetWorthSnapshot(db: Database.Database, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { assets } = db
    .prepare('SELECT COALESCE(SUM(balance), 0) AS assets FROM assets WHERE user_id = ?')
    .get(userId) as { assets: number };
  const { liabilities } = db
    .prepare('SELECT COALESCE(SUM(balance), 0) AS liabilities FROM debts WHERE user_id = ?')
    .get(userId) as { liabilities: number };
  const { goalsSaved } = db
    .prepare(
      'SELECT COALESCE(SUM(saved), 0) AS goalsSaved FROM goals WHERE user_id = ? AND active = 1',
    )
    .get(userId) as { goalsSaved: number };
  const totalAssets = assets + goalsSaved;
  db.prepare(
    `INSERT INTO net_worth_snapshots (user_id, recorded_at, assets, liabilities, net_worth)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, recorded_at) DO UPDATE SET
       assets      = excluded.assets,
       liabilities = excluded.liabilities,
       net_worth   = excluded.net_worth`,
  ).run(userId, today, totalAssets, liabilities, totalAssets - liabilities);
}
