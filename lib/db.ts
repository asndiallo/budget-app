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

  // Seed income defaults if empty
  const hasIncome = db
    .prepare('SELECT count(*) as n FROM income_config')
    .get() as { n: number };
  if (hasIncome.n === 0) {
    const insert = db.prepare(
      'INSERT INTO income_config (key, value) VALUES (?, ?)',
    );
    const seedIncome = db.transaction(() => {
      insert.run('base_pay', 2160);
      insert.run('bas', 460);
      insert.run('bah', 1803);
      insert.run('other', 0);
      insert.run('roth_ira', 583);
      insert.run('taxes', 0);
      insert.run('sgli', 27);
    });
    seedIncome();
  }

  // Seed fixed expenses if empty
  const hasFixed = db
    .prepare('SELECT count(*) as n FROM fixed_expenses')
    .get() as { n: number };
  if (hasFixed.n === 0) {
    const insert = db.prepare(
      'INSERT INTO fixed_expenses (label, amount) VALUES (?, ?)',
    );
    const seedFixed = db.transaction(() => {
      insert.run('Phone bill', 50);
      insert.run('WGU tuition (monthly)', 148);
      insert.run('Streaming / subscriptions', 30);
    });
    seedFixed();
  }

  // Seed goals if empty
  const hasGoals = db.prepare('SELECT count(*) as n FROM goals').get() as {
    n: number;
  };
  if (hasGoals.n === 0) {
    const insert = db.prepare(
      'INSERT INTO goals (name, target, saved, color) VALUES (?, ?, ?, ?)',
    );
    const seedGoals = db.transaction(() => {
      insert.run('VA loan closing costs', 8000, 0, 'blue');
      insert.run('Emergency fund (3 months)', 6000, 0, 'green');
      insert.run('Wedding costs', 3000, 0, 'pink');
      insert.run('Car fund (post tech school)', 5000, 0, 'amber');
    });
    seedGoals();
  }
}
