'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { CHART_CAT_COLORS } from '@/lib/config';
import type { Debt, FixedExpense, Transaction } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PAY_DAYS = [1, 15];
const DUE_SOON_WINDOW = 5;

/**
 * Military pay hits on the 1st and 15th. If either falls on a weekend,
 * DFAS deposits on the preceding Friday.
 * Returns null when the adjusted day falls into the prior month (e.g. the 1st is Saturday).
 */
function adjustedPayDay(nominalDay: number, year: number, month: number): number | null {
  const dow = new Date(year, month - 1, nominalDay).getDay();
  const adjusted = dow === 6 ? nominalDay - 1 : dow === 0 ? nominalDay - 2 : nominalDay;
  return adjusted >= 1 ? adjusted : null;
}

/**
 * Returns all days in the given month that fall on the biweekly schedule
 * defined by anchor (a YYYY-MM-DD date on the schedule).
 * Day-of-week and phase are both derived from the anchor.
 */
function biweeklyDays(
  year: number,
  month: number,
  anchor: string,
  endDate?: string | null,
): number[] {
  const anchorDate = new Date(anchor + 'T00:00:00');
  const dow = anchorDate.getDay();
  const anchorMs = anchorDate.getTime();
  const days: number[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() !== dow) continue;
    const diffDays = Math.round((d.getTime() - anchorMs) / 86_400_000);
    if (diffDays < 0 || diffDays % 14 !== 0) continue; // before start date
    if (endDate) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (dateStr > endDate) continue;
    }
    days.push(day);
  }
  return days;
}

function buildWeeks(month: string): (number | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);
  return weeks;
}

function parseDayOfMonth(t: Transaction): number | null {
  const src = t.date || t.created_at;
  if (!src) return null;
  const iso = src.match(/^\d{4}-\d{2}-(\d{2})/);
  if (iso) return parseInt(iso[1]);
  const us = src.match(/^\d{1,2}\/(\d{1,2})\/\d{4}/);
  if (us) return parseInt(us[1]);
  return null;
}

