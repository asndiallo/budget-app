'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { LABEL_CLS } from '@/lib/config';
import type { PayGrade } from '@/lib/pay-tables';
import {
  ENLISTED_GRADES,
  getBAH,
  getBAS,
  getBasePay,
  getRankTitle,
  OFFICER_GRADES,
  WARRANT_GRADES,
} from '@/lib/pay-tables';
import type { UserProfile } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface Milestone {
  grade: PayGrade;
  yos: number;
}

function nextGrade(grade: PayGrade): PayGrade | null {
  const enlisted = [...ENLISTED_GRADES];
  const warrant = [...WARRANT_GRADES];
  const officer = [...OFFICER_GRADES];
  const ei = enlisted.indexOf(grade as (typeof ENLISTED_GRADES)[number]);
  if (ei >= 0) return ei < enlisted.length - 1 ? enlisted[ei + 1] : null;
  const wi = warrant.indexOf(grade as (typeof WARRANT_GRADES)[number]);
  if (wi >= 0) return wi < warrant.length - 1 ? warrant[wi + 1] : null;
  const oi = officer.indexOf(grade as (typeof OFFICER_GRADES)[number]);
  if (oi >= 0) return oi < officer.length - 1 ? officer[oi + 1] : null;
  return null;
}

// Typical YOS offsets from the starting YOS for each successive promotion
const DEFAULT_YOS_GAPS = [0, 2, 4, 7, 11];
const MAX_MILESTONES = 5;

function buildDefaultMilestones(startGrade: PayGrade, startYos: number): Milestone[] {
  const ms: Milestone[] = [];
  let grade: PayGrade | null = startGrade;
  for (let i = 0; i < MAX_MILESTONES && grade; i++) {
    ms.push({ grade, yos: startYos + DEFAULT_YOS_GAPS[i] });
    grade = nextGrade(grade);
  }
  return ms;
}

