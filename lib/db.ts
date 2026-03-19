import { SEED_FIXED_EXPENSES, SEED_GOALS, SEED_INCOME } from './config';

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
    CREATE TABLE IF NOT EXISTS income_config (
      key   TEXT PRIMARY KEY,
      value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      label     TEXT NOT NULL,
      amount    REAL NOT NULL,
      active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount      REAL NOT NULL,
      category    TEXT NOT NULL DEFAULT 'Other',
      month       TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'manual',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      target   REAL NOT NULL,
      saved    REAL NOT NULL DEFAULT 0,
      color    TEXT NOT NULL DEFAULT 'blue',
      active   INTEGER NOT NULL DEFAULT 1
    );
  `);

  const count = (table: string) =>
    (db.prepare(`SELECT count(*) as n FROM ${table}`).get() as { n: number }).n;

  if (count('income_config') === 0) {
    const ins = db.prepare(
      'INSERT INTO income_config (key, value) VALUES (?, ?)',
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(SEED_INCOME))
        ins.run(key, value);
    })();
  }

  if (count('fixed_expenses') === 0) {
    const ins = db.prepare(
      'INSERT INTO fixed_expenses (label, amount) VALUES (?, ?)',
    );
    db.transaction(() => {
      for (const { label, amount } of SEED_FIXED_EXPENSES)
        ins.run(label, amount);
    })();
  }

  if (count('goals') === 0) {
    const ins = db.prepare(
      'INSERT INTO goals (name, target, saved, color) VALUES (?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (const { name, target, saved, color } of SEED_GOALS)
        ins.run(name, target, saved, color);
    })();
  }
}
