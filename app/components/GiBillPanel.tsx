'use client';

import { useMemo, useState } from 'react';

import { INPUT_CLS, LABEL_CLS } from '@/lib/config';
import { getBAH } from '@/lib/pay-tables';
import { formatCurrency } from '@/lib/utils';

import DutyStationSelect from './DutyStationSelect';
import ExternalLink from './ExternalLink';

// Post-9/11 GI Bill (Chapter 33) — 2026
const MAX_MONTHS = 36; // total entitlement
const BOOK_STIPEND_ANNUAL = 1_000; // prorated by enrollment rate

// Service length → benefit percentage (36+ months active duty = 100%)
const SERVICE_TIERS: { months: number; pct: number; label: string }[] = [
  { months: 36, pct: 1.0, label: '36+ months — 100%' },
  { months: 30, pct: 0.9, label: '30–35 months — 90%' },
  { months: 24, pct: 0.8, label: '24–29 months — 80%' },
  { months: 18, pct: 0.7, label: '18–23 months — 70%' },
  { months: 12, pct: 0.6, label: '12–17 months — 60%' },
  { months: 6, pct: 0.5, label: '6–11 months — 50%' },
  { months: 3, pct: 0.4, label: '90 days–5 months — 40%' },
];

function getServicePct(activeMonths: number): { pct: number; label: string } {
  const tier = SERVICE_TIERS.find((t) => activeMonths >= t.months);
  return tier ?? { pct: 0, label: 'Under 90 days — not eligible' };
}

interface Props {
  /** User's years of service (from profile) — pre-fills the service length */
  yearsOfService: number;
}

