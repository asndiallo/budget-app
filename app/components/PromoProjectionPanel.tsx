'use client';

import { useState } from 'react';
import {
  ENLISTED_GRADES,
  OFFICER_GRADES,
  PAY_GRADES,
  RANK_TITLES,
  WARRANT_GRADES,
  getBAH,
  getBAS,
  getBasePay,
  isOfficer,
} from '@/lib/pay-tables';
import type { PayGrade } from '@/lib/pay-tables';
import type { UserProfile } from '@/lib/types';

// ── Time-in-grade minimums (DoD 1215.08) ─────────────────────────────────────
// Shown as reference; branch/component may vary.
const TIME_IN_GRADE: Partial<Record<PayGrade, string>> = {
  'E-1': '6 months TIS',
  'E-2': '1 year TIS',
  'E-3': '2 years TIS',
  'E-4': '24 months TIG (board-selected in some branches)',
  'E-5': '36 months TIG (board)',
  'E-6': '36 months TIG (board)',
  'E-7': '36 months TIG (board)',
  'E-8': '36 months TIG (board)',
  'W-1': '18 months',
  'W-2': '2 years TIG',
  'W-3': '3 years TIG',
  'W-4': '3 years TIG',
  'O-1': '18 months TIS',
  'O-2': '2 years TIG',
  'O-3': '4 years TIG (board)',
  'O-4': '3 years TIG (board)',
  'O-5': '3 years TIG (board)',
  'O-6': '3 years TIG (board, very competitive)',
};

