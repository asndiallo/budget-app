'use client';

import {
  BrsInputs,
  BrsResult,
  calcBrs,
  dodMatchRate,
  inferRetirementSystem,
} from '@/lib/brs-calc';
import { useEffect, useMemo, useState } from 'react';

import type { PayGrade } from '@/lib/pay-tables';
import { TSP_CONFIG, LABEL_CLS } from '@/lib/config';
import type { UserProfile } from '@/lib/types';
import { api } from '@/lib/api';

interface Props {
  user: UserProfile | null;
  month: string;
}

import ExternalLink from './ExternalLink';
import { formatCurrency } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number) {
  return n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'k' : formatCurrency(n);
}

// ── System badge ──────────────────────────────────────────────────────────────

function SystemBadge({
  system,
}: {
  system: ReturnType<typeof inferRetirementSystem>;
}) {
  if (system === 'brs')
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-[#4a8cff]">
        Your system: BRS
      </span>
    );
  if (system === 'legacy')
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-raised text-text-3">
        Your system: Legacy High-3
      </span>
    );
  if (system === 'uncertain')
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
        System: may have opted in — verify with finance
      </span>
    );
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-raised text-text-4">
      Set join date in profile to identify your system
    </span>
  );
}

// ── Comparison row ────────────────────────────────────────────────────────────