export default function GiBillPanel({ yearsOfService }: Props) {
  const [activeMonths, setActiveMonths] = useState(String(yearsOfService * 12));
  const [usedMonths, setUsedMonths] = useState('0');
  const [schoolStation, setSchoolStation] = useState('');
  const [customMha, setCustomMha] = useState('');
  const [fullTime, setFullTime] = useState(true);

  const calc = useMemo(() => {
    const active = parseInt(activeMonths) || 0;
    const used = Math.min(parseInt(usedMonths) || 0, MAX_MONTHS);
    const remaining = Math.max(0, MAX_MONTHS - used);

    const { pct, label } = getServicePct(active);

    // MHA: E-5 with dependents BAH at school location
    const rawBah = schoolStation ? getBAH(schoolStation, 'E-5', true) : 0;
    const mhaBase = parseFloat(customMha) || rawBah;
    const mha = Math.round(mhaBase * pct * (fullTime ? 1 : 0.5));

    const bookMonthly = Math.round((BOOK_STIPEND_ANNUAL * pct) / 12);
    const totalMonthlyValue = mha + bookMonthly;
    const remainingValue = totalMonthlyValue * remaining;

    return {
      pct,
      label,
      used,
      remaining,
      mha,
      bookMonthly,
      totalMonthlyValue,
      remainingValue,
      mhaBase,
    };
  }, [activeMonths, usedMonths, schoolStation, customMha, fullTime]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Post-9/11 GI Bill (Ch. 33)</h3>
      </div>
      <p className="text-text-3 mb-4 text-[11px] leading-relaxed">
        Up to {MAX_MONTHS} months of education benefits. Covers tuition, a monthly housing allowance
        (MHA), and a book stipend. MHA is based on E-5 with dependents BAH at the school&apos;s
        location.
      </p>

      <div className="bg-surface-raised/40 border-border mb-4 space-y-4 rounded-xl border p-4">
        <p className={LABEL_CLS}>Your situation</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-text-3 text-xs">Active duty service (months)</label>
            <input
              type="number"
              value={activeMonths}
              onChange={(e) => setActiveMonths(e.target.value)}
              min={0}
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-xs">Months of GI Bill already used</label>
            <input
              type="number"
              value={usedMonths}
              onChange={(e) => setUsedMonths(e.target.value)}
              min={0}
              max={MAX_MONTHS}
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-text-3 text-xs">
            School location (for MHA lookup — pick nearest installation)
          </label>
          <DutyStationSelect value={schoolStation} onChange={setSchoolStation} />
        </div>

        {schoolStation && calc.mhaBase > 0 && (
          <p className="text-text-3 text-[11px]">
            E-5 w/ dependents BAH at {schoolStation}:{' '}
            <span className="text-text font-mono">{formatCurrency(calc.mhaBase)}/mo</span> (used as
            MHA base)
          </p>
        )}

        {!schoolStation && (
          <div className="space-y-1">
            <label className="text-text-3 text-xs">Or enter MHA manually ($/mo at 100%)</label>
            <input
              type="number"
              value={customMha}
              onChange={(e) => setCustomMha(e.target.value)}
              placeholder="e.g. 1800"
              className={`w-48 ${INPUT_CLS}`}
            />
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={fullTime}
            onChange={(e) => setFullTime(e.target.checked)}
            className="rounded"
          />
          <span className="text-text-2 text-sm">Full-time enrollment</span>
          <span className="text-text-4 text-[11px]">(half-time = 50% MHA)</span>
        </label>
      </div>

      {/* Eligibility badge */}
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            calc.pct >= 1
              ? 'bg-emerald-500/10 text-emerald-400'
              : calc.pct > 0
                ? 'bg-blue-500/10 text-[#4a8cff]'
                : 'bg-surface-raised text-text-3'
          }`}
        >
          {calc.label}
        </span>
        {calc.remaining < MAX_MONTHS && calc.remaining > 0 && (
          <span className="text-text-3 text-[11px]">
            {calc.remaining} of {MAX_MONTHS} months remaining
          </span>
        )}
      </div>

      {/* Entitlement bar */}
      {calc.remaining > 0 && (
        <div className="mb-4">
          <div className="text-text-4 mb-1 flex justify-between text-[11px]">
            <span>Used: {calc.used} mo</span>
            <span>Remaining: {calc.remaining} mo</span>
          </div>
          <div className="bg-surface-raised h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4a8cff] to-[#00d98a] transition-all"
              style={{ width: `${(calc.remaining / MAX_MONTHS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Monthly benefit breakdown */}
      {calc.pct > 0 && (
        <div className="space-y-1">
          <p className={`${LABEL_CLS} mb-2`}>Estimated monthly benefit</p>
          {[
            {
              label: `MHA (${Math.round(calc.pct * 100)}% of E-5 w/ deps BAH${!fullTime ? ', half-time' : ''})`,
              value: calc.mha,
              color: 'text-[#4a8cff]',
            },
            {
              label: `Book stipend (${formatCurrency(BOOK_STIPEND_ANNUAL * calc.pct)}/yr prorated)`,
              value: calc.bookMonthly,
              color: 'text-text-2',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="border-border-dim flex justify-between border-b py-2 text-xs"
            >
              <span className="text-text-3">{label}</span>
              <span className={`font-mono ${color}`}>{formatCurrency(value)}/mo</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-sm font-semibold">
            <span className="text-text">Total monthly cash benefit</span>
            <span className="font-mono text-[#00d98a]">
              {formatCurrency(calc.totalMonthlyValue)}/mo
            </span>
          </div>
          {calc.remaining > 0 && (
            <p className="text-text-3 pt-1 text-[11px]">
              Remaining entitlement value:{' '}
              <span className="text-text font-mono">≈ {formatCurrency(calc.remainingValue)}</span>{' '}
              over {calc.remaining} months (MHA + stipend, excludes tuition)
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-[11px]">
        <ExternalLink
          href="https://www.va.gov/education/about-gi-bill-benefits/post-9-11/"
          label="Post-9/11 GI Bill — va.gov"
        />
        <ExternalLink
          href="https://www.va.gov/education/gi-bill-comparison-tool/"
          label="GI Bill comparison tool"
        />
      </div>
    </div>
  );
}
