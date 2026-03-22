'use client';

import { useEffect, useState } from 'react';

import type { FixedExpense } from '@/lib/types';
import { api } from '@/lib/api';

function monthlyAmount(f: FixedExpense) {
  return f.period === 'annual' ? f.amount / 12 : f.amount;
}

export default function FixedExpensesPanel({
  onUpdate,
}: {
  onUpdate: () => void;
}) {
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'annual'>('monthly');

  const reload = () => api.fixedExpenses.list().then(setFixed);

  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFixed() {
    if (!newLabel.trim() || !newAmt) return;
    await api.fixedExpenses.add(newLabel.trim(), parseFloat(newAmt), newPeriod);
    setNewLabel('');
    setNewAmt('');
    setNewPeriod('monthly');
    reload();
    onUpdate();
  }

  async function removeFixed(id: number) {
    await api.fixedExpenses.remove(id);
    reload();
    onUpdate();
  }

  async function togglePeriod(f: FixedExpense) {
    const period = f.period === 'annual' ? 'monthly' : 'annual';
    await api.fixedExpenses.update(f.id, f.label, f.amount, period);
    reload();
    onUpdate();
  }

  const total = fixed.reduce((s, f) => s + monthlyAmount(f), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#7c88a4]">
          Fixed expenses
        </h3>
        {fixed.length > 0 && (
          <span className="font-mono text-xs text-[#9da8c2]">
            ${Math.round(total).toLocaleString()}/mo
          </span>
        )}
      </div>

      {fixed.map((f) => {
        const mo = monthlyAmount(f);
        return (
          <div
            key={f.id}
            className="flex items-center py-3 border-b border-[#1c2840] gap-2"
          >
            <p className="flex-1 text-sm text-[#dce4f8]">{f.label}</p>
            <button
              onClick={() => togglePeriod(f)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                f.period === 'annual'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-[#1f2d46] text-[#7c88a4] hover:border-[#2d4080] hover:text-[#9da8c2]'
              }`}
              title="Toggle monthly / annual"
            >
              {f.period === 'annual' ? '/yr' : '/mo'}
            </button>
            <button
              onClick={() => removeFixed(f.id)}
              className="text-[#7c88a4] hover:text-[#ff4560] text-xs transition-colors"
            >
              ✕
            </button>
            <div className="text-right w-28 shrink-0">
              <p className="font-mono text-sm text-[#ff4560]">
                −${f.amount.toLocaleString()}
                {f.period === 'annual' ? '/yr' : ''}
              </p>
              {f.period === 'annual' && (
                <p className="font-mono text-[11px] text-[#7c88a4]">
                  ${mo.toFixed(2)}/mo
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-2 mt-4 flex-wrap">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 min-w-32 text-sm bg-[#06080f] border border-[#1f2d46] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#4a5575] focus:outline-none focus:border-[#2d4080] transition-colors"
        />
        <input
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFixed()}
          placeholder="$"
          type="number"
          className="w-20 text-sm font-mono bg-[#06080f] border border-[#1f2d46] rounded-lg px-3 py-1.5 text-[#dce4f8] placeholder-[#4a5575] focus:outline-none focus:border-[#2d4080] transition-colors"
        />
        <select
          value={newPeriod}
          onChange={(e) => setNewPeriod(e.target.value as 'monthly' | 'annual')}
          className="text-sm bg-[#06080f] border border-[#1f2d46] rounded-lg px-2 py-1.5 text-[#dce4f8] focus:outline-none focus:border-[#2d4080] transition-colors cursor-pointer"
        >
          <option value="monthly">/mo</option>
          <option value="annual">/yr</option>
        </select>
        <button
          onClick={addFixed}
          className="text-sm px-3 py-1.5 rounded-lg border border-[#1f2d46] text-[#9da8c2] hover:border-[#2d4080] hover:text-[#dce4f8] transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
