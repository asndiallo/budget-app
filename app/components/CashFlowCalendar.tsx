'use client';

import type { FixedExpense, Transaction } from '@/lib/types';
import { useEffect, useState } from 'react';

import { CAT_COLORS } from '@/lib/config';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PAY_DAYS = [1, 15];

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
  if (week.length > 0)
    weeks.push([...week, ...Array(7 - week.length).fill(null)]);
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (!month) return;
    setSelectedDay(null);
    Promise.all([api.transactions.list(month), api.fixedExpenses.list()]).then(
      ([txs, fe]) => {
        setTransactions(txs);
        setFixedExpenses(fe);
      },
    );
  }, [month]);

  const weeks = buildWeeks(month);
  const today = new Date();
  const todayDay =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` ===
    month
      ? today.getDate()
      : null;

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
    if (f.day_of_month) {
      if (!billsByDay[f.day_of_month]) billsByDay[f.day_of_month] = [];
      billsByDay[f.day_of_month].push(f);
    }
  }

  const payPerCheck = netMonthlyIncome ? netMonthlyIncome / 2 : null;
  const hasIncome = !!(netMonthlyIncome && netMonthlyIncome > 0);

  const selectedTxs = selectedDay ? txsByDay[selectedDay] || [] : [];
  const selectedBills = selectedDay ? billsByDay[selectedDay] || [] : [];
  const isPayDay = selectedDay ? PAY_DAYS.includes(selectedDay) : false;

  // Summary totals
  const totalSpend = Object.values(spendByDay).reduce((s, v) => s + v, 0);
  const datedTxCount = transactions.filter(
    (t) => parseDayOfMonth(t) !== null,
  ).length;

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-[10px] text-text-4">
        {hasIncome && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00d98a] inline-block" />
            Pay days (1st &amp; 15th)
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#4a8cff] inline-block" />
          Bill due
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#ff4560] inline-block" />
          Spending
        </span>
        {datedTxCount < transactions.length && (
          <span className="ml-auto text-text-4">
            {transactions.length - datedTxCount} manual tx without dates
          </span>
        )}
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-4 py-1"
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
              const isPay = PAY_DAYS.includes(day);
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const hasDots =
                spend > 0 || bills.length > 0 || (isPay && hasIncome);

              return (
                <button
                  key={di}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`h-16 sm:h-20 rounded-lg border text-left px-1.5 py-1 flex flex-col transition-all overflow-hidden ${
                    isSelected
                      ? 'border-[#4a8cff] bg-surface-blue'
                      : isToday
                        ? 'border-[#4a8cff]/40 bg-surface'
                        : hasDots
                          ? 'border-border bg-surface hover:border-[#4a8cff]/30'
                          : 'border-border-dim bg-surface hover:border-border'
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold leading-none mb-1 ${
                      isToday
                        ? 'text-[#4a8cff]'
                        : isSelected
                          ? 'text-text-2'
                          : 'text-text-3'
                    }`}
                  >
                    {day}
                  </span>

                  {/* Indicators */}
                  <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                    {isPay && hasIncome && (
                      <span className="text-[9px] font-medium text-[#00d98a] leading-tight truncate">
                        {payPerCheck
                          ? `+${formatCurrency(payPerCheck)}`
                          : 'Pay'}
                      </span>
                    )}
                    {bills.slice(0, 2).map((b) => (
                      <span
                        key={b.id}
                        className="text-[9px] text-[#4a8cff] leading-tight truncate"
                      >
                        {b.label}
                      </span>
                    ))}
                    {bills.length > 2 && (
                      <span className="text-[9px] text-text-4 leading-tight">
                        +{bills.length - 2} more
                      </span>
                    )}
                    {spend > 0 && (
                      <span className="text-[9px] font-mono text-[#ff4560] leading-tight">
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
        <div className="mt-4 pt-3 border-t border-border-dim flex items-center gap-4 text-xs text-text-3">
          <span>
            <span className="text-text-4">Month spend </span>
            <span className="font-mono text-[#ff4560]">
              −{formatCurrency(totalSpend)}
            </span>
          </span>
          {datedTxCount > 0 && (
            <span>
              <span className="text-text-4">Avg/day </span>
              <span className="font-mono text-text-2">
                {formatCurrency(totalSpend / Object.keys(spendByDay).length)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay !== null && (
        <div className="mt-3 bg-bg border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-text">
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
            <div className="flex items-center gap-2 py-2 border-b border-border-dim">
              <span className="text-xs text-[#00d98a]">Military pay</span>
              {payPerCheck && (
                <span className="ml-auto text-xs font-mono text-[#00d98a]">
                  +{formatCurrency(payPerCheck)}
                </span>
              )}
            </div>
          )}

          {selectedBills.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 py-2 border-b border-border-dim"
            >
              <span className="text-xs text-[#4a8cff]">{b.label}</span>
              <span className="ml-auto text-xs font-mono text-[#ff4560]">
                −{formatCurrency(b.amount)}
              </span>
            </div>
          ))}

          {selectedTxs.length > 0 ? (
            <div className="space-y-1.5 mt-2">
              {selectedTxs.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      color: CAT_COLORS[t.category] ?? '#7c88a4',
                      background: `${CAT_COLORS[t.category] ?? '#7c88a4'}22`,
                    }}
                  >
                    {t.category}
                  </span>
                  <span className="text-xs text-text-2 flex-1 truncate">
                    {t.description}
                  </span>
                  <span className="text-xs font-mono text-[#ff4560] shrink-0">
                    −{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-border-dim flex justify-end">
                <span className="text-[11px] font-mono text-[#ff4560]">
                  −{formatCurrency(spendByDay[selectedDay] || 0)} total
                </span>
              </div>
            </div>
          ) : selectedBills.length === 0 && !(isPayDay && hasIncome) ? (
            <p className="text-xs text-text-4 mt-1">
              No activity recorded for this day.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
