'use client';

import { useMemo, useState } from 'react';

import { INPUT_CLS, LABEL_CLS } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

import ExternalLink from './ExternalLink';

// SDP constants
const SDP_MAX_DEPOSIT = 10_000;
const SDP_ANNUAL_RATE = 0.1; // 10% guaranteed
const SDP_QUARTERLY_RATE = SDP_ANNUAL_RATE / 4;
// Interest continues for 90 days (≈ 3 months) after leaving qualifying area
const POST_DEPLOYMENT_MONTHS = 3;

export default function SdpPanel() {
  const [deposit, setDeposit] = useState('');
  const [months, setMonths] = useState('');

  const calc = useMemo(() => {
    const d = Math.min(parseFloat(deposit) || 0, SDP_MAX_DEPOSIT);
    const m = Math.max(parseInt(months) || 0, 0);
    if (d <= 0 || m <= 0) return null;

    // SDP compounds quarterly. Quarters in deployment + 1 post-deployment quarter.
    const totalMonths = m + POST_DEPLOYMENT_MONTHS;
    const quarters = totalMonths / 3;
    const balance = d * Math.pow(1 + SDP_QUARTERLY_RATE, quarters);
    const interest = balance - d;
    const annualReturn = (interest / d) * (12 / totalMonths) * 100;

    return {
      deposit: d,
      months: m,
      totalMonths,
      balance: Math.round(balance),
      interest: Math.round(interest),
      annualReturn,
    };
  }, [deposit, months]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Savings Deposit Program (SDP)</h3>
      </div>
      <p className="text-text-3 mb-4 text-[11px] leading-relaxed">
        Available during qualifying combat deployments. Deposit up to{' '}
        {formatCurrency(SDP_MAX_DEPOSIT)} and earn a guaranteed{' '}
        <strong className="text-text-2">10 % annual interest</strong> — the best guaranteed return
        in the federal government. Interest continues for 90 days after leaving the qualifying area.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-text-3 text-xs">
            Deposit amount (max {formatCurrency(SDP_MAX_DEPOSIT)})
          </label>
          <input
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            max={SDP_MAX_DEPOSIT}
            placeholder="e.g. 10000"
            className={`w-full ${INPUT_CLS}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-text-3 text-xs">Deployment length (months)</label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            min={1}
            placeholder="e.g. 9"
            className={`w-full ${INPUT_CLS}`}
          />
        </div>
      </div>

      {calc ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex justify-between text-xs">
            <span className="text-text-3">Deposit</span>
            <span className="text-text font-mono">{formatCurrency(calc.deposit)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-3">
              Interest period ({calc.months} mo deployment + {POST_DEPLOYMENT_MONTHS} mo post)
            </span>
            <span className="text-text font-mono">{calc.totalMonths} months</span>
          </div>
          <div className="flex justify-between border-t border-emerald-500/20 pt-2 text-xs">
            <span className="text-text-3">Interest earned</span>
            <span className="font-mono text-emerald-400">+{formatCurrency(calc.interest)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text font-medium">Final balance</span>
            <span className="font-mono font-semibold text-emerald-400">
              {formatCurrency(calc.balance)}
            </span>
          </div>
          <p className="text-text-4 pt-1 text-[10px]">
            Effective annualized return on your deployment period:{' '}
            <span className="font-mono">{calc.annualReturn.toFixed(1)}%</span>
          </p>
        </div>
      ) : (
        <div className="border-border-dim bg-surface-raised/20 rounded-xl border px-4 py-6 text-center">
          <p className="text-text-3 text-sm">
            Enter a deposit amount and deployment length to calculate.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-[11px]">
        <ExternalLink
          href="https://militarypay.defense.gov/Benefits/Savings-Deposit-Program/"
          label="SDP overview — DFAS"
        />
        <ExternalLink href="https://mypay.dfas.mil" label="Enroll at myPay" />
      </div>
    </div>
  );
}
