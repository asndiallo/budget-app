'use client';

// SRP: This component manages income sources and deductions only.
// Fixed expenses live in FixedExpensesPanel.

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

  if (!income) return <div className="text-sm text-gray-400">Loading…</div>;

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
    const decimal = pct / 100;
    await saveIncome('tsp_rate', decimal);
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
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <div className="flex-1">
            <p className="text-sm text-gray-800">TSP</p>
            <p className="text-xs text-gray-400">{TSP_CONFIG.note}</p>
          </div>
          <div className="flex items-center gap-1 mr-3">
            <input
              type="number"
              value={tspRateLocal}
              onChange={(e) => setTspRateLocal(e.target.value)}
              onBlur={saveTspRate}
              className="w-14 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">% of base</span>
          </div>
          <span className="text-sm font-medium text-gray-500 w-24 text-right">
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
            prefix="-"
          />
        ))}
      </Section>
      <Section title="Additional income">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center py-2.5 border-b border-gray-100 gap-3"
          >
            <div className="flex-1">
              <p className="text-sm text-gray-800">{e.description}</p>
              {e.source && e.source !== 'Other' && (
                <p className="text-xs text-gray-400">{e.source}</p>
              )}
            </div>
            <span className="text-sm font-medium text-emerald-700">
              +${e.amount.toLocaleString()}
            </span>
            <button
              onClick={() => removeEntry(e.id)}
              className="text-gray-300 hover:text-red-400 text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2 flex-wrap pt-2">
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="Description (e.g. Business revenue)"
            className="flex-1 min-w-36 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={newAmt}
            onChange={(e) => setNewAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="$"
            type="number"
            className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="Source (optional)"
            className="flex-1 min-w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={addEntry}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
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
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
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
}: {
  label: string;
  note?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <div className="flex items-center py-2.5 border-b border-gray-100">
      <div className="flex-1">
        <p className="text-sm text-gray-800">{label}</p>
        {note && <p className="text-xs text-gray-400">{note}</p>}
      </div>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        <span className="text-sm text-gray-400">$</span>
        <input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(parseFloat(local) || 0)}
          className="w-24 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
