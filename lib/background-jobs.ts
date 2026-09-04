import type Database from 'better-sqlite3';

import { buildDailyDigest, digestSubject, digestToHtml } from './alerts';
import { getDb } from './db';
import { sendAlertEmail } from './email';
import { scanImportFolders } from './import-watcher';

type Db = Database.Database;

const IMPORT_SCAN_INTERVAL_MS = 5 * 60 * 1000;
const DIGEST_CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Local hour (0-23) after which the daily digest is eligible to send. */
const DIGEST_SEND_HOUR = 7;

function getPrimaryUserId(db: Db): string | null {
  const row = db.prepare('SELECT id FROM users ORDER BY createdAt ASC LIMIT 1').get() as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function runDigestCheck(db: Db, userId: string): Promise<void> {
  if (new Date().getHours() < DIGEST_SEND_HOUR) return;

  const key = `alert_last_run_date:${userId}`;
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (row?.value === todayLocal()) return; // already ran today

  const digest = buildDailyDigest(db, userId);
  if (digest.hasContent) {
    await sendAlertEmail(digestSubject(digest), digestToHtml(digest));
  }

  db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, todayLocal());
}

export function startBackgroundJobs(): void {
  const db = getDb();

  const runImportScan = () => {
    try {
      const userId = getPrimaryUserId(db);
      if (!userId) return;
      scanImportFolders(db, userId);
    } catch (e) {
      console.warn('[background-jobs] import scan failed:', e);
    }
  };

  const runDigest = () => {
    try {
      const userId = getPrimaryUserId(db);
      if (!userId) return;
      runDigestCheck(db, userId).catch((e) =>
        console.warn('[background-jobs] digest check failed:', e),
      );
    } catch (e) {
      console.warn('[background-jobs] digest check failed:', e);
    }
  };

  runImportScan();
  runDigest();
  setInterval(runImportScan, IMPORT_SCAN_INTERVAL_MS);
  setInterval(runDigest, DIGEST_CHECK_INTERVAL_MS);
}
