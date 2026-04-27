'use client';

import { useState } from 'react';

import { LABEL_CLS } from '@/lib/config';
import type { PayGrade } from '@/lib/pay-tables';
import {
  ENLISTED_GRADES,
  getBAH,
  getBAS,
  getBasePay,
  OFFICER_GRADES,
  RANK_TITLES,
  WARRANT_GRADES,
} from '@/lib/pay-tables';
import type { UserProfile } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

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
  const title = RANK_TITLES[branch as keyof typeof RANK_TITLES]?.[grade];
  return title ? `${grade} · ${title}` : grade;
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

  const [targetGrade, setTargetGrade] = useState<PayGrade>(defaultTarget ?? currentGrade);
  const [yos, setYos] = useState(Math.max(0, user?.years_of_service ?? 0));

  if (!user) return null;

  const withDep = (user.dependents ?? 0) > 0;
  const station = user.duty_station || '';

  const current = computePay(currentGrade, yos, station, withDep, tspRate);
  const promoted = computePay(targetGrade, yos, station, withDep, tspRate);

  const atTopGrade = defaultNextGrade(currentGrade) === null;
  const bahKnown = current.bah > 0 || promoted.bah > 0;

  const baseDelta = promoted.basePay - current.basePay;
  const basDelta = promoted.bas - current.bas;
  const bahDelta = promoted.bah - current.bah;
  const grossDelta = promoted.gross - current.gross;
  const tspDelta = promoted.tspContrib - current.tspContrib;

  const tigHint = TIME_IN_GRADE[currentGrade];

  const rows: {
    label: string;
    cur: number;
    promo: number;
    d: number;
    note?: string;
  }[] = [
    {
      label: 'Base pay',
      cur: current.basePay,
      promo: promoted.basePay,
      d: baseDelta,
    },
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
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Promotion projection</h3>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-text-4 text-[11px]">From</span>
          <span className="text-text bg-surface border-border rounded-lg border px-2 py-1 text-xs font-semibold">
            {currentGrade}
          </span>
        </div>
        <span className="text-text-4 text-xs">→</span>
        <div className="flex items-center gap-2">
          <span className="text-text-4 text-[11px]">To</span>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value as PayGrade)}
            className="bg-surface border-border text-text cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors focus:border-blue-500 focus:outline-none"
          >
            <optgroup label="Enlisted">
              {ENLISTED_GRADES.map((g) => (
                <option key={g} value={g} disabled={g === currentGrade}>
                  {g}
                  {g === defaultNextGrade(currentGrade) ? ' ★' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Warrant">
              {WARRANT_GRADES.map((g) => (
                <option key={g} value={g} disabled={g === currentGrade}>
                  {g}
                </option>
              ))}
            </optgroup>
            <optgroup label="Officer">
              {OFFICER_GRADES.map((g) => (
                <option key={g} value={g} disabled={g === currentGrade}>
                  {g}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-text-4 text-[11px]">YOS at promotion</span>
          <input
            type="number"
            min="0"
            max="40"
            step="0.5"
            value={yos}
            onChange={(e) => setYos(Math.max(0, parseFloat(e.target.value) || 0))}
            className="bg-surface border-border text-text w-16 rounded-lg border px-2 py-1 text-center font-mono text-xs transition-colors focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {atTopGrade && (
        <p className="mb-3 text-[11px] text-amber-400">
          {currentGrade} is the top grade in this category — select any grade for a what-if
          scenario.
        </p>
      )}

      {/* Comparison table */}
      <div className="border-border overflow-hidden rounded-xl border">
        {/* Header row */}
        <div className="bg-surface-raised border-border grid grid-cols-4 border-b px-4 py-2">
          <span className="text-text-4 col-span-1 text-[10px] font-semibold tracking-wider uppercase" />
          <span className="text-text-3 text-right text-[10px] font-semibold tracking-wider uppercase">
            {currentGrade}
          </span>
          <span className="text-right text-[10px] font-semibold tracking-wider text-[#4a8cff] uppercase">
            {targetGrade}
          </span>
          <span className="text-text-3 text-right text-[10px] font-semibold tracking-wider uppercase">
            Change
          </span>
        </div>

        {rows.map(({ label, cur, promo, d, note }) => {
          const { text: dText, color: dColor } = delta(d);
          return (
            <div
              key={label}
              className="border-border-dim hover:bg-surface/50 grid grid-cols-4 items-center border-b px-4 py-2.5 transition-colors"
            >
              <div>
                <span className="text-text-2 text-xs">{label}</span>
                {note && <p className="text-text-4 text-[10px] italic">{note}</p>}
              </div>
              <span className="text-text text-right font-mono text-xs">
                {cur > 0 ? formatCurrency(cur) : <span className="text-text-4">—</span>}
              </span>
              <span className="text-text text-right font-mono text-xs">
                {promo > 0 ? formatCurrency(promo) : <span className="text-text-4">—</span>}
              </span>
              <span className={`text-right font-mono text-xs font-semibold ${dColor}`}>
                {dText}
              </span>
            </div>
          );
        })}

        {/* Gross total */}
        <div className="bg-surface grid grid-cols-4 items-center px-4 py-3">
          <span className="text-text text-xs font-semibold">Gross</span>
          <span className="text-text text-right font-mono text-xs font-semibold">
            {formatCurrency(current.gross)}
          </span>
          <span className="text-right font-mono text-xs font-semibold text-[#4a8cff]">
            {formatCurrency(promoted.gross)}
          </span>
          <div className="text-right">
            <p className={`font-mono text-xs font-bold ${delta(grossDelta).color}`}>
              {delta(grossDelta).text}/mo
            </p>
            {grossDelta !== 0 && (
              <p className={`font-mono text-[10px] ${delta(grossDelta).color}`}>
                {delta(grossDelta * 12).text}/yr
              </p>
            )}
          </div>
        </div>
      </div>

      {/* TSP impact (if meaningful) */}
      {tspRate > 0 && tspDelta !== 0 && (
        <div className="bg-surface border-border mt-3 flex items-center justify-between rounded-xl border px-4 py-2.5">
          <span className="text-text-3 text-[11px]">
            TSP contribution ({Math.round(tspRate * 100)}% of base)
          </span>
          <div className="flex items-center gap-3">
            <span className="text-text-3 font-mono text-[11px]">
              {formatCurrency(current.tspContrib)} → {formatCurrency(promoted.tspContrib)}
            </span>
            <span className={`font-mono text-[11px] font-semibold ${delta(tspDelta).color}`}>
              {delta(tspDelta).text}/mo
            </span>
          </div>
        </div>
      )}

      {/* Rank titles */}
      <div className="text-text-4 mt-3 flex items-start gap-2 text-[11px]">
        <span className="mt-px shrink-0">ⓘ</span>
        <span>
          {rankLabel(currentGrade, user.branch)} <span className="text-text-3">→</span>{' '}
          {rankLabel(targetGrade, user.branch)}
          {tigHint && <span className="text-text-4 ml-2">· Typical eligibility: {tigHint}</span>}
        </span>
      </div>
    </div>
  );
}
