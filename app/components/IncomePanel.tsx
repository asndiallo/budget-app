'use client';

import { DEDUCTION_FIELDS, INCOME_FIELDS, TSP_CONFIG } from '@/lib/config';
import type { IncomeConfig, IncomeEntry } from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

export default function IncomePanel({
  month,
  onUpdate,
}: {
  month: string;
  onUpdate: () => void;
}) {
  const [income, setIncome] = useState<IncomeConfig | null>(null);
  const [tspRateLocal, setTspRateLocal] = useState('');
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newSource, setNewSource] = useState('');

  useEffect(() => {
    if (!month) return;
    api.income.get(month).then((data) => {
      setIncome(data);
      const rate = data.tsp_rate ?? TSP_CONFIG.rate;
      setTspRateLocal(String(Math.round(rate * 100)));
    });
    api.incomeEntries.list(month).then(setEntries);
  }, [month]);

  async function addEntry() {
    if (!newDesc.trim() || !newAmt) return;
    await api.incomeEntries.add(
      newDesc.trim(),
      parseFloat(newAmt),
      month,
      newSource || 'Other',
    );
    setNewDesc('');
    setNewAmt('');
    setNewSource('');
    api.incomeEntries.list(month).then(setEntries);
    onUpdate();
  }

  async function removeEntry(id: number) {
    await api.incomeEntries.remove(id);
    api.incomeEntries.list(month).then(setEntries);
    onUpdate();
  }

  if (!income) return <p className="text-sm text-[#7c88a4] py-4">Loading…</p>;

  const tspRate = income.tsp_rate ?? TSP_CONFIG.rate;
  const tsp = Math.round((income.base_pay || 0) * tspRate);

  async function saveIncome(key: string, value: number) {
    setIncome((prev) => (prev ? { ...prev, [key]: value } : prev));
    await api.income.update(month, { [key]: value });
    onUpdate();
  }

  async function saveTspRate() {
    const pct = parseFloat(tspRateLocal);
    if (isNaN(pct)) return;
    await saveIncome('tsp_rate', pct / 100);
  }

  return (
    <div className="space-y-6">
      <Section title="Military pay">
        {INCOME_FIELDS.map((f) => (
          <Row
            key={f.key}
            label={f.label}
            note={f.note}
            value={income[f.key] ?? 0}
            onChange={(v) => saveIncome(f.key, v)}
          />
        ))}
      </Section>

      <Section title="Deductions">
        {/* TSP — rate-editable row */}
        <div className="flex items-center py-3 border-b border-[#1c2840]">
          <div className="flex-1">
            <p className="text-sm text-[#dce4f8]">TSP</p>
            <p className="text-[11px] text-[#7c88a4] mt-0.5">
              {TSP_CONFIG.note}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mr-4">
            <input
              type="number"
              value={tspRateLocal}
              onChange={(e) => setTspRateLocal(e.target.value)}
              onBlur={saveTspRate}
              className="w-14 text-sm text-right font-mono bg-[#06080f] border border-[#1f2d46] rounded-lg px-2 py-1 text-[#4a8cff] focus:outline-none focus:border-[#2d4080] transition-colors"
            />
            <span className="text-xs text-[#7c88a4]">% of base</span>
          </div>
          <span className="font-mono text-sm text-[#ff4560] w-24 text-right">
            −${tsp.toLocaleString()}
          </span>
        </div>

        {DEDUCTION_FIELDS.map((f) => (
          <Row
            key={f.key}
            label={f.label}
            note={f.note}
            value={income[f.key] ?? 0}
            onChange={(v) => saveIncome(f.key, v)}
            prefix="−"
            valueColor="text-[#ff4560]"
          />
        ))}
      </Section>

      <Section title="Additional income">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center py-3 border-b border-[#1c2840] gap-3"
          >
            <div className="flex-1">
              <p className="text-sm text-[#dce4f8]">{e.description}</p>
              {e.source && e.source !== 'Other' && (
                <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#141b2e] text-[#9da8c2] mt-0.5">
                  {e.source}
                </span>
              )}
            </div>
            <span className="font-mono text-sm text-[#00d98a]">
              +${e.amount.toLocaleString()}
            </span>
            <button
              onClick={() => removeEntry(e.id)}
              className="text-[#7c88a4] hover:text-[#ff4560] text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="flex gap-2 flex-wrap pt-3">
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="Description"
            className="flex-1 min-w-36 text-sm bg-[#06080f] border border-[#1f2d46] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#4a5575] focus:outline-none focus:border-[#2d4080] transition-colors"
          />
          <input
            value={newAmt}
            onChange={(e) => setNewAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="$"
            type="number"
            className="w-20 text-sm font-mono bg-[#06080f] border border-[#1f2d46] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#4a5575] focus:outline-none focus:border-[#2d4080] transition-colors"
          />
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="Source (optional)"
            className="flex-1 min-w-28 text-sm bg-[#06080f] border border-[#1f2d46] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#4a5575] focus:outline-none focus:border-[#2d4080] transition-colors"
          />
          <button
            onClick={addEntry}
            className="text-sm px-3 py-1.5 rounded-lg bg-[#1a2650] text-[#4a8cff] hover:bg-[#1f2f63] transition-colors"
          >
            + Add
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  note,
  value,
  onChange,
  prefix = '',
  valueColor = 'text-[#dce4f8]',
}: {
  label: string;
  note?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  valueColor?: string;
}) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <div className="flex items-center py-3 border-b border-[#1c2840]">
      <div className="flex-1">
        <p className="text-sm text-[#dce4f8]">{label}</p>
        {note && <p className="text-[11px] text-[#7c88a4] mt-0.5">{note}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-sm text-[#7c88a4]">{prefix}</span>}
        <span className="text-sm text-[#7c88a4]">$</span>
        <input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(parseFloat(local) || 0)}
          className={`w-24 text-sm text-right font-mono bg-[#06080f] border border-[#1f2d46] rounded-lg px-2 py-1 focus:outline-none focus:border-[#2d4080] transition-colors ${valueColor}`}
        />
      </div>
    </div>
  );
}