// ── Next grade in the same category ──────────────────────────────────────────
function defaultNextGrade(current: string): PayGrade | null {
  const enlisted = [...ENLISTED_GRADES];
  const warrant = [...WARRANT_GRADES];
  const officer = [...OFFICER_GRADES];
  const ei = enlisted.indexOf(current as (typeof ENLISTED_GRADES)[number]);
  if (ei !== -1) return ei < enlisted.length - 1 ? enlisted[ei + 1] : null;
  const wi = warrant.indexOf(current as (typeof WARRANT_GRADES)[number]);
  if (wi !== -1) return wi < warrant.length - 1 ? warrant[wi + 1] : null;
  const oi = officer.indexOf(current as (typeof OFFICER_GRADES)[number]);
  if (oi !== -1) return oi < officer.length - 1 ? officer[oi + 1] : null;
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rankLabel(grade: PayGrade, branch: string): string {
  const title =
    RANK_TITLES[branch as keyof typeof RANK_TITLES]?.[grade];
  return title ? `${grade} · ${title}` : grade;
}

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

function delta(n: number): { text: string; color: string } {
  if (n === 0) return { text: '—', color: 'text-text-4' };
  const sign = n > 0 ? '+' : '−';
  return {
    text: sign + '$' + Math.round(Math.abs(n)).toLocaleString(),
    color: n > 0 ? 'text-[#00d98a]' : 'text-[#ff4560]',
  };
}

interface PayBreakdown {
  basePay: number;
  bas: number;
  bah: number;
  gross: number;
  tspContrib: number;
}

function computePay(
  grade: PayGrade,
  yos: number,
  dutyStation: string,
  withDependents: boolean,
  tspRate: number,
): PayBreakdown {
  const basePay = getBasePay(grade, yos);
  const bas = getBAS(grade);
  const bah = getBAH(dutyStation, grade, withDependents);
  const gross = basePay + bas + bah;
  const tspContrib = Math.round(basePay * tspRate);
  return { basePay, bas, bah, gross, tspContrib };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PromoProjectionPanel({
  user,
  tspRate = 0.05,
}: {
  user: UserProfile | null;
  tspRate?: number;
}) {
  const currentGrade = (user?.pay_grade ?? 'E-3') as PayGrade;
  const defaultTarget = defaultNextGrade(currentGrade);

  const [targetGrade, setTargetGrade] = useState<PayGrade>(
    defaultTarget ?? currentGrade,
  );
  const [yos, setYos] = useState(Math.max(0, user?.years_of_service ?? 0));

  if (!user) return null;

  const withDep = (user.dependents ?? 0) > 0;
  const station = user.duty_station || '';

  const current = computePay(currentGrade, yos, station, withDep, tspRate);
  const promoted = computePay(targetGrade, yos, station, withDep, tspRate);

  const atTopGrade = defaultNextGrade(currentGrade) === null;
  const bahKnown = current.bah > 0 || promoted.bah > 0;
  const bahLabel = bahKnown
    ? undefined
    : 'BAH not available for this duty station';

  const baseDelta = promoted.basePay - current.basePay;
  const basDelta = promoted.bas - current.bas;
  const bahDelta = promoted.bah - current.bah;
  const grossDelta = promoted.gross - current.gross;
  const tspDelta = promoted.tspContrib - current.tspContrib;

  const tigHint = TIME_IN_GRADE[currentGrade];

  const rows: { label: string; cur: number; promo: number; d: number; note?: string }[] = [
    { label: 'Base pay', cur: current.basePay, promo: promoted.basePay, d: baseDelta },
    { label: 'BAS', cur: current.bas, promo: promoted.bas, d: basDelta },
    {
      label: 'BAH',
      cur: current.bah,
      promo: promoted.bah,
      d: bahDelta,
      note: bahKnown ? undefined : 'enter duty station in profile',
    },
  ];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          Promotion projection
        </h3>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-4">From</span>
          <span className="text-xs font-semibold text-text px-2 py-1 rounded-lg bg-surface border border-border">
            {currentGrade}
          </span>
        </div>
        <span className="text-text-4 text-xs">→</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-4">To</span>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value as PayGrade)}
            className="text-xs bg-surface border border-border rounded-lg px-2 py-1 text-text focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <optgroup label="Enlisted">
              {ENLISTED_GRADES.map((g) => (
                <option key={g} value={g} disabled={g === currentGrade}>
                  {g}{g === defaultNextGrade(currentGrade) ? ' ★' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Warrant">
              {WARRANT_GRADES.map((g) => (
                <option key={g} value={g} disabled={g === currentGrade}>{g}</option>
              ))}
            </optgroup>
            <optgroup label="Officer">
              {OFFICER_GRADES.map((g) => (
                <option key={g} value={g} disabled={g === currentGrade}>{g}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-text-4">YOS at promotion</span>
          <input
            type="number"
            min="0"
            max="40"
            step="0.5"
            value={yos}
            onChange={(e) => setYos(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-16 text-xs font-mono bg-surface border border-border rounded-lg px-2 py-1 text-text focus:outline-none focus:border-blue-500 transition-colors text-center"
          />
        </div>
      </div>

      {atTopGrade && (
        <p className="text-[11px] text-amber-400 mb-3">
          {currentGrade} is the top grade in this category — select any grade for a what-if scenario.
        </p>
      )}

      {/* Comparison table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-4 bg-surface-raised px-4 py-2 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-4 col-span-1" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-3 text-right">
            {currentGrade}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4a8cff] text-right">
            {targetGrade}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-3 text-right">
            Change
          </span>
        </div>

        {rows.map(({ label, cur, promo, d, note }) => {
          const { text: dText, color: dColor } = delta(d);
          return (
            <div
              key={label}
              className="grid grid-cols-4 px-4 py-2.5 border-b border-border-dim items-center hover:bg-surface/50 transition-colors"
            >
              <div>
                <span className="text-xs text-text-2">{label}</span>
                {note && (
                  <p className="text-[10px] text-text-4 italic">{note}</p>
                )}
              </div>
              <span className="text-xs font-mono text-text text-right">
                {cur > 0 ? fmt(cur) : <span className="text-text-4">—</span>}
              </span>
              <span className="text-xs font-mono text-text text-right">
                {promo > 0 ? fmt(promo) : <span className="text-text-4">—</span>}
              </span>
              <span className={`text-xs font-mono text-right font-semibold ${dColor}`}>
                {dText}
              </span>
            </div>
          );
        })}

        {/* Gross total */}
        <div className="grid grid-cols-4 px-4 py-3 bg-surface items-center">
          <span className="text-xs font-semibold text-text">Gross</span>
          <span className="text-xs font-mono font-semibold text-text text-right">
            {fmt(current.gross)}
          </span>
          <span className="text-xs font-mono font-semibold text-[#4a8cff] text-right">
            {fmt(promoted.gross)}
          </span>
          <div className="text-right">
            <p className={`text-xs font-mono font-bold ${delta(grossDelta).color}`}>
              {delta(grossDelta).text}/mo
            </p>
            {grossDelta !== 0 && (
              <p className={`text-[10px] font-mono ${delta(grossDelta).color}`}>
                {delta(grossDelta * 12).text}/yr
              </p>
            )}
          </div>
        </div>
      </div>

      {/* TSP impact (if meaningful) */}
      {tspRate > 0 && tspDelta !== 0 && (
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <span className="text-[11px] text-text-3">
            TSP contribution ({Math.round(tspRate * 100)}% of base)
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-text-3">
              {fmt(current.tspContrib)} → {fmt(promoted.tspContrib)}
            </span>
            <span className={`text-[11px] font-mono font-semibold ${delta(tspDelta).color}`}>
              {delta(tspDelta).text}/mo
            </span>
          </div>
        </div>
      )}

      {/* Rank titles */}
      <div className="mt-3 flex items-start gap-2 text-[11px] text-text-4">
        <span className="shrink-0 mt-px">ⓘ</span>
        <span>
          {rankLabel(currentGrade, user.branch)}{' '}
          <span className="text-text-3">→</span>{' '}
          {rankLabel(targetGrade, user.branch)}
          {tigHint && (
            <span className="ml-2 text-text-4">
              · Typical eligibility: {tigHint}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