export default function CashFlowCalendar({
  month,
  netMonthlyIncome,
}: {
  month: string;
  netMonthlyIncome?: number;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (!month) return;
    setSelectedDay(null);
    void Promise.all([api.transactions.list(month), api.fixedExpenses.list(), api.debts.list()]).then(
      ([txs, fe, ds]) => {
        setTransactions(txs);
        setFixedExpenses(fe);
        setDebts(ds);
      },
    );
  }, [month]);

  const weeks = buildWeeks(month);
  const today = new Date();
  const todayDay =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` === month
      ? today.getDate()
      : null;

  // Weekend-adjusted pay days
  const [y, m] = month.split('-').map(Number);
  const actualPayDays = PAY_DAYS.map((d) => ({
    nominal: d,
    actual: adjustedPayDay(d, y, m),
  }));
  const payDaySet = new Set(actualPayDays.filter((p) => p.actual !== null).map((p) => p.actual!));
  const anyPayShifted = actualPayDays.some((p) => p.actual !== null && p.actual !== p.nominal);

  // Days with bills due within DUE_SOON_WINDOW days of today (current month only)
  const dueSoonDays = new Set(
    todayDay === null
      ? []
      : fixedExpenses
          .filter(
            (f) =>
              f.day_of_month !== null &&
              f.day_of_month !== undefined &&
              f.day_of_month >= todayDay &&
              f.day_of_month <= todayDay + DUE_SOON_WINDOW,
          )
          .map((f) => f.day_of_month!),
  );

  // Index transactions and bills by day
  const txsByDay: Record<number, Transaction[]> = {};
  const spendByDay: Record<number, number> = {};
  for (const t of transactions) {
    const d = parseDayOfMonth(t);
    if (!d) continue;
    if (!txsByDay[d]) txsByDay[d] = [];
    txsByDay[d].push(t);
    spendByDay[d] = (spendByDay[d] || 0) + t.amount;
  }

  const billsByDay: Record<number, FixedExpense[]> = {};
  for (const f of fixedExpenses) {
    if (f.recurrence === 'biweekly' && f.recurrence_anchor) {
      for (const day of biweeklyDays(y, m, f.recurrence_anchor, f.end_date)) {
        if (!billsByDay[day]) billsByDay[day] = [];
        billsByDay[day].push(f);
      }
    } else if (f.day_of_month) {
      if (!billsByDay[f.day_of_month]) billsByDay[f.day_of_month] = [];
      billsByDay[f.day_of_month].push(f);
    }
  }

  // Index active debts by their payment day
  const debtsByDay: Record<number, Debt[]> = {};
  for (const d of debts) {
    if (d.balance > 0 && d.day_of_month) {
      if (!debtsByDay[d.day_of_month]) debtsByDay[d.day_of_month] = [];
      debtsByDay[d.day_of_month].push(d);
    }
  }

  const payPerCheck = netMonthlyIncome ? netMonthlyIncome / 2 : null;
  const hasIncome = !!(netMonthlyIncome && netMonthlyIncome > 0);

  const selectedTxs = selectedDay ? txsByDay[selectedDay] || [] : [];
  const selectedBills = selectedDay ? billsByDay[selectedDay] || [] : [];
  const selectedDebts = selectedDay ? debtsByDay[selectedDay] || [] : [];
  const isPayDay = selectedDay ? payDaySet.has(selectedDay) : false;
  const isSelectedDueSoon = selectedDay !== null && dueSoonDays.has(selectedDay);

  // Summary totals
  const totalSpend = Object.values(spendByDay).reduce((s, v) => s + v, 0);
  const datedTxCount = transactions.filter((t) => parseDayOfMonth(t) !== null).length;

  return (
    <div>
      {/* Legend */}
      <div className="text-text-4 mb-4 flex items-center gap-4 text-[10px]">
        {hasIncome && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00d98a]" />
            {anyPayShifted ? 'Pay days (adjusted)' : 'Pay days (1st & 15th)'}
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#4a8cff]" />
          Bill due
        </span>
        {Object.keys(debtsByDay).length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#a78bfa]" />
            Loan payment
          </span>
        )}
        {todayDay !== null && dueSoonDays.size > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Due soon
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ff4560]" />
          Spending
        </span>
        {datedTxCount < transactions.length && (
          <span className="text-text-4 ml-auto">
            {transactions.length - datedTxCount} manual tx without dates
          </span>
        )}
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DOW.map((d) => (
          <div
            key={d}
            className="text-text-4 py-1 text-center text-[10px] font-semibold tracking-widest uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="h-16 sm:h-20" />;

              const spend = spendByDay[day] || 0;
              const bills = billsByDay[day] || [];
              const dayDebts = debtsByDay[day] || [];
              const isPay = payDaySet.has(day);
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const isDueSoonDay = dueSoonDays.has(day) && bills.length > 0;
              const hasDots =
                spend > 0 || bills.length > 0 || dayDebts.length > 0 || (isPay && hasIncome);

              return (
                <button
                  key={di}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`flex h-16 flex-col overflow-hidden rounded-lg border px-1.5 py-1 text-left transition-all sm:h-20 ${
                    isSelected
                      ? 'bg-surface-blue border-[#4a8cff]'
                      : isToday
                        ? 'bg-surface border-[#4a8cff]/40'
                        : isDueSoonDay
                          ? 'border-amber-400/50 bg-amber-500/5 hover:border-amber-400/80'
                          : hasDots
                            ? 'border-border bg-surface hover:border-[#4a8cff]/30'
                            : 'border-border-dim bg-surface hover:border-border'
                  }`}
                >
                  <span
                    className={`mb-1 text-[11px] leading-none font-semibold ${
                      isToday ? 'text-[#4a8cff]' : isSelected ? 'text-text-2' : 'text-text-3'
                    }`}
                  >
                    {day}
                  </span>

                  {/* Indicators */}
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    {isPay && hasIncome && (
                      <span className="truncate text-[9px] leading-tight font-medium text-[#00d98a]">
                        {payPerCheck ? `+${formatCurrency(payPerCheck)}` : 'Pay'}
                      </span>
                    )}
                    {bills.slice(0, 2).map((b) => (
                      <span key={b.id} className="truncate text-[9px] leading-tight text-[#4a8cff]">
                        {b.label}
                      </span>
                    ))}
                    {dayDebts.slice(0, bills.length > 1 ? 0 : 1).map((d) => (
                      <span key={d.id} className="truncate text-[9px] leading-tight text-[#a78bfa]">
                        {d.label}
                      </span>
                    ))}
                    {bills.length + dayDebts.length > 2 && (
                      <span className="text-text-4 text-[9px] leading-tight">
                        +{bills.length + dayDebts.length - 2} more
                      </span>
                    )}
                    {spend > 0 && (
                      <span className="font-mono text-[9px] leading-tight text-[#ff4560]">
                        −{formatCurrency(spend)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Monthly summary bar */}
      {totalSpend > 0 && (
        <div className="border-border-dim text-text-3 mt-4 flex items-center gap-4 border-t pt-3 text-xs">
          <span>
            <span className="text-text-4">Month spend </span>
            <span className="font-mono text-[#ff4560]">−{formatCurrency(totalSpend)}</span>
          </span>
          {datedTxCount > 0 && (
            <span>
              <span className="text-text-4">Avg/day </span>
              <span className="text-text-2 font-mono">
                {formatCurrency(totalSpend / Object.keys(spendByDay).length)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay !== null && (
        <div className="bg-bg border-border mt-3 rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-text text-sm font-semibold">
              {new Date(
                parseInt(month.split('-')[0]),
                parseInt(month.split('-')[1]) - 1,
                selectedDay,
              ).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </h4>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-text-4 hover:text-text-2 text-xs"
            >
              ✕
            </button>
          </div>

          {isPayDay && hasIncome && (
            <div className="border-border-dim flex items-center gap-2 border-b py-2">
              <span className="text-xs text-[#00d98a]">Pay day</span>
              {payPerCheck && (
                <span className="ml-auto font-mono text-xs text-[#00d98a]">
                  +{formatCurrency(payPerCheck)}
                </span>
              )}
            </div>
          )}
          {isSelectedDueSoon && selectedBills.length > 0 && (
            <p className="mb-1 text-[10px] text-amber-400">
              Bills due within {DUE_SOON_WINDOW} days
            </p>
          )}

          {selectedBills.map((b) => (
            <div key={b.id} className="border-border-dim flex items-center gap-2 border-b py-2">
              <span className="text-xs text-[#4a8cff]">{b.label}</span>
              <span className="ml-auto font-mono text-xs text-[#ff4560]">
                −{formatCurrency(b.amount)}
              </span>
            </div>
          ))}
          {selectedDebts.map((d) => (
            <div key={d.id} className="border-border-dim flex items-center gap-2 border-b py-2">
              <span className="text-xs text-[#a78bfa]">{d.label}</span>
              <span className="text-text-4 ml-1 text-[10px]">{d.lender}</span>
              <span className="ml-auto font-mono text-xs text-[#ff4560]">
                −{formatCurrency(d.monthly_payment)}
              </span>
            </div>
          ))}

          {selectedTxs.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {selectedTxs.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{
                      color: CHART_CAT_COLORS[t.category] ?? '#7c88a4',
                      background: `${CHART_CAT_COLORS[t.category] ?? '#7c88a4'}22`,
                    }}
                  >
                    {t.category}
                  </span>
                  <span className="text-text-2 flex-1 truncate text-xs">{t.description}</span>
                  <span className="shrink-0 font-mono text-xs text-[#ff4560]">
                    −{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
              <div className="border-border-dim flex justify-end border-t pt-1.5">
                <span className="font-mono text-[11px] text-[#ff4560]">
                  −{formatCurrency(spendByDay[selectedDay] || 0)} total
                </span>
              </div>
            </div>
          ) : selectedBills.length === 0 &&
            selectedDebts.length === 0 &&
            !(isPayDay && hasIncome) ? (
            <p className="text-text-4 mt-1 text-xs">No activity recorded for this day.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