interface ChartPoint {
  label: string;
  yos: number;
  basePay: number;
  bas: number;
  bah: number;
  gross: number;
  tsp: number;
  title: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CareerTooltip({ active, payload, label, branch }: any) {
  if (!active || !payload?.length) return null;
  const basePay = payload.find((p: { name: string }) => p.name === 'basePay')?.value ?? 0;
  const bas = payload.find((p: { name: string }) => p.name === 'bas')?.value ?? 0;
  const bah = payload.find((p: { name: string }) => p.name === 'bah')?.value ?? 0;
  const gross = basePay + bas + bah;
  const yos = payload[0]?.payload?.yos ?? 0;
  const title = payload[0]?.payload?.title ?? '';
  const tsp = payload[0]?.payload?.tsp ?? 0;
  return (
    <div className="bg-bg border-border rounded-xl border p-3 text-xs shadow-lg">
      <p className="text-text font-semibold">
        {label} · {getRankTitle(branch, label as PayGrade) || title}
      </p>
      <p className="text-text-4 mb-2 text-[10px]">YOS {yos}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-6">
          <span style={{ color: '#4a8cff' }}>Base pay</span>
          <span className="font-mono">{formatCurrency(basePay)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span style={{ color: '#00d98a' }}>BAS</span>
          <span className="font-mono">{formatCurrency(bas)}</span>
        </div>
        {bah > 0 && (
          <div className="flex justify-between gap-6">
            <span style={{ color: '#8b6cff' }}>BAH</span>
            <span className="font-mono">{formatCurrency(bah)}</span>
          </div>
        )}
        <div className="border-border-dim mt-1 flex justify-between gap-6 border-t pt-1">
          <span className="text-text font-semibold">Gross</span>
          <span className="text-text font-mono font-semibold">{formatCurrency(gross)}</span>
        </div>
        <div className="flex justify-between gap-6 text-amber-400">
          <span>TSP contrib</span>
          <span className="font-mono">{formatCurrency(tsp)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PayCareerArcPanel({
  user,
  tspRate = 0.05,
}: {
  user: UserProfile | null;
  tspRate?: number;
}) {
  const startGrade = (user?.pay_grade ?? 'E-3') as PayGrade;
  const startYos = Math.max(0, user?.years_of_service ?? 0);
  const station = user?.duty_station ?? '';
  const withDep = (user?.dependents ?? 0) > 0;
  const branch = user?.branch ?? 'Air Force';

  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    buildDefaultMilestones(startGrade, startYos),
  );

  if (!user) return null;

  const data: ChartPoint[] = milestones.map(({ grade, yos }) => {
    const basePay = Math.round(getBasePay(grade, yos));
    const bas = Math.round(getBAS(grade));
    const bah = Math.round(getBAH(station, grade, withDep));
    return {
      label: grade,
      yos,
      basePay,
      bas,
      bah,
      gross: basePay + bas + bah,
      tsp: Math.round(basePay * tspRate),
      title: getRankTitle(branch, grade),
    };
  });

  const bahAvailable = data.some((d) => d.bah > 0);
  const cols = milestones.length;
  const gridCols = `1fr repeat(${cols}, minmax(0, 1fr))`;

  function updateYos(idx: number, raw: string) {
    const v = parseInt(raw);
    if (isNaN(v)) return;
    const min = idx === 0 ? 0 : milestones[idx - 1].yos + 1;
    const clamped = Math.max(min, Math.min(40, v));
    setMilestones((prev) => prev.map((ms, i) => (i === idx ? { ...ms, yos: clamped } : ms)));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Career income arc</h3>
      </div>

      {/* Milestone YOS controls */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {milestones.map((ms, i) => (
          <div key={ms.grade} className="flex items-center gap-1">
            {i > 0 && <span className="text-text-4 text-xs">→</span>}
            <div
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${
                i === 0 ? 'border-border bg-surface' : 'border-border/50'
              }`}
            >
              <span className={`text-xs font-semibold ${i === 0 ? 'text-text' : 'text-[#4a8cff]'}`}>
                {ms.grade}
              </span>
              <span className="text-text-4 text-[10px]">@</span>
              {i === 0 ? (
                <span className="text-text-3 font-mono text-[10px]">{ms.yos}</span>
              ) : (
                <input
                  type="number"
                  min={milestones[i - 1].yos + 1}
                  max={40}
                  value={ms.yos}
                  onChange={(e) => updateYos(i, e.target.value)}
                  className="text-text w-7 bg-transparent text-center font-mono text-[10px] focus:outline-none"
                />
              )}
              <span className="text-text-4 text-[10px]">YOS</span>
            </div>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={Math.max(28, Math.min(48, 180 / cols))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-text-3)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fill: 'var(--color-text-4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={<CareerTooltip branch={branch} />}
              cursor={{ fill: 'var(--color-surface)' }}
            />
            <Bar
              dataKey="basePay"
              name="basePay"
              stackId="a"
              fill="#4a8cff"
              radius={[0, 0, 0, 0]}
            />
            <Bar dataKey="bas" name="bas" stackId="a" fill="#00d98a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="bah" name="bah" stackId="a" fill="#8b6cff" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-1 flex items-center justify-center gap-5 text-[10px]">
        {[
          { color: '#4a8cff', label: 'Base pay' },
          { color: '#00d98a', label: 'BAS' },
          { color: '#8b6cff', label: bahAvailable ? 'BAH' : 'BAH (set duty station)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: color, opacity: label.includes('set') ? 0.4 : 1 }}
            />
            <span className={label.includes('set') ? 'text-text-4' : 'text-text-3'}>{label}</span>
          </div>
        ))}
      </div>

      {/* Summary table */}
      <div className="border-border mt-4 overflow-hidden rounded-xl border">
        <div
          className="bg-surface-raised border-border grid border-b px-4 py-2"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="text-text-4 text-[10px] font-semibold tracking-wider uppercase" />
          {data.map((d) => (
            <span
              key={d.label}
              className="text-text-3 text-right text-[10px] font-semibold tracking-wider uppercase"
            >
              {d.label}
            </span>
          ))}
        </div>

        {(
          [
            { label: 'Base pay', key: 'basePay' },
            { label: 'BAS', key: 'bas' },
            ...(bahAvailable ? [{ label: 'BAH', key: 'bah' }] : []),
            { label: 'Gross', key: 'gross' },
            { label: `TSP (${Math.round(tspRate * 100)}%)`, key: 'tsp' },
          ] as { label: string; key: keyof ChartPoint }[]
        ).map(({ label, key }) => {
          const isGross = key === 'gross';
          return (
            <div
              key={key}
              className={`border-border-dim grid border-b px-4 py-2 transition-colors last:border-0 ${isGross ? 'bg-surface' : 'hover:bg-surface/30'}`}
              style={{ gridTemplateColumns: gridCols }}
            >
              <span className={`text-xs ${isGross ? 'text-text font-semibold' : 'text-text-2'}`}>
                {label}
              </span>
              {data.map((d) => {
                const val = d[key] as number;
                return (
                  <span
                    key={d.label}
                    className={`text-right font-mono text-xs ${isGross ? 'text-text font-semibold' : 'text-text-3'}`}
                  >
                    {val > 0 ? formatCurrency(val) : <span className="text-text-4">—</span>}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Delta row: gain vs current */}
      {data.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 px-1">
          {data.slice(1).map((d) => {
            const gain = d.gross - data[0].gross;
            return (
              <span key={d.label} className="text-[10px] text-[#00d98a]">
                {d.label}: +{formatCurrency(gain)}/mo · +{formatCurrency(gain * 12)}/yr
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
