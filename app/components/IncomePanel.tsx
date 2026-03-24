'use client';

import { DEDUCTION_FIELDS, INCOME_FIELDS, TSP_CONFIG } from '@/lib/config';
import type { IncomeConfig, IncomeEntry } from '@/lib/types';
import { useEffect, useState } from 'react';

import LesImportButton from './LesImportButton';
import { api } from '@/lib/api';

interface PaySuggestion {
  base_pay: number;
  bas: number;
  bah: number;
}

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
  const [suggestion, setSuggestion] = useState<PaySuggestion | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

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

  if (!income) return <p className="text-sm text-text-3 py-4">Loading…</p>;

  const tspRate = income.tsp_rate ?? TSP_CONFIG.rate;
  const tsp = Math.round((income.base_pay || 0) * tspRate);

  const militaryTotal = INCOME_FIELDS.reduce(
    (s, f) => s + (income[f.key] || 0),
    0,
  );
  const extraTotal = entries.reduce((s, e) => s + e.amount, 0);
  const deductionTotal =
    tsp + DEDUCTION_FIELDS.reduce((s, f) => s + (income[f.key] || 0), 0);

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

  async function fetchSuggestion() {
    setSyncLoading(true);
    try {
      const s = await api.income.suggest();
      setSuggestion(s);
    } finally {
      setSyncLoading(false);
    }
  }

  async function applySuggestion() {
    if (!suggestion || !income) return;
    const changed: Partial<IncomeConfig> = {};
    if (suggestion.base_pay !== income.base_pay)
      changed.base_pay = suggestion.base_pay;
    if (suggestion.bas !== income.bas) changed.bas = suggestion.bas;
    if (suggestion.bah !== income.bah) changed.bah = suggestion.bah;
    if (Object.keys(changed).length === 0) {
      setSuggestion(null);
      return;
    }
    setIncome((prev) => (prev ? { ...prev, ...(changed as IncomeConfig) } : prev));
    await api.income.update(month, changed);
    setSuggestion(null);
    onUpdate();
  }

  async function handleLesImport() {
    // Re-fetch income and entries after LES import
    const [data, ents] = await Promise.all([
      api.income.get(month),
      api.incomeEntries.list(month),
    ]);
    setIncome(data);
    setTspRateLocal(
      String(Math.round((data.tsp_rate ?? TSP_CONFIG.rate) * 100)),
    );
    setEntries(ents);
    onUpdate();
  }

  // Build suggestion diff for display
  const suggestionDiff = suggestion
    ? (['base_pay', 'bas', 'bah'] as const)
        .filter((k) => suggestion[k] !== (income?.[k] ?? 0))
        .map((k) => ({
          key: k,
          label: k === 'base_pay' ? 'Base pay' : k.toUpperCase(),
          current: income?.[k] ?? 0,
          suggested: suggestion[k],
        }))
    : [];

  return (
    <div className="space-y-6">
      <Section
        title="Military pay"
        total={militaryTotal}
        totalColor="text-text"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSuggestion}
              disabled={syncLoading}
              title="Sync base pay, BAS, and BAH from your profile"
              className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-raised text-text-3 hover:text-text-2 hover:bg-surface-raised/80 transition-colors disabled:opacity-40"
            >
              {syncLoading ? '…' : '⟳ Sync from profile'}
            </button>
            <LesImportButton month={month} onImport={handleLesImport} />
          </div>
        }
      >
        {suggestion && (
          <div className="mb-2 rounded-xl border border-blue-500/20 bg-surface-blue/30 px-4 py-3 space-y-2">
            {suggestionDiff.length === 0 ? (
              <p className="text-xs text-text-2">
                Your pay values already match your profile — nothing to update.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-text-3 font-medium uppercase tracking-wider">
                  Calculated from your profile
                </p>
                {suggestionDiff.map(({ key, label, current, suggested }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-text-3">{label}</span>
                    <span className="font-mono text-text-3 line-through">
                      ${Math.round(current).toLocaleString()}
                    </span>
                    <span className="text-text-4">→</span>
                    <span className="font-mono text-[#4a8cff] font-medium">
                      ${Math.round(suggested).toLocaleString()}
                    </span>
                  </div>
                ))}
              </>
            )}
            <div className="flex items-center gap-2 pt-1">
              {suggestionDiff.length > 0 && (
                <button
                  onClick={applySuggestion}
                  className="text-xs px-3 py-1 rounded-lg bg-[#4a8cff]/15 text-[#4a8cff] hover:bg-[#4a8cff]/25 transition-colors"
                >
                  Apply
                </button>
              )}
              <button
                onClick={() => setSuggestion(null)}
                className="text-xs px-3 py-1 rounded-lg text-text-3 hover:text-text-2 hover:bg-surface-raised transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {INCOME_FIELDS.map((f) => (
          <Row
            key={f.key}
            label={f.label}
            note={f.note}
            value={income[f.key] ?? 0}
            onChange={(v) => saveIncome(f.key, v)}
          />
        ))}
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
          <ResourceLink href="https://mypay.dfas.mil" label="myPay (LES)" />
          <ResourceLink href="https://www.dfas.mil/militarymembers/payentitlements/pay-tables/" label="DFAS pay tables" />
          <ResourceLink href="https://militarypay.defense.gov/Pay/Basic-Allowance-for-Housing/" label="BAH calculator" />
        </div>
      </Section>

      <Section
        title="Deductions"
        total={deductionTotal}
        totalPrefix="−"
        totalColor="text-[#ff4560]"
      >
        {/* TSP — rate-editable row */}
        <div className="flex items-center py-3 border-b border-border-dim">
          <div className="flex-1">
            <p className="text-sm text-text">TSP</p>
            <p className="text-[11px] text-text-3 mt-0.5">
              {TSP_CONFIG.note} ·{' '}
              <a
                href="https://www.tsp.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4a8cff] hover:underline"
              >
                tsp.gov
              </a>
            </p>
          </div>
          <div className="flex items-center gap-1.5 mr-4">
            <input
              type="number"
              value={tspRateLocal}
              onChange={(e) => setTspRateLocal(e.target.value)}
              onBlur={saveTspRate}
              className="w-14 text-sm text-right font-mono bg-bg border border-border rounded-lg px-2 py-1 text-[#4a8cff] focus:outline-none focus:border-blue-600 transition-colors"
            />
            <span className="text-xs text-text-3">% of base</span>
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

      <Section
        title="Additional income"
        total={extraTotal > 0 ? extraTotal : undefined}
        totalPrefix="+"
        totalColor="text-[#00d98a]"
      >
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center py-3 border-b border-border-dim gap-3"
          >
            <div className="flex-1">
              <p className="text-sm text-text">{e.description}</p>
              {e.source && e.source !== 'Other' && (
                <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-surface-raised text-text-2 mt-0.5">
                  {e.source}
                </span>
              )}
            </div>
            <span className="font-mono text-sm text-[#00d98a]">
              +${e.amount.toLocaleString()}
            </span>
            <button
              onClick={() => removeEntry(e.id)}
              className="text-text-3 hover:text-[#ff4560] text-xs transition-colors"
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
            className="flex-1 min-w-36 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <input
            value={newAmt}
            onChange={(e) => setNewAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="$"
            type="number"
            className="w-20 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            placeholder="Source (optional)"
            className="flex-1 min-w-28 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <button
            onClick={addEntry}
            className="text-sm px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
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
  total,
  totalPrefix = '',
  totalColor = 'text-text-2',
  action,
}: {
  title: string;
  children: React.ReactNode;
  total?: number;
  totalPrefix?: string;
  totalColor?: string;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {action}
          {total !== undefined && (
            <span className={`font-mono text-xs font-semibold ${totalColor}`}>
              {totalPrefix}${Math.round(total).toLocaleString()}
            </span>
          )}
        </div>
      </div>
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
  valueColor = 'text-text',
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
    <div className="flex items-center py-3 border-b border-border-dim">
      <div className="flex-1">
        <p className="text-sm text-text">{label}</p>
        {note && <p className="text-[11px] text-text-3 mt-0.5">{note}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-sm text-text-3">{prefix}</span>}
        <span className="text-sm text-text-3">$</span>
        <input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(parseFloat(local) || 0)}
          className={`w-24 text-sm text-right font-mono bg-bg border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 transition-colors ${valueColor}`}
        />
      </div>
    </div>
  );
}

function ResourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] text-text-4 hover:text-[#4a8cff] transition-colors"
    >
      ↗ {label}
    </a>
  );
}
