'use client';

import { useEffect, useState } from 'react';
import type { ContributionLimits } from '@/lib/types';
import { LABEL_CLS } from '@/lib/config';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function LimitBar({
  label,
  ytd,
  limit,
  color,
  note,
}: {
  label: string;
  ytd: number;
  limit: number;
  color: string;
  note?: string;
}) {
  const pct = Math.min(100, Math.round((ytd / limit) * 100));
  const remaining = Math.max(0, limit - ytd);
  const over = ytd > limit;
  const warn = !over && pct >= 80;
  const barColor = over ? '#ff4560' : warn ? '#f5aa2a' : color;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium text-text">{label}</span>
          {note && <span className="ml-2 text-[10px] text-text-4">{note}</span>}
        </div>
        <div className="flex items-baseline gap-1.5 text-xs font-mono">
          <span className={over ? 'text-[#ff4560] font-semibold' : warn ? 'text-[#f5aa2a] font-semibold' : 'text-text'}>
            {formatCurrency(ytd)}
          </span>
          <span className="text-text-4">/ {formatCurrency(limit)}</span>
        </div>
      </div>

      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-mono" style={{ color: barColor }}>
          {pct}% used
        </span>
        {over ? (
          <span className="text-[10px] text-[#ff4560] font-semibold">
            Over by {formatCurrency(ytd - limit)}
          </span>
        ) : (
          <span className="text-[10px] text-text-4">
            {formatCurrency(remaining)} remaining
          </span>
        )}
      </div>
    </div>
  );
}

export default function ContributionLimitsPanel({ year }: { year: number }) {
  const [data, setData] = useState<ContributionLimits | null>(null);

  useEffect(() => {
    api.contributionLimits.get(year).then(setData);
  }, [year]);

  if (!data || data.monthsWithData === 0) return null;

  const limitsNote =
    data.limitsYear !== data.year
      ? `(using ${data.limitsYear} limits — ${data.year} not yet configured)`
      : undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className={LABEL_CLS}>
          {data.year} contribution limits
        </h3>
        {limitsNote && (
          <span className="text-[10px] text-text-4">{limitsNote}</span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <LimitBar
            label="Roth TSP (employee)"
            ytd={data.tspYtd}
            limit={data.tspLimit}
            color="#4a8cff"
            note={`elective deferral limit · ${formatCurrency(data.tspCatchupLimit)} w/ catch-up`}
          />
          {data.agencyYtd > 0 && (
            <p className="mt-1.5 text-[10px] text-text-4">
              DoD match (not counted toward limit):{' '}
              <span className="font-mono text-[#00d98a]">
                +{formatCurrency(data.agencyYtd)}
              </span>
              {' '}·{' '}
              <span className="font-mono text-text-3">
                {formatCurrency(data.tspYtd + data.agencyYtd)} total into TSP
              </span>
            </p>
          )}
        </div>
        <LimitBar
          label="Roth IRA"
          ytd={data.iraYtd}
          limit={data.iraLimit}
          color="#b085f5"
          note={`limit ${formatCurrency(data.iraCatchupLimit)} w/ catch-up (age 50+)`}
        />
      </div>
    </div>
  );
}
