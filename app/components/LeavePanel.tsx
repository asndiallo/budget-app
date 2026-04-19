'use client';

import { useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import { LABEL_CLS } from '@/lib/config';
import type { LeaveEvent } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const ACCRUAL_RATE = 2.5; // days / month
const NORMAL_CAP = 60; // Oct 1 carry-over cap
const SELLBACK_CAP = 60; // lifetime sell-back limit at separation

// How many months before we warn the anchor is stale
const STALE_MONTHS = 3;

interface Anchor {
  balance_days: number;
  les_period: string; // YYYY-MM-DD (end of the LES period)
  imported_at: string;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Simulate leave month-by-month, starting with `startBalance` at the
 * beginning of `startMonth`/`startYear`, through the end of the last
 * fully-completed month.  Applies the Oct 1 fiscal-year carry-over cap
 * after each September.
 */
function computeFromStart(
  startYear: number,
  startMonth: number,
  startBalance: number,
  events: LeaveEvent[],
): number {
  const now = new Date();
  // Last fully-completed calendar month (1-indexed)
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  if (startYear > lastYear || (startYear === lastYear && startMonth > lastMonth)) {
    return Math.max(0, startBalance);
  }

  // Group leave by YYYY-MM for O(1) lookup
  const takenByMonth: Record<string, number> = {};
  for (const e of events) {
    const key = e.taken_at.slice(0, 7);
    takenByMonth[key] = (takenByMonth[key] || 0) + e.days;
  }

  let balance = startBalance;
  let y = startYear;
  let m = startMonth;

  while (y < lastYear || (y === lastYear && m <= lastMonth)) {
    balance += ACCRUAL_RATE;

    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (takenByMonth[key]) {
      balance = Math.max(0, balance - takenByMonth[key]);
    }

    // Fiscal-year rollover: any excess over 60 is forfeited on Oct 1
    if (m === 9) balance = Math.min(balance, NORMAL_CAP);

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return Math.max(0, balance);
}

/**
 * Compute the current leave balance.
 *
 * Priority:
 * 1. If an LES anchor exists, treat it as the authoritative starting point.
 *    Accrue from the month *after* the LES period end.
 *    Only apply leave events whose taken_at is *after* the LES period end.
 * 2. Otherwise fall back to joined_at with a starting balance of 0.
 */
function computeLeaveBalance(
  joinedAt: string,
  events: LeaveEvent[],
  anchor: Anchor | null,
): number {
  if (anchor) {
    const [ay, am] = anchor.les_period.slice(0, 7).split('-').map(Number);
    const nextYear = am === 12 ? ay + 1 : ay;
    const nextMonth = am === 12 ? 1 : am + 1;
    // Events that occur strictly after the LES period end date
    const postAnchor = events.filter((e) => e.taken_at > anchor.les_period);
    return computeFromStart(nextYear, nextMonth, anchor.balance_days, postAnchor);
  }

  if (!joinedAt) return 0;
  const [jy, jm] = joinedAt.split('-').map(Number);
  if (!jy || !jm) return 0;
  return computeFromStart(jy, jm, 0, events);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthsBetween(fromISO: string, toDate: Date): number {
  const d = new Date(fromISO);
  return (toDate.getFullYear() - d.getFullYear()) * 12 + (toDate.getMonth() - d.getMonth());
}

function fmtDate(iso: string) {
  // "2026-03-31" → "Mar 31, 2026"
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  basePay: number;
  joinedAt: string; // "YYYY-MM" from user profile
}

export default function LeavePanel({ basePay, joinedAt }: Props) {
  const [events, setEvents] = useState<LeaveEvent[]>([]);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [loading, setLoading] = useState(true);

  // Record-leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDays, setLeaveDays] = useState('');
  const [leaveNote, setLeaveNote] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);

  // LES import form
  const [showLesForm, setShowLesForm] = useState(false);
  const [lesPeriod, setLesPeriod] = useState(''); // YYYY-MM-DD
  const [lesBalance, setLesBalance] = useState('');
  const [savingLes, setSavingLes] = useState(false);

  useEffect(() => {
    api.leave.get().then((data) => {
      setEvents(data.events);
      setAnchor(data.anchor);
      setLoading(false);
    });
  }, []);

  const balance = useMemo(
    () => computeLeaveBalance(joinedAt, events, anchor),
    [joinedAt, events, anchor],
  );

  // ---- Leave event actions ----

  async function recordLeave() {
    const days = parseFloat(leaveDays);
    if (!leaveDate || isNaN(days) || days <= 0) return;
    setSavingLeave(true);
    try {
      const newEvent = await api.leave.addEvent(leaveDate, days, leaveNote.trim() || null);
      setEvents((prev) => [...prev, newEvent].sort((a, b) => a.taken_at.localeCompare(b.taken_at)));
      setLeaveDate('');
      setLeaveDays('');
      setLeaveNote('');
      setShowLeaveForm(false);
    } finally {
      setSavingLeave(false);
    }
  }

  async function deleteEvent(id: number) {
    await api.leave.removeEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  // ---- LES anchor actions ----

  async function importLes() {
    const bal = parseFloat(lesBalance);
    if (!lesPeriod || isNaN(bal) || bal < 0) return;
    setSavingLes(true);
    try {
      await api.leave.setLesAnchor(bal, lesPeriod);
      const newAnchor: Anchor = {
        balance_days: bal,
        les_period: lesPeriod,
        imported_at: new Date().toISOString(),
      };
      setAnchor(newAnchor);
      setLesPeriod('');
      setLesBalance('');
      setShowLesForm(false);
    } finally {
      setSavingLes(false);
    }
  }

  if (loading) return null;

  if (!joinedAt && !anchor) {
    return (
      <div>
        <h3 className={LABEL_CLS}>Leave balance</h3>
        <p className="text-text-3 mt-2 text-sm">
          Set your service start date in your profile to automatically track leave accrual.
        </p>
      </div>
    );
  }

  // Derived values
  const dailyRate = basePay > 0 ? basePay / 30 : 0;
  const terminalLeaveValue = Math.round(balance * dailyRate);
  const sellBackDays = Math.min(balance, SELLBACK_CAP);
  const sellBackValue = Math.round(sellBackDays * dailyRate);

  // Oct 1 warning
  const today = new Date();
  const oct1 = new Date(today.getFullYear(), 9, 1);
  if (oct1 <= today) oct1.setFullYear(today.getFullYear() + 1);
  const daysToOct1 = Math.ceil((oct1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const projectedBalance = balance + (daysToOct1 / 30) * ACCRUAL_RATE;
  const willExceedCap = projectedBalance > NORMAL_CAP;
  const lostDays = willExceedCap ? Math.round(projectedBalance - NORMAL_CAP) : 0;

  // Anchor staleness
  const anchorAgeMonths = anchor ? monthsBetween(anchor.les_period, today) : null;
  const isStale = anchorAgeMonths !== null && anchorAgeMonths > STALE_MONTHS;

  // Events to show in the log: after anchor, or all if no anchor
  const visibleEvents = anchor ? events.filter((e) => e.taken_at > anchor.les_period) : events;
  const supersededCount = events.length - visibleEvents.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Leave balance</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowLesForm((v) => !v);
              setShowLeaveForm(false);
            }}
            className={`text-[11px] transition-colors ${
              showLesForm ? 'text-text-3' : 'text-[#00d98a] hover:text-[#00d98a]/80'
            }`}
          >
            {showLesForm ? 'Cancel' : '↑ Import LES'}
          </button>
          <span className="text-border">|</span>
          <button
            onClick={() => {
              setShowLeaveForm((v) => !v);
              setShowLesForm(false);
            }}
            className="text-text-4 text-[11px] transition-colors hover:text-[#4a8cff]"
          >
            {showLeaveForm ? 'Cancel' : '+ Record leave'}
          </button>
        </div>
      </div>

      {/* LES anchor status */}
      {anchor ? (
        <div
          className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${
            isStale
              ? 'border-amber-500/30 bg-amber-500/8 text-amber-400'
              : 'border-[#00d98a]/25 bg-[#00d98a]/8 text-[#00d98a]'
          }`}
        >
          <span>{isStale ? '⚠' : '✓'}</span>
          <span>
            LES verified as of {fmtDate(anchor.les_period)} · {anchor.balance_days} days
          </span>
          {isStale && (
            <span className="ml-1 text-amber-500/70">
              ({anchorAgeMonths}mo ago — import a newer LES)
            </span>
          )}
        </div>
      ) : (
        <p className="text-text-4 mb-3 text-[11px]">
          Estimated from service start {joinedAt} · no LES imported yet
        </p>
      )}

      {/* LES import form */}
      {showLesForm && (
        <div className="mb-4 space-y-2 rounded-xl border border-[#00d98a]/30 bg-[#00d98a]/5 p-3">
          <p className="text-[11px] font-semibold tracking-wider text-[#00d98a] uppercase">
            Import LES leave balance
          </p>
          <p className="text-text-4 text-[11px]">
            Find "EOM BAL" (end-of-month balance) in the Leave section of your LES.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-0.5">
              <p className="text-text-4 text-[10px]">LES period end date</p>
              <input
                type="date"
                value={lesPeriod}
                onChange={(e) => setLesPeriod(e.target.value)}
                className="bg-bg border-border text-text rounded-lg border px-2 py-1.5 text-sm transition-colors focus:border-[#00d98a]/60 focus:outline-none"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-text-4 text-[10px]">EOM leave balance (days)</p>
              <input
                type="number"
                min={0}
                step={0.5}
                value={lesBalance}
                onChange={(e) => setLesBalance(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && importLes()}
                placeholder="e.g. 34.5"
                className="bg-bg border-border text-text w-28 rounded-lg border px-2 py-1.5 font-mono text-sm transition-colors focus:border-[#00d98a]/60 focus:outline-none"
              />
            </div>
            <button
              onClick={importLes}
              disabled={savingLes || !lesPeriod || !lesBalance}
              className="rounded-lg bg-[#00d98a] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-[#00d98a]/80 disabled:opacity-40"
            >
              {savingLes ? '…' : 'Set anchor'}
            </button>
          </div>
          {anchor && (
            <p className="text-text-4 text-[10px]">
              Previous anchor: {fmtDate(anchor.les_period)} · {anchor.balance_days} days — will be
              replaced. Leave events before the new LES date will be ignored in calculations.
            </p>
          )}
        </div>
      )}

      {/* Record leave form */}
      {showLeaveForm && (
        <div className="border-border bg-surface mb-4 space-y-2 rounded-xl border p-3">
          <p className="text-text-3 text-[11px] font-semibold tracking-wider uppercase">
            Record leave taken
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              min={anchor?.les_period}
              className="bg-bg border-border text-text rounded-lg border px-2 py-1.5 text-sm transition-colors focus:border-blue-600 focus:outline-none"
            />
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={leaveDays}
              onChange={(e) => setLeaveDays(e.target.value)}
              placeholder="Days"
              className="bg-bg border-border text-text w-20 rounded-lg border px-2 py-1.5 font-mono text-sm transition-colors focus:border-blue-600 focus:outline-none"
            />
            <input
              value={leaveNote}
              onChange={(e) => setLeaveNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && recordLeave()}
              placeholder="Note (optional)"
              className="bg-bg border-border text-text min-w-32 flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors focus:border-blue-600 focus:outline-none"
            />
            <button
              onClick={recordLeave}
              disabled={savingLeave || !leaveDate || !leaveDays}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            >
              {savingLeave ? '…' : 'Save'}
            </button>
          </div>
          {anchor && (
            <p className="text-text-4 text-[10px]">
              Only leave taken after {fmtDate(anchor.les_period)} affects the balance — earlier
              dates are covered by your LES import.
            </p>
          )}
        </div>
      )}

      {/* Balance display */}
      <div className="mb-4 flex items-baseline gap-1.5">
        <span className="text-text font-mono text-3xl font-semibold">
          {balance % 1 === 0 ? balance : balance.toFixed(1)}
        </span>
        <span className="text-text-3 text-sm">days</span>
        {visibleEvents.length > 0 && (
          <span className="text-text-4 ml-1 text-[11px]">
            (−{visibleEvents.reduce((s, e) => s + e.days, 0)} taken since LES)
          </span>
        )}
      </div>

      {/* Value cards */}
      {basePay > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="border-border bg-surface-raised/20 rounded-xl border p-3">
            <p className="text-text-3 mb-1 text-[11px]">Terminal leave value</p>
            <p className="text-text font-mono text-lg font-semibold">
              {formatCurrency(terminalLeaveValue)}
            </p>
            <p className="text-text-4 mt-0.5 text-[10px]">
              {balance.toFixed(1)} days × {formatCurrency(dailyRate)}/day
            </p>
          </div>
          <div className="border-border bg-surface-raised/20 rounded-xl border p-3">
            <p className="text-text-3 mb-1 text-[11px]">Sell-back at separation</p>
            <p className="text-text font-mono text-lg font-semibold">
              {formatCurrency(sellBackValue)}
            </p>
            <p className="text-text-4 mt-0.5 text-[10px]">
              {sellBackDays} days (lifetime cap: {SELLBACK_CAP})
            </p>
          </div>
        </div>
      )}

      {/* Oct 1 cap warning */}
      {willExceedCap && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">
            ⚠ At risk of losing {lostDays} day{lostDays !== 1 ? 's' : ''} on Oct 1
          </p>
          <p className="mt-0.5 text-[11px] text-amber-500/70">
            Projected balance: {projectedBalance.toFixed(1)} days in {daysToOct1} days — exceeds the{' '}
            {NORMAL_CAP}-day carry-over cap. Use leave before Oct 1.
          </p>
        </div>
      )}

      {/* Leave event log */}
      {visibleEvents.length > 0 && (
        <div className="mb-3">
          <p className="text-text-4 mb-2 text-[11px] font-semibold tracking-wider uppercase">
            Leave taken{anchor ? ` since ${fmtDate(anchor.les_period)}` : ''}
          </p>
          <div className="space-y-0.5">
            {visibleEvents.map((e) => (
              <div
                key={e.id}
                className="border-border-dim flex items-center gap-2 border-b py-1.5 text-xs"
              >
                <span className="text-text-3 shrink-0 font-mono">{e.taken_at}</span>
                <span className="shrink-0 font-mono text-[#ff4560]">
                  −{e.days} day{e.days !== 1 ? 's' : ''}
                </span>
                {e.note && <span className="text-text-4 flex-1 truncate">{e.note}</span>}
                <button
                  onClick={() => deleteEvent(e.id)}
                  className="text-text-4 ml-auto shrink-0 transition-colors hover:text-[#ff4560]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Superseded events note */}
      {supersededCount > 0 && (
        <p className="text-text-4 mb-3 text-[10px]">
          {supersededCount} leave record{supersededCount !== 1 ? 's' : ''} before the LES date are
          superseded by the LES import and not counted.
        </p>
      )}

      {/* Quick reference */}
      <div className="text-text-4 border-border-dim space-y-0.5 border-t pt-2 text-[11px]">
        <p>
          · Accrual: {ACCRUAL_RATE} days/month · carry-over cap: {NORMAL_CAP} days (Oct 1)
        </p>
        <p>· Sell-back limit: {SELLBACK_CAP} days lifetime at separation</p>
      </div>
    </div>
  );
}
