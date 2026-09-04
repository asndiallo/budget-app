#!/usr/bin/env node
// Backs up budget.db to a local rotating folder and (if present) an iCloud
// Drive folder, so real financial data survives a dead disk or a mistake.
//
// Uses better-sqlite3's native .backup() — a plain `cp` of budget.db alone
// misses whatever's still sitting in the WAL file (journal_mode = WAL), which
// can be most of the recent data. .backup() produces a single consistent
// snapshot safely, even while the app is running.
//
// Run manually:  node scripts/backup-db.cjs
// Run on a schedule: see scripts/com.fieldbook.dbbackup.plist (launchd, macOS)

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const REPO_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(REPO_ROOT, 'budget.db');
const LOCAL_BACKUP_DIR = path.join(REPO_ROOT, 'backups');
const ICLOUD_BACKUP_DIR = path.join(
  os.homedir(),
  'Library',
  'Mobile Documents',
  'com~apple~CloudDocs',
  'Fieldbook Backups',
);
const RETENTION_COUNT = 30; // keep the last 30 backups in each location

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function rotate(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('budget-') && f.endsWith('.db'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { f } of files.slice(RETENTION_COUNT)) {
    fs.unlinkSync(path.join(dir, f));
  }
}

async function backupTo(dir, label) {
  console.log(`[${label}] starting backup to ${dir}`);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `budget-${timestamp()}.db`);
  const src = new Database(DB_PATH, { readonly: true });
  try {
    const result = await src.backup(dest);
    console.log(`[${label}] backed up (${result.totalPages} pages) -> ${dest}`);
  } catch (err) {
    // A failed backup can leave a truncated/corrupt destination file (and a
    // -journal) behind — remove it rather than let a broken file masquerade
    // as a real backup.
    for (const f of [dest, dest + '-journal']) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    console.error(`[${label}] FAILED: ${err && err.stack ? err.stack : err}`);
    throw err;
  } finally {
    src.close();
  }
  rotate(dir);
}

(async () => {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`budget.db not found at ${DB_PATH}`);
    process.exit(1);
  }

  await backupTo(LOCAL_BACKUP_DIR, 'local');

  if (fs.existsSync(path.dirname(ICLOUD_BACKUP_DIR))) {
    try {
      await backupTo(ICLOUD_BACKUP_DIR, 'iCloud');
    } catch {
      // Local backup already succeeded above — don't fail the whole run over
      // the off-machine copy, but make sure the failure is visible in the log.
      console.error('iCloud backup failed this run — local backup is still up to date.');
    }
  } else {
    console.warn('iCloud Drive folder not found — skipping off-machine backup this run.');
  }
})().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
