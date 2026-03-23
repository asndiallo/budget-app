'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CAT_COLORS } from '@/lib/config';

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

export default function RecurringDetectionPanel({
  onUpdate,
}: {
  onUpdate: () => void;
}) {
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
    await api.fixedExpenses.add(c.description, c.avg_amount, 'monthly');
    dismiss(c.normalized_key);
    setAdding(null);
    onUpdate();
  }

  return (
    <div className="border border-[#f5aa2a]/30 bg-[#f5aa2a]/5 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[#f5aa2a] text-sm">⟳</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#f5aa2a]">
            Recurring charges detected
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f5aa2a]/20 text-[#f5aa2a] font-mono">
            {visible.length}
          </span>
        </div>
        <span className="text-text-4 text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] text-text-4 mb-3 -mt-1">
            These charges appear every month. Consider adding them to Fixed
            Expenses for accurate budgeting.
          </p>

          {visible.map((c) => {
            const catClass =
              CAT_COLORS[c.category] ?? 'bg-gray-500/10 text-gray-400';
            const isAdding = adding === c.normalized_key;

            return (
              <div
                key={c.normalized_key}
                className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text truncate">
                      {c.description}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${catClass}`}
                    >
                      {c.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-mono text-[#ff4560]">
                      {formatCurrency(c.avg_amount)}/mo
                    </span>
                    <span className="text-[10px] text-text-4">
                      seen {c.months_seen}× in last 6 months
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => addToFixed(c)}
                    disabled={isAdding}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors disabled:opacity-50"
                  >
                    {isAdding ? '…' : '+ Fixed'}
                  </button>
                  <button
                    onClick={() => dismiss(c.normalized_key)}
                    className="text-[11px] px-2 py-1 rounded-lg text-text-4 hover:text-text-3 transition-colors"
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
