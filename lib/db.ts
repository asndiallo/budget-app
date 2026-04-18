// App database schema.
// The `users`, `sessions`, `accounts`, and `verifications` tables are owned by
// Better Auth (lib/auth.ts) and created automatically — do NOT define them here.

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'budget.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
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
      day_of_month    INTEGER
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      description TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      month       TEXT    NOT NULL,
      source      TEXT    NOT NULL DEFAULT 'Other'
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
  `);

  migrateSchema(db);
}

function migrateSchema(db: Database.Database) {
  const cbCols = db.prepare('PRAGMA table_info(category_budgets)').all() as {
    name: string;
  }[];
  if (!cbCols.some((c) => c.name === 'percentage')) {
    db.exec('ALTER TABLE category_budgets ADD COLUMN percentage REAL');
  }

  const debtCols = db.prepare('PRAGMA table_info(debts)').all() as { name: string }[];
  if (!debtCols.some((c) => c.name === 'day_of_month')) {
    db.exec('ALTER TABLE debts ADD COLUMN day_of_month INTEGER');
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
    db.exec("ALTER TABLE leave_tracker ADD COLUMN les_period TEXT");
  }
}
