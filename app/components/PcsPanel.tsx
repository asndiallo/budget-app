'use client';

import {
  MALT_RATE_PER_MILE,
  PPM_INCENTIVE_FACTOR,
  PPM_RATE_PER_LB_MILE,
  PRO_GEAR_LBS,
  TLE_DAILY_RATE,
  TLE_MAX_DAYS,
  getWeightAllowanceLbs,
} from '@/lib/pcs-data';
import { getBAH, isOfficer } from '@/lib/pay-tables';
import { useMemo, useState } from 'react';

import DutyStationSelect from './DutyStationSelect';
import ExternalLink from './ExternalLink';
import SubNav from './SubNav';
import type { PayGrade } from '@/lib/pay-tables';
import type { UserProfile } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { INPUT_CLS, LABEL_CLS } from '@/lib/config';

interface Props {
  user: UserProfile | null;
}

function EntitlementRow({
  label,
  amount,
  note,
  sub,
}: {
  label: string;
  amount: number | null;
  note: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start py-3 border-b border-border-dim gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text">{label}</p>
        <p className="text-[11px] text-text-3 mt-0.5">{note}</p>
        {sub && <p className="text-[11px] text-text-4 mt-0.5">{sub}</p>}
      </div>
      <span className="font-mono text-sm text-text shrink-0">
        {amount === null ? '—' : formatCurrency(amount)}
      </span>
    </div>
  );
}