function CompRow({
  label,
  legacy,
  brs,
  note,
  highlight,
  winner,
}: {
  label: string;
  legacy: string;
  brs: string;
  note?: string;
  highlight?: boolean;
  winner?: 'legacy' | 'brs' | null;
}) {
  return (
    <div
      className={`grid grid-cols-3 px-4 py-2.5 border-b border-border-dim items-start ${highlight ? 'bg-surface' : 'hover:bg-surface/30'} transition-colors`}
    >
      <div>
        <span className="text-xs text-text-2">{label}</span>
        {note && <p className="text-[10px] text-text-4 mt-0.5">{note}</p>}
      </div>
      <span
        className={`text-xs font-mono text-right ${highlight ? 'font-semibold text-text' : 'text-text-2'} ${winner === 'legacy' ? 'text-[#00d98a]' : ''}`}
      >
        {legacy}
      </span>
      <span
        className={`text-xs font-mono text-right ${highlight ? 'font-semibold text-text' : 'text-text-2'} ${winner === 'brs' ? 'text-[#00d98a]' : ''}`}
      >
        {brs}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BrsPanel({ user, month }: Props) {
  const [tspRateStr, setTspRateStr] = useState('5');
  const [retYos, setRetYos] = useState(20);
  const [returnPct, setReturnPct] = useState(6);
  const [contMult, setContMult] = useState(2.5);
  const [basePay, setBasePay] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Fetch actual base pay and TSP rate from income config
  useEffect(() => {
    api.income.get(month).then((data) => {
      setBasePay(data.base_pay ?? 0);
      const rate = data.tsp_rate ?? TSP_CONFIG.rate;
      setTspRateStr(String(Math.round(rate * 100)));
      setLoaded(true);
    });
  }, [month]);

  const currentYos = user?.years_of_service ?? 0;
  const system = inferRetirementSystem(user?.joined_at ?? '');

  const inputs: BrsInputs = useMemo(
    () => ({
      basePay,
      tspRate: Math.min(1, Math.max(0, (parseFloat(tspRateStr) || 0) / 100)),
      currentYos,
      retirementYos: retYos,
      annualReturn: returnPct / 100,
      contPayMultiplier: contMult,
    }),
    [basePay, tspRateStr, currentYos, retYos, returnPct, contMult],
  );

  const r: BrsResult = useMemo(() => calcBrs(inputs), [inputs]);

  const grade = (user?.pay_grade ?? 'E-3') as PayGrade;
  const dodPct = Math.round(dodMatchRate(inputs.tspRate) * 100);
  const memberPct = Math.round(inputs.tspRate * 100);
  const totalTspPct = memberPct + dodPct;

  // Winner determination for pension
  const pensionWinner: 'legacy' | 'brs' | null =
    r.pensionShortfall > 0 ? 'legacy' : r.pensionShortfall < 0 ? 'brs' : null;

  // Winner for total wealth at retirement
  const wealthWinner: 'legacy' | 'brs' | null =
    r.brsWealthAtRetirement > r.legacyWealthAtRetirement
      ? 'brs'
      : r.brsWealthAtRetirement < r.legacyWealthAtRetirement
        ? 'legacy'
        : null;

  if (!user) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <h3 className={LABEL_CLS}>
          BRS vs Legacy High-3
        </h3>
        <SystemBadge system={system} />
      </div>

      {/* Parameters */}
      <div className="flex items-center gap-4 flex-wrap mb-5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-4">Retire at</span>
          <input
            type="number"
            min={Math.max(currentYos + 1, 10)}
            max={40}
            value={retYos}
            onChange={(e) =>
              setRetYos(
                Math.max(10, Math.min(40, parseInt(e.target.value) || 20)),
              )
            }
            className="w-14 text-xs font-mono bg-surface border border-border rounded-lg px-2 py-1 text-text text-center focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-[11px] text-text-4">YOS</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-4">TSP rate</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={tspRateStr}
            onChange={(e) => setTspRateStr(e.target.value)}
            className="w-14 text-xs font-mono bg-surface border border-border rounded-lg px-2 py-1 text-text text-center focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-[11px] text-text-4">%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-4">Return</span>
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={returnPct}
            onChange={(e) =>
              setReturnPct(
                Math.max(1, Math.min(12, parseFloat(e.target.value) || 6)),
              )
            }
            className="w-14 text-xs font-mono bg-surface border border-border rounded-lg px-2 py-1 text-text text-center focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-[11px] text-text-4">%/yr</span>
        </div>

        {currentYos < 12 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-4">Cont. pay</span>
            <input
              type="number"
              min={2.5}
              max={13}
              step={0.5}
              value={contMult}
              onChange={(e) =>
                setContMult(
                  Math.max(
                    2.5,
                    Math.min(13, parseFloat(e.target.value) || 2.5),
                  ),
                )
              }
              className="w-14 text-xs font-mono bg-surface border border-border rounded-lg px-2 py-1 text-text text-center focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="text-[11px] text-text-4">× base</span>
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-border overflow-hidden mb-4">
        {/* Column headers */}
        <div className="grid grid-cols-3 bg-surface-raised px-4 py-2 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-3 text-right">
            Legacy High-3
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4a8cff] text-right">
            BRS
          </span>
        </div>

        {/* Pension */}
        <CompRow
          label="Pension rate"
          legacy="2.5% / yr"
          brs="2.0% / yr"
          note="Applied to average of highest 36 months base pay"
        />
        <CompRow
          label={`Monthly pension at ${retYos} YOS`}
          legacy={formatCurrency(r.legacyPension)}
          brs={formatCurrency(r.brsPension)}
          note={`Based on current base pay ${formatCurrency(basePay)}/mo as proxy`}
          winner={pensionWinner}
        />

        {/* TSP */}
        <CompRow
          label="DoD TSP match"
          legacy="None"
          brs={`${dodPct}% of base = ${formatCurrency(r.dodMatchMonthly)}/mo`}
          note="1% auto + match up to 4% (requires ≥5% member contribution for full match)"
        />
        <CompRow
          label={`TSP balance at ${retYos} YOS`}
          legacy={fmtK(r.tspWithoutMatch)}
          brs={fmtK(r.tspWithMatch)}
          note={`${memberPct}% member + ${dodPct}% DoD = ${totalTspPct}% total monthly (BRS)`}
          winner={wealthWinner}
        />

        {/* Continuation pay */}
        {currentYos < 12 && (
          <CompRow
            label="Continuation pay (at 12 YOS)"
            legacy="—"
            brs={`${formatCurrency(r.contPayLumpSum)} lump sum → ${fmtK(r.contPayFvAtRetirement)} at retirement`}
            note={`${contMult}× base pay (min 2.5×; varies by branch/career field)`}
          />
        )}
        {currentYos >= 12 && (
          <CompRow
            label="Continuation pay"
            legacy="—"
            brs={currentYos >= 12 ? 'Past 12 YOS' : '—'}
            note="Paid at 12 YOS to BRS members who commit to 4 more years"
          />
        )}

        {/* Total wealth at retirement */}
        <CompRow
          label="Total portable wealth at retirement"
          legacy={fmtK(r.legacyWealthAtRetirement)}
          brs={fmtK(r.brsWealthAtRetirement)}
          note="TSP balance + continuation pay grown to retirement date"
          highlight
          winner={wealthWinner}
        />
      </div>

      {/* Break-even callout */}
      {r.breakEvenMonths !== null ? (
        <div className="rounded-xl border border-border-dim bg-surface-raised/30 px-4 py-3 mb-4 space-y-1">
          <p className="text-xs text-text">
            <span className="font-semibold text-[#4a8cff]">BRS</span> starts
            retirement with{' '}
            <span className="font-mono font-semibold">
              {fmtK(r.brsWealthAtRetirement - r.legacyWealthAtRetirement)}
            </span>{' '}
            more in portable wealth.{' '}
            <span className="font-semibold text-text-2">Legacy</span>'s higher
            pension (
            <span className="font-mono">{formatCurrency(r.pensionShortfall)}/mo</span>{' '}
            more) catches up after{' '}
            <span className="font-semibold text-text">
              {r.breakEvenYears} years
            </span>{' '}
            of retirement.
          </p>
          <p className="text-[11px] text-text-3">
            Retiring at {retYos} YOS at age ~
            {(user?.years_of_service ?? 0) < retYos ? 22 + retYos : '?'}: legacy
            surpasses BRS around age{' '}
            {r.breakEvenYears !== null
              ? Math.round(22 + retYos + r.breakEvenYears)
              : '?'}
            . Average military retiree life expectancy exceeds 80.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border-dim bg-surface-raised/30 px-4 py-3 mb-4">
          <p className="text-xs text-text">
            {r.brsWealthAtRetirement <= r.legacyWealthAtRetirement
              ? `Legacy provides more value in this scenario. Try increasing your TSP rate — the DoD match is free money.`
              : `BRS is ahead at retirement. Increase your TSP rate to maximize the DoD match (${memberPct < 5 ? `contribute at least 5% to get the full ${dodPct}% DoD match` : 'full match already applied'}).`}
          </p>
        </div>
      )}

      {/* DoD match value highlight (only meaningful for BRS members) */}
      {r.dodMatchTotalCareer > 0 &&
        (system === 'brs' || system === 'uncertain') && (
          <div className="rounded-xl border border-border-dim bg-blue-500/5 px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-text">
                Total DoD TSP contributions over career
              </p>
              <p className="text-[11px] text-text-3 mt-0.5">
                {formatCurrency(r.dodMatchMonthly)}/mo ×{' '}
                {Math.round((retYos - currentYos) * 12)} months, compounded to{' '}
                <span className="font-mono font-semibold text-[#4a8cff]">
                  {fmtK(r.tspWithMatch - r.tspWithoutMatch)}
                </span>{' '}
                at retirement
              </p>
            </div>
            <span className="font-mono text-base font-bold text-[#4a8cff] shrink-0 ml-4">
              {fmtK(r.dodMatchTotalCareer)}
            </span>
          </div>
        )}

      {/* TSP rate nudge */}
      {memberPct < 5 && memberPct >= 0 && system === 'brs' && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 mb-4">
          <p className="text-[11px] text-amber-400">
            ⚠ You're contributing {memberPct}% — increase to 5% to get the full
            DoD match ({Math.round(dodMatchRate(0.05) * 100)}% of base pay
            free). That's{' '}
            {formatCurrency(basePay * (dodMatchRate(0.05) - dodMatchRate(inputs.tspRate)))}{' '}
            more per month from DoD.
          </p>
        </div>
      )}

      {/* Assumptions + resources (collapsible) */}
      <div className="rounded-xl border border-border-dim bg-surface-raised/20 overflow-hidden">
        <button
          onClick={() => setShowAssumptions((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-raised/40 transition-colors"
        >
          <span className={LABEL_CLS}>
            Assumptions & resources
          </span>
          <span className="text-text-4 text-xs">
            {showAssumptions ? '▲' : '▼'}
          </span>
        </button>
        {showAssumptions && (
          <div className="px-4 pb-3 space-y-2 border-t border-border-dim">
            <ul className="text-[11px] text-text-3 space-y-0.5 pt-2">
              <li>
                · Estimates use your current base pay ({formatCurrency(basePay)}/mo) as a
                proxy for the High-3 average. Actual retirement pay will be
                higher due to promotions.
              </li>
              <li>
                · Both scenarios assume the same member TSP contribution rate (
                {memberPct}%).
              </li>
              <li>
                · Continuation pay figures assume active duty minimum (2.5×);
                check your branch for current multipliers.
              </li>
              <li>
                · Investment return of {returnPct}% is not guaranteed — TSP L
                Fund historical returns have ranged 4–9%.
              </li>
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border-dim">
              <ExternalLink
                href="https://militarypay.defense.gov/Pay/Retirement/BRS/"
                label="BRS overview"
              />
              <ExternalLink
                href="https://www.tsp.gov/changes-in-your-career/preparing-for-active-duty-or-tdy/"
                label="TSP for service members"
              />
              <ExternalLink
                href="https://www.militaryonesource.mil/financial-legal/personal-finance/saving-investing/blended-retirement-system/"
                label="MilOneSource BRS guide"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
