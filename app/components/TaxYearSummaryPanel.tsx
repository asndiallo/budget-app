'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { LABEL_CLS } from '@/lib/config';
import type { TaxYearSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

function Row({
  label,
  value,
  sub,
  valueColor = 'text-text',
  indent = false,
  bold = false,
}: {
  label: string;
  value: number;
  sub?: string;
  valueColor?: string;
  indent?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`border-border-dim flex items-baseline justify-between border-b py-2 ${indent ? 'pl-4' : ''}`}
    >
      <div className="min-w-0 flex-1 pr-4">
        <span className={`text-sm ${bold ? 'text-text font-semibold' : 'text-text-2'}`}>
          {label}
        </span>
        {sub && <span className="text-text-4 ml-2 text-[10px]">{sub}</span>}
      </div>
      <span className={`shrink-0 font-mono text-sm ${bold ? 'font-semibold' : ''} ${valueColor}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`${LABEL_CLS} mb-1`}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export default function TaxYearSummaryPanel({ year }: { year: number }) {
  const [data, setData] = useState<TaxYearSummary | null>(null);

  useEffect(() => {
    api.taxYearSummary.get(year).then(setData);
  }, [year]);

  if (!data) return <p className="text-text-3 py-4 text-sm">Loading…</p>;
  if (data.monthsWithData === 0) {
    return (
      <p className="text-text-3 py-4 text-sm">
        No income data found for {year}. Navigate to a month within {year} in the Pay tab to
        populate data.
      </p>
    );
  }

  const pctOfGross = (n: number) =>
    data.grossTotal > 0 ? `${Math.round((n / data.grossTotal) * 100)}% of gross` : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-text-3 text-xs">
            {data.monthsWithData} month{data.monthsWithData !== 1 ? 's' : ''} of data
            {data.combatZoneMonths > 0 && (
              <span className="ml-2 font-medium text-amber-400">
                · {data.combatZoneMonths} combat zone month{data.combatZoneMonths !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-text-4 text-[10px] tracking-widest uppercase">
            Estimated taxable income
          </p>
          <p className="text-text font-mono text-lg font-bold">
            {formatCurrency(data.estimatedTaxableIncome)}
          </p>
        </div>
      </div>

      {/* Gross income */}
      <Section title="Gross income">
        <Row label="Base military pay" value={data.grossMilitaryPay} />
        {data.specialPays > 0 && (
          <Row
            label="Special & incentive pays"
            value={data.specialPays}
            sub="flight, IDP, jump, SDAP, SRB…"
          />
        )}
        <Row
          label="Allowances"
          value={data.allowances}
          sub="BAS + BAH — non-taxable"
          valueColor="text-text-3"
        />
        <Row label="Total gross" value={data.grossTotal} bold />
      </Section>

      {/* Pre-tax deductions */}
      <Section title="Pre-tax deductions">
        {data.sgli > 0 && <Row label="SGLI" value={data.sgli} />}
        {data.afrh > 0 && <Row label="AFRH" value={data.afrh} />}
        {data.mealDeductions > 0 && <Row label="Meal deduction" value={data.mealDeductions} />}
        {data.combatZoneExclusion > 0 && (
          <Row
            label="Combat zone exclusion"
            value={data.combatZoneExclusion}
            sub="enlisted base pay excluded"
            valueColor="text-amber-400"
          />
        )}
        {data.totalPreTaxDeductions + data.combatZoneExclusion > 0 ? (
          <Row
            label="Total deductions"
            value={data.totalPreTaxDeductions + data.combatZoneExclusion}
            bold
            valueColor="text-[#ff4560]"
          />
        ) : (
          <p className="text-text-4 py-2 text-[11px]">
            No pre-tax deductions — Roth TSP contributions are post-tax (see Post-tax savings
            below).
          </p>
        )}
      </Section>

      {/* Taxable income + taxes */}
      <Section title="Taxes withheld">
        <Row
          label="Estimated taxable income"
          value={data.estimatedTaxableIncome}
          sub="base + special pays − pre-tax deductions − combat exclusion (Roth TSP not subtracted)"
          bold
        />
        <Row
          label="Federal income tax withheld"
          value={data.federalTaxWithheld}
          sub={`effective rate: ${(data.effectiveFederalRate * 100).toFixed(1)}%`}
          valueColor="text-[#ff4560]"
        />
        <Row
          label="FICA — Social Security"
          value={data.ficaSocialSecurity}
          valueColor="text-[#ff4560]"
        />
        <Row label="FICA — Medicare" value={data.ficaMedicare} valueColor="text-[#ff4560]" />
        <Row
          label="Total taxes withheld"
          value={data.totalTaxesWithheld}
          bold
          valueColor="text-[#ff4560]"
        />
      </Section>

      {/* Tax efficiency summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Total tax burden',
            value: `${data.grossTotal > 0 ? Math.round((data.totalTaxesWithheld / data.grossTotal) * 100) : 0}%`,
            sub: 'of gross',
            color: 'text-[#ff4560]',
          },
          {
            label: 'Effective fed rate',
            value: `${(data.effectiveFederalRate * 100).toFixed(1)}%`,
            sub: 'on taxable income',
            color: 'text-text',
          },
          {
            label: 'Roth TSP',
            value: pctOfGross(data.rothTspContributions),
            sub: formatCurrency(data.rothTspContributions),
            color: 'text-[#4a8cff]',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-bg border-border rounded-xl border p-3.5">
            <p className={`${LABEL_CLS} mb-1.5`}>{label}</p>
            <p className={`font-mono text-base font-semibold ${color}`}>{value}</p>
            {sub && <p className="text-text-4 mt-0.5 text-[10px]">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Post-tax savings */}
      {data.totalPostTaxSavings > 0 && (
        <Section title="Post-tax savings (Roth)">
          {data.rothTspContributions > 0 && (
            <Row
              label="Roth TSP contributions"
              value={data.rothTspContributions}
              sub="post-tax — does not reduce taxable income, grows tax-free"
              valueColor="text-[#4a8cff]"
            />
          )}
          {data.rothIraContributions > 0 && (
            <Row
              label="Roth IRA contributions"
              value={data.rothIraContributions}
              sub="post-tax — not deductible, grows tax-free"
              valueColor="text-[#b085f5]"
            />
          )}
          <Row
            label="Total Roth contributions"
            value={data.totalPostTaxSavings}
            bold
            valueColor="text-[#00d98a]"
          />
        </Section>
      )}

      {/* Disclaimer */}
      <p className="text-text-4 border-border-dim border-t pt-3 text-[10px] leading-relaxed">
        This summary is an estimate based on your income entries and is not tax advice. BAH and BAS
        are excluded from taxable income per 26 U.S.C. §134. Roth TSP contributions are post-tax and
        do not reduce taxable income. Combat zone base pay exclusion applies to enlisted members
        (officers capped at $10,000/mo). Consult a tax professional or use your official W-2 / LES
        for filing.
      </p>
    </div>
  );
}