export default function PcsPanel({ user }: Props) {
  const grade = (user?.pay_grade ?? 'E-3') as PayGrade;
  const hasDeps = (user?.dependents ?? 0) > 0;

  const [sub, setSub] = useState<'move' | 'va'>('move');
  const [fromStation, setFromStation] = useState(user?.duty_station ?? '');
  const [toStation, setToStation] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [driving, setDriving] = useState(true);
  const [tleDays, setTleDays] = useState(String(TLE_MAX_DAYS));
  const [showRef, setShowRef] = useState(false);

  // PPM state
  const [ppmMode, setPpmMode] = useState<'gov' | 'ppm'>('gov');
  const [ppmWeightOverride, setPpmWeightOverride] = useState('');

  const results = useMemo(() => {
    const bahFrom = fromStation ? getBAH(fromStation, grade, hasDeps) : 0;
    const bahTo = toStation ? getBAH(toStation, grade, hasDeps) : 0;

    // DLA = BAH at higher station (old or new), member's dependent status
    const dlaBase = Math.max(bahFrom, bahTo);
    const dla = dlaBase > 0 ? dlaBase : null;

    // Weight allowance
    const hhgLbs = getWeightAllowanceLbs(grade, hasDeps);
    const proGearMember = PRO_GEAR_LBS.member;
    const proGearSpouse = hasDeps ? PRO_GEAR_LBS.spouse : 0;

    // TLE
    const days = Math.min(Math.max(parseInt(tleDays) || 0, 0), TLE_MAX_DAYS);
    const dailyRate = hasDeps
      ? TLE_DAILY_RATE.withDependents
      : TLE_DAILY_RATE.withoutDependents;
    const tle = days * dailyRate;

    // MALT
    const miles = parseFloat(distanceMiles) || 0;
    const vehicles = driving ? (hasDeps ? 2 : 1) : 0;
    const malt =
      driving && miles > 0 ? miles * MALT_RATE_PER_MILE * vehicles : null;

    // PPM — 95 % of DoD's estimated transportation cost
    const ppmWeight =
      parseFloat(ppmWeightOverride) > 0
        ? parseFloat(ppmWeightOverride)
        : hhgLbs;
    const gtc = ppmWeight * miles * PPM_RATE_PER_LB_MILE;
    const ppmIncentive = miles > 0 ? Math.round(gtc * PPM_INCENTIVE_FACTOR) : null;

    const total = (dla ?? 0) + tle + (malt ?? 0);

    return {
      dla,
      hhgLbs,
      proGearMember,
      proGearSpouse,
      tle,
      malt,
      total,
      dlaBase,
      dailyRate,
      days,
      miles,
      vehicles,
      ppmWeight,
      gtc,
      ppmIncentive,
    };
  }, [fromStation, toStation, grade, hasDeps, tleDays, distanceMiles, driving, ppmWeightOverride]);

  const ready = fromStation && toStation;
  const currentBah = fromStation ? getBAH(fromStation, grade, hasDeps) : 0;

  return (
    <div className="space-y-4">
      <SubNav
        options={[
          { key: 'move', label: 'Move planner' },
          { key: 'va', label: 'VA Loan' },
        ]}
        active={sub}
        onChange={(k) => setSub(k as typeof sub)}
      />

      {sub === 'va' && <VaLoanPanel bah={currentBah} grade={grade} component={user?.component ?? 'Active'} />}

      {sub === 'move' && <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className={`${LABEL_CLS} mb-1`}>
          PCS Move Planner
        </h3>
        <p className="text-xs text-text-3">
          Estimates your entitlements based on your profile ({grade},{' '}
          {hasDeps ? 'with dependents' : 'no dependents'}). Verify all values at{' '}
          <a
            href="https://my.move.mil"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4a8cff] hover:underline"
          >
            my.move.mil
          </a>{' '}
          before your move.
        </p>
      </div>

      {/* Inputs */}
      <div className="bg-surface-raised/40 rounded-xl border border-border p-4 space-y-4">
        <p className={LABEL_CLS}>
          Move details
        </p>

        <div className="space-y-1">
          <label className="text-xs text-text-3">Losing duty station</label>
          <DutyStationSelect value={fromStation} onChange={setFromStation} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-3">Gaining duty station</label>
          <DutyStationSelect value={toStation} onChange={setToStation} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-text-3">
              Distance (miles, one-way)
            </label>
            <input
              type="number"
              value={distanceMiles}
              onChange={(e) => setDistanceMiles(e.target.value)}
              placeholder="e.g. 1200"
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">
              TLE nights claimed (max {TLE_MAX_DAYS})
            </label>
            <input
              type="number"
              min={0}
              max={TLE_MAX_DAYS}
              value={tleDays}
              onChange={(e) => setTleDays(e.target.value)}
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={driving}
            onChange={(e) => setDriving(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-text-2">
            Driving POV (
            {hasDeps ? '2 vehicles authorized' : '1 vehicle authorized'})
          </span>
        </label>
      </div>

      {/* Results */}
      {ready ? (
        <div>
          <p className={`${LABEL_CLS} mb-3`}>
            Estimated entitlements
          </p>

          <EntitlementRow
            label="DLA — Dislocation Allowance"
            amount={results.dla}
            note={`BAH at higher station (${fromStation || '?'} vs ${toStation || '?'})`}
            sub={
              results.dlaBase === 0
                ? 'Enter both stations to calculate'
                : undefined
            }
          />

          <div className="py-3 border-b border-border-dim">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm text-text">Weight allowance</p>
                <p className="text-[11px] text-text-3 mt-0.5">
                  HHG: {results.hhgLbs.toLocaleString()} lbs + pro-gear:{' '}
                  {(
                    results.proGearMember + results.proGearSpouse
                  ).toLocaleString()}{' '}
                  lbs ={' '}
                  {(
                    results.hhgLbs +
                    results.proGearMember +
                    results.proGearSpouse
                  ).toLocaleString()}{' '}
                  lbs total
                </p>
                <p className="text-[11px] text-text-4 mt-0.5">
                  {isOfficer(grade) ? 'Officer' : 'Enlisted'} {grade},{' '}
                  {hasDeps ? 'with dependents' : 'without dependents'}
                  {hasDeps
                    ? ` · spouse pro-gear: ${results.proGearSpouse.toLocaleString()} lbs`
                    : ''}
                </p>
              </div>
              <span className="font-mono text-sm text-text-3 shrink-0">
                non-cash
              </span>
            </div>
          </div>

          <EntitlementRow
            label="TLE — Temporary Lodging Expense"
            amount={results.tle}
            note={`${formatCurrency(results.dailyRate)}/night × ${results.days} night${results.days !== 1 ? 's' : ''} (max ${TLE_MAX_DAYS})`}
            sub="Actual reimbursement requires receipts"
          />

          {driving && (
            <EntitlementRow
              label="MALT — Mileage Allowance"
              amount={results.malt}
              note={
                results.miles > 0
                  ? `${results.miles.toLocaleString()} mi × $${MALT_RATE_PER_MILE}/mi × ${results.vehicles} POV${results.vehicles !== 1 ? 's' : ''}`
                  : 'Enter distance to calculate'
              }
            />
          )}

          <div className="flex items-center justify-between pt-4 mt-1">
            <span className="text-sm font-medium text-text">
              Estimated cash entitlements
            </span>
            <span className="font-mono text-base font-semibold text-[#00d98a]">
              {formatCurrency(results.total)}
            </span>
          </div>
          <p className="text-[11px] text-text-4 mt-1">
            Excludes weight shipment (government pays directly) and any advance
            pay.
          </p>

          {/* PPM/DITY section */}
          <div className="mt-4 pt-4 border-t border-border-dim">
            <div className="flex items-center justify-between mb-3">
              <p className={LABEL_CLS}>PPM / DITY move option</p>
              <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
                {(['gov', 'ppm'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPpmMode(m)}
                    className={`px-3 py-1 transition-colors ${
                      ppmMode === m
                        ? 'bg-surface-blue text-[#4a8cff]'
                        : 'text-text-3 hover:text-text-2'
                    }`}
                  >
                    {m === 'gov' ? "Gov\u2019t move" : 'PPM move'}
                  </button>
                ))}
              </div>
            </div>

            {ppmMode === 'gov' ? (
              <p className="text-[11px] text-text-3 leading-relaxed">
                Government-arranged move: DoD books and pays the carrier
                directly. You pay nothing for the weight shipment but cannot
                pocket any cost difference.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-text-3 leading-relaxed">
                  Personally Procured Move: you rent a truck, hire movers, or
                  use a POD and receive <strong className="text-text-2">95 % of what DoD would have
                  paid</strong> to ship your weight.
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-text-3">
                    Actual weight to move (lbs) — leave blank to use your
                    entitlement ({results.hhgLbs.toLocaleString()} lbs)
                  </label>
                  <input
                    type="number"
                    value={ppmWeightOverride}
                    onChange={(e) => setPpmWeightOverride(e.target.value)}
                    placeholder={String(results.hhgLbs)}
                    className={`w-40 ${INPUT_CLS}`}
                  />
                </div>
                {results.ppmIncentive !== null ? (
                  <div className="rounded-xl border border-border bg-surface-raised/30 p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-3">Weight moved</span>
                      <span className="font-mono text-text">
                        {results.ppmWeight.toLocaleString()} lbs
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-3">Distance</span>
                      <span className="font-mono text-text">
                        {results.miles.toLocaleString()} mi
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-3">DoD est. cost (GTC)</span>
                      <span className="font-mono text-text">
                        {formatCurrency(results.gtc)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-border-dim pt-2">
                      <span className="font-medium text-text">
                        PPM incentive (95 % of GTC)
                      </span>
                      <span className="font-mono font-semibold text-[#00d98a]">
                        {formatCurrency(results.ppmIncentive)}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-4 pt-1">
                      Estimate only — actual rate set by DoD/TRANSCOM regional
                      table. Verify at{' '}
                      <ExternalLink href="https://move.mil" label="move.mil" />.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-text-3">
                    Enter distance above to calculate PPM incentive.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border-dim bg-surface-raised/20 px-4 py-8 text-center">
          <p className="text-sm text-text-3">
            Select both duty stations to see your entitlements.
          </p>
        </div>
      )}

      {/* Reference info (collapsible) */}
      <div className="rounded-xl border border-border-dim bg-surface-raised/20 overflow-hidden">
        <button
          onClick={() => setShowRef((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-raised/40 transition-colors"
        >
          <span className={LABEL_CLS}>
            Quick reference
          </span>
          <span className="text-text-4 text-xs">{showRef ? '▲' : '▼'}</span>
        </button>
        {showRef && (
          <div className="px-4 pb-3 space-y-2 border-t border-border-dim">
            <ul className="text-[11px] text-text-3 space-y-1 list-none pt-2">
              <li>
                · DLA = BAH at higher station (old vs. new), your grade and
                dependent status —{' '}
                <ExternalLink
                  href="https://www.travel.dod.mil/Policy-Regulations/Joint-Travel-Regulations/"
                  label="JTR §5952"
                />
              </li>
              <li>
                · Weight allowance per JTR Appendix A. Pro-gear is separate and
                not counted against HHG limit.
              </li>
              <li>
                · TLE: up to 5 nights at losing PDS + 5 at gaining PDS. Requires
                lodging receipts.
              </li>
              <li>
                · MALT rate: ${MALT_RATE_PER_MILE}/mile per POV. Up to{' '}
                {hasDeps ? '2 POVs' : '1 POV'} authorized.
              </li>
              <li>
                · BAH data reflects 2026 DoD rates —{' '}
                <ExternalLink
                  href="https://www.travel.dod.mil/Allowances/Basic-Allowance-for-Housing/BAH-Rate-Lookup/"
                  label="official BAH calculator"
                />
              </li>
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border-dim">
              <ExternalLink
                href="https://move.mil"
                label="move.mil — book your move"
              />
              <ExternalLink
                href="https://www.travel.dod.mil/Policy-Regulations/Joint-Travel-Regulations/"
                label="Joint Travel Regulations"
              />
              <ExternalLink
                href="https://www.militaryonesource.mil/moving-housing/moving/"
                label="MilOneSource moving guide"
              />
              <ExternalLink
                href="https://www.militaryonesource.mil/financial-legal/personal-finance/"
                label="MilOneSource finances"
              />
            </div>
          </div>
        )}
      </div>
    </div>}
    </div>
  );
}

// ── VA Loan Calculator ────────────────────────────────────────────────────────

interface VaLoanProps {
  bah: number;
  grade: PayGrade;
  component: string;
}

function VaLoanPanel({ bah, grade, component }: VaLoanProps) {
  const [homePrice, setHomePrice] = useState('');
  const [downPct, setDownPct] = useState('0');
  const [rate, setRate] = useState('6.5');
  const [term, setTerm] = useState<30 | 15>(30);
  const [propTaxYear, setPropTaxYear] = useState('');
  const [hoiYear, setHoiYear] = useState('');
  const [firstUse, setFirstUse] = useState(true);

  const calc = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    if (price <= 0) return null;

    const downFrac = (parseFloat(downPct) || 0) / 100;
    const downAmt = Math.round(price * downFrac);
    const loanAmt = price - downAmt;

    // VA funding fee (2026 rates)
    // First use, no down payment: 2.15% regular military, 2.3% Reserve/Guard
    // Subsequent use: 3.3%
    // ≥ 5% down: 1.5%; ≥ 10% down: 1.25%
    const isReserve = component === 'Reserve' || component === 'Guard';
    let fundingFeePct = 0;
    if (downFrac >= 0.1) {
      fundingFeePct = 0.0125;
    } else if (downFrac >= 0.05) {
      fundingFeePct = 0.015;
    } else if (firstUse) {
      fundingFeePct = isReserve ? 0.023 : 0.0215;
    } else {
      fundingFeePct = 0.033;
    }
    const fundingFee = Math.round(loanAmt * fundingFeePct);
    const totalLoan = loanAmt + fundingFee; // fee rolled into loan

    // Monthly P&I
    const monthlyRate = parseFloat(rate) / 100 / 12;
    const n = term * 12;
    const pi =
      monthlyRate > 0
        ? Math.round(
            (totalLoan * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
              (Math.pow(1 + monthlyRate, n) - 1),
          )
        : Math.round(totalLoan / n);

    const propTaxMo = Math.round((parseFloat(propTaxYear) || 0) / 12);
    const hoiMo = Math.round((parseFloat(hoiYear) || 0) / 12);
    const total = pi + propTaxMo + hoiMo;
    const vsBAH = bah > 0 ? total - bah : null;

    return {
      price,
      downAmt,
      loanAmt,
      fundingFee,
      fundingFeePct,
      totalLoan,
      pi,
      propTaxMo,
      hoiMo,
      total,
      vsBAH,
    };
  }, [homePrice, downPct, rate, term, propTaxYear, hoiYear, firstUse, bah, component]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`${LABEL_CLS} mb-1`}>VA Loan Calculator</h3>
        <p className="text-xs text-text-3">
          VA-guaranteed loans require no PMI and no minimum down payment. Verify
          your entitlement at{' '}
          <ExternalLink href="https://www.va.gov/housing-assistance/home-loans/" label="va.gov" />.
        </p>
      </div>

      <div className="bg-surface-raised/40 rounded-xl border border-border p-4 space-y-4">
        <p className={LABEL_CLS}>Loan details</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-text-3">Home price ($)</label>
            <input
              type="number"
              value={homePrice}
              onChange={(e) => setHomePrice(e.target.value)}
              placeholder="e.g. 350000"
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">Down payment (%)</label>
            <input
              type="number"
              value={downPct}
              min={0}
              max={100}
              onChange={(e) => setDownPct(e.target.value)}
              placeholder="0"
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">Interest rate (%)</label>
            <input
              type="number"
              value={rate}
              step={0.125}
              onChange={(e) => setRate(e.target.value)}
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">Loan term</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {([30, 15] as const).map((y) => (
                <button
                  key={y}
                  onClick={() => setTerm(y)}
                  className={`flex-1 py-1.5 transition-colors ${
                    term === y
                      ? 'bg-surface-blue text-[#4a8cff]'
                      : 'text-text-3 hover:text-text-2 bg-bg'
                  }`}
                >
                  {y} yr
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">Property tax ($/yr)</label>
            <input
              type="number"
              value={propTaxYear}
              onChange={(e) => setPropTaxYear(e.target.value)}
              placeholder="e.g. 3600"
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-3">
              Homeowner&apos;s insurance ($/yr)
            </label>
            <input
              type="number"
              value={hoiYear}
              onChange={(e) => setHoiYear(e.target.value)}
              placeholder="e.g. 1200"
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={firstUse}
            onChange={(e) => setFirstUse(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-text-2">First-time VA loan use</span>
          <span className="text-[11px] text-text-4">
            (affects funding fee rate)
          </span>
        </label>
      </div>

      {calc ? (
        <div className="space-y-1">
          <p className={`${LABEL_CLS} mb-3`}>Estimated monthly cost</p>

          {[
            {
              label: 'Principal & interest',
              value: calc.pi,
              note: `${term}-yr fixed @ ${rate}% on ${formatCurrency(calc.totalLoan)} loan`,
            },
            {
              label: 'Property taxes',
              value: calc.propTaxMo,
              note: 'Based on annual amount entered',
            },
            {
              label: "Homeowner's insurance",
              value: calc.hoiMo,
              note: 'Based on annual amount entered',
            },
          ].map(({ label, value, note }) => (
            <div
              key={label}
              className="flex items-start py-2.5 border-b border-border-dim gap-4"
            >
              <div className="flex-1">
                <p className="text-sm text-text">{label}</p>
                {note && (
                  <p className="text-[11px] text-text-3 mt-0.5">{note}</p>
                )}
              </div>
              <span className="font-mono text-sm text-text shrink-0">
                {formatCurrency(value)}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between pt-3">
            <span className="text-sm font-semibold text-text">
              Total monthly (PITI)
            </span>
            <span className="font-mono text-base font-semibold text-text">
              {formatCurrency(calc.total)}
            </span>
          </div>

          {calc.vsBAH !== null && bah > 0 && (
            <div
              className={`mt-3 rounded-xl border px-4 py-3 ${
                calc.vsBAH <= 0
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <p
                className={`text-xs font-semibold ${calc.vsBAH <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {calc.vsBAH <= 0
                  ? `BAH covers full payment + ${formatCurrency(Math.abs(calc.vsBAH))}/mo surplus`
                  : `${formatCurrency(calc.vsBAH)}/mo out-of-pocket above BAH`}
              </p>
              <p className="text-[11px] text-text-4 mt-0.5">
                Current BAH: {formatCurrency(bah)}/mo
              </p>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-border-dim bg-surface-raised/20 px-4 py-3 space-y-1">
            <p className={LABEL_CLS}>VA funding fee</p>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-text-3">
                Rate ({(calc.fundingFeePct * 100).toFixed(2)}%
                {firstUse ? ' first use' : ' subsequent use'},{' '}
                {parseFloat(downPct) === 0 ? 'no down payment' : `${downPct}% down`})
              </span>
              <span className="font-mono text-text">
                {formatCurrency(calc.fundingFee)}
              </span>
            </div>
            <p className="text-[10px] text-text-4">
              Rolled into loan. Exempt if receiving VA disability ≥ 10 %.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border-dim bg-surface-raised/20 px-4 py-8 text-center">
          <p className="text-sm text-text-3">Enter a home price to calculate.</p>
        </div>
      )}
    </div>
  );
}
