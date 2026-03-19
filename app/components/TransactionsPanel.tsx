'use client';

import { useEffect, useRef, useState } from 'react';

const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Subscriptions',
  'Personal care',
  'Entertainment',
  'Wedding',
  'Other',
];

const CAT_COLORS: Record<string, string> = {
  Food: 'bg-amber-50 text-amber-700',
  Transport: 'bg-blue-50 text-blue-700',
  Shopping: 'bg-purple-50 text-purple-700',
  Subscriptions: 'bg-sky-50 text-sky-700',
  'Personal care': 'bg-pink-50 text-pink-700',
  Entertainment: 'bg-indigo-50 text-indigo-700',
  Wedding: 'bg-rose-50 text-rose-700',
  Other: 'bg-gray-50 text-gray-500',
};

interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  month: string;
  source: string;
  created_at: string;
}

export default function TransactionsPanel({
  month,
  onUpdate,
}: {
  month: string;
  onUpdate: () => void;
}) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState('Food');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTxs = () => {
    fetch(`/api/transactions?month=${month}`)
      .then((r) => r.json())
      .then(setTxs);
  };

  useEffect(() => {
    fetchTxs();
  }, [month]);

  async function addTx() {
    if (!desc.trim() || !amt) return;
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: desc.trim(),
        amount: parseFloat(amt),
        category: cat,
        month,
      }),
    });
    setDesc('');
    setAmt('');
    fetchTxs();
    onUpdate();
  }

  async function deleteTx(id: number) {
    await fetch('/api/transactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchTxs();
    onUpdate();
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0]
      .split(',')
      .map((h) => h.replace(/"/g, '').trim().toLowerCase());

    const rows: {
      description: string;
      amount: number;
      category: string;
      date: string;
    }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length < 2) continue;

      // Apple Card CSV: Transaction Date, Clearing Date, Description, Merchant, Category, Type, Amount (USD)
      // Try to find columns by header name
      const dateIdx = headers.findIndex(
        (h) => h.includes('transaction date') || h === 'date',
      );
      const descIdx = headers.findIndex(
        (h) => h === 'description' || h === 'merchant',
      );
      const catIdx = headers.findIndex((h) => h === 'category');
      const amtIdx = headers.findIndex((h) => h.includes('amount'));

      const description = vals[descIdx >= 0 ? descIdx : 2] || 'Unknown';
      const amount = Math.abs(
        parseFloat(
          (vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(
            /[^0-9.-]/g,
            '',
          ),
        ),
      );
      const category = vals[catIdx >= 0 ? catIdx : 4] || 'Other';
      const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';

      if (amount > 0) rows.push({ description, amount, category, date });
    }

    const res = await fetch('/api/csv-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, month }),
    });
    const data = await res.json();
    setImportMsg(`Imported ${data.imported} transactions`);
    setImporting(false);
    fetchTxs();
    onUpdate();
    if (fileRef.current) fileRef.current.value = '';
  }

  // Totals by category
  const catTotals = txs.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const filtered = filterCat
    ? txs.filter((t) => t.category === filterCat)
    : txs;
  const grandTotal = txs.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      {/* Apple Card import */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">
              Import Apple Card CSV
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Wallet → tap card → scroll down → Export Transactions
            </p>
          </div>
          <label className="cursor-pointer">
            <span className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap">
              {importing ? 'Importing…' : 'Upload CSV'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
          </label>
        </div>
        {importMsg && (
          <p className="text-xs text-emerald-600 mt-2">{importMsg}</p>
        )}
      </div>

      {/* Category filter chips */}
      {Object.keys(catTotals).length > 0 && (
        <div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterCat(null)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                !filterCat
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              All · ${Math.round(grandTotal).toLocaleString()}
            </button>
            {Object.entries(catTotals).map(([c, total]) => (
              <button
                key={c}
                onClick={() => setFilterCat(filterCat === c ? null : c)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filterCat === c
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {c} · ${Math.round(total).toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Transactions
        </h3>
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-4">
            No transactions yet for this month.
          </p>
        )}
        {filtered.map((t) => (
          <div
            key={t.id}
            className="flex items-center py-2.5 border-b border-gray-100 gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{t.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[t.category] || CAT_COLORS['Other']}`}
                >
                  {t.category}
                </span>
                {t.source === 'apple_card' && (
                  <span className="text-xs text-gray-400">Apple Card</span>
                )}
              </div>
            </div>
            <span className="text-sm font-medium text-gray-800">
              −${t.amount.toLocaleString()}
            </span>
            <button
              onClick={() => deleteTx(t.id)}
              className="text-gray-300 hover:text-red-400 text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add transaction */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Add manually
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTx()}
            placeholder="Description"
            className="flex-1 min-w-40 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTx()}
            placeholder="$"
            type="number"
            className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={addTx}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
