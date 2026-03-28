'use client';

import {
  MALT_RATE_PER_MILE,
  PRO_GEAR_LBS,
  TLE_DAILY_RATE,
  TLE_MAX_DAYS,
  getWeightAllowanceLbs,
} from '@/lib/pcs-data';
import { getBAH, isOfficer } from '@/lib/pay-tables';
import { useMemo, useState } from 'react';

import DutyStationSelect from './DutyStationSelect';
import ExternalLink from './ExternalLink';
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

  const [fromStation, setFromStation] = useState(user?.duty_station ?? '');
  const [toStation, setToStation] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [driving, setDriving] = useState(true);
  const [tleDays, setTleDays] = useState(String(TLE_MAX_DAYS));
  const [showRef, setShowRef] = useState(false);

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
    };
  }, [fromStation, toStation, grade, hasDeps, tleDays, distanceMiles, driving]);

  const ready = fromStation && toStation;

  return (
    <div className="space-y-6">
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
    </div>
  );
}
