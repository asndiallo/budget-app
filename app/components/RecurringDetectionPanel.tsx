'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { BTN_BLUE_CLS, CAT_COLORS } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

type Candidate = {
  description: string;
  normalized_key: string;
  avg_amount: number;
  months_seen: number;
  months: string[];
  category: string;
};

const DISMISS_KEY = 'dismissed_recurring';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(keys: Set<string>) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(keys)));
}

export default function RecurringDetectionPanel({ onUpdate }: { onUpdate: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDismissed(getDismissed());
    api.recurring.list().then((data) => {
      setCandidates(data);
      setLoaded(true);
    });
  }, []);

  const visible = candidates.filter((c) => !dismissed.has(c.normalized_key));

  if (!loaded || visible.length === 0) return null;

  function dismiss(key: string) {
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    saveDismissed(next);
  }

  async function addToFixed(c: Candidate) {
    setAdding(c.normalized_key);
    await api.fixedExpenses.add({ label: c.description, amount: c.avg_amount, period: 'monthly' });
    dismiss(c.normalized_key);
    setAdding(null);
    onUpdate();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#f5aa2a]/30 bg-[#f5aa2a]/5">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#f5aa2a]">⟳</span>
          <span className="text-[11px] font-semibold tracking-widest text-[#f5aa2a] uppercase">
            Recurring charges detected
          </span>
          <span className="rounded-full bg-[#f5aa2a]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#f5aa2a]">
            {visible.length}
          </span>
        </div>
        <span className="text-text-4 text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="space-y-2 px-4 pb-4">
          <p className="text-text-4 -mt-1 mb-3 text-[11px]">
            These charges appear every month. Consider adding them to Fixed Expenses for accurate
            budgeting.
          </p>

          {visible.map((c) => {
            const catClass = CAT_COLORS[c.category] ?? 'bg-gray-500/10 text-gray-400';
            const isAdding = adding === c.normalized_key;

            return (
              <div
                key={c.normalized_key}
                className="bg-bg border-border flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-text truncate text-sm font-medium">{c.description}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${catClass}`}>
                      {c.category}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className="font-mono text-xs text-[#ff4560]">
                      {formatCurrency(c.avg_amount)}/mo
                    </span>
                    <span className="text-text-4 text-[10px]">
                      seen {c.months_seen}× in last 6 months
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => addToFixed(c)}
                    disabled={isAdding}
                    className={`px-2.5 py-1 text-[11px] ${BTN_BLUE_CLS} disabled:opacity-50`}
                  >
                    {isAdding ? '…' : '+ Fixed'}
                  </button>
                  <button
                    onClick={() => dismiss(c.normalized_key)}
                    className="text-text-4 hover:text-text-3 rounded-lg px-2 py-1 text-[11px] transition-colors"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
