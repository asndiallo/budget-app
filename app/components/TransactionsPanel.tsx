'use client';

import { CATEGORIES, CAT_COLORS, DEFAULT_CATEGORY } from '@/lib/config';
import type { PaymentSource, Transaction } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { parseCSVLine } from '@/lib/utils';

export default function TransactionsPanel({
  month,
  onUpdate,
}: {
  month: string;
  onUpdate: () => void;
}) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [sources, setSources] = useState<PaymentSource[]>([]);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const [source, setSource] = useState('manual');
  const [csvSource, setCsvSource] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [managingCards, setManagingCards] = useState(false);
  const [newCard, setNewCard] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reloadTxs = () => api.transactions.list(month).then(setTxs);
  const reloadSources = () =>
    api.paymentSources.list().then((s) => {
      setSources(s);
      if (s.length > 0) {
        setCsvSource((prev) => prev || s[0].label);
      }
    });

  useEffect(() => {
    reloadTxs();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reloadSources();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addTx() {
    if (!desc.trim() || !amt) return;
    await api.transactions.add({
      description: desc.trim(),
      amount: parseFloat(amt),
      category: cat,
      month,
      source,
    });
    setDesc('');
    setAmt('');
    reloadTxs();
    onUpdate();
  }

  async function updateTx(
    id: number,
    data: Partial<Pick<Transaction, 'description' | 'amount' | 'category'>>,
  ) {
    await api.transactions.update(id, data);
    reloadTxs();
    onUpdate();
  }

  async function deleteTx(id: number) {
    await api.transactions.remove(id);
    reloadTxs();
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

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length < 2) continue;

      const dateIdx = headers.findIndex(
        (h) => h.includes('transaction date') || h === 'date',
      );
      // Prefer the clean Merchant column over the full noisy Description
      const merchantIdx = headers.findIndex((h) => h === 'merchant');
      const descIdx = headers.findIndex((h) => h === 'description');
      const catIdx = headers.findIndex((h) => h === 'category');
      const typeIdx = headers.findIndex((h) => h === 'type');
      const amtIdx = headers.findIndex((h) => h.includes('amount'));

      // Skip payment rows (ACH payments to the card — not spending)
      const type = (vals[typeIdx] || '').toLowerCase();
      if (type === 'payment') continue;

      const description =
        vals[merchantIdx >= 0 ? merchantIdx : descIdx >= 0 ? descIdx : 2] ||
        'Unknown';
      const amount = Math.abs(
        parseFloat(
          (vals[amtIdx >= 0 ? amtIdx : vals.length - 1] || '0').replace(
            /[^0-9.-]/g,
            '',
          ),
        ),
      );
      const category = vals[catIdx >= 0 ? catIdx : 4] || DEFAULT_CATEGORY;
      const date = vals[dateIdx >= 0 ? dateIdx : 0] || '';

      if (amount > 0) rows.push({ description, amount, category, date });
    }

    const data = await api.transactions.importCsv(rows, month, csvSource);
    const monthLabels = (data.months ?? [])
      .sort()
      .map((m) => {
        const [y, mo] = m.split('-');
        return new Date(+y, +mo - 1).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
      })
      .join(', ');
    setImportMsg(
      `Imported ${data.imported} transaction${data.imported !== 1 ? 's' : ''}` +
        (monthLabels ? ` · ${monthLabels}` : ''),
    );
    setImporting(false);
    reloadTxs();
    onUpdate();
    if (fileRef.current) fileRef.current.value = '';
  }

  async function addCard() {
    if (!newCard.trim()) return;
    await api.paymentSources.add(newCard.trim());
    setNewCard('');
    reloadSources();
  }

  async function removeCard(id: number) {
    await api.paymentSources.remove(id);
    reloadSources();
  }

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
      {/* CSV import */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">Import CSV</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Apple Card: Wallet → tap card → Export Transactions
            </p>
            {sources.length > 0 && (
              <select
                value={csvSource}
                onChange={(e) => setCsvSource(e.target.value)}
                className="mt-2 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.label}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="cursor-pointer shrink-0">
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

      {/* Manage cards */}
      <div>
        <button
          onClick={() => setManagingCards((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {managingCards ? '▾ Hide cards' : '▸ Manage cards'}
        </button>
        {managingCards && (
          <div className="mt-2 border border-gray-200 rounded-lg p-3 space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{s.label}</span>
                <button
                  onClick={() => removeCard(s.id)}
                  className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCard()}
                placeholder="Card name"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={addCard}
                className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                + Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Category filter chips */}
      {Object.keys(catTotals).length > 0 && (
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
          <TxRow
            key={t.id}
            tx={t}
            onUpdate={(data) => updateTx(t.id, data)}
            onDelete={() => deleteTx(t.id)}
          />
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
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="manual">Manual</option>
            {sources.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
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

function TxRow({
  tx,
  onUpdate,
  onDelete,
}: {
  tx: Transaction;
  onUpdate: (
    data: Partial<Pick<Transaction, 'description' | 'amount' | 'category'>>,
  ) => void;
  onDelete: () => void;
}) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingAmt, setEditingAmt] = useState(false);
  const [desc, setDesc] = useState(tx.description);
  const [amt, setAmt] = useState(String(tx.amount));

  // Keep local state in sync if parent reloads
  useEffect(() => {
    setDesc(tx.description);
  }, [tx.description]);
  useEffect(() => {
    setAmt(String(tx.amount));
  }, [tx.amount]);

  const saveDesc = useCallback(() => {
    setEditingDesc(false);
    if (desc.trim() && desc !== tx.description)
      onUpdate({ description: desc.trim() });
  }, [desc, tx.description, onUpdate]);

  const saveAmt = useCallback(() => {
    setEditingAmt(false);
    const n = parseFloat(amt);
    if (!isNaN(n) && n !== tx.amount) onUpdate({ amount: n });
  }, [amt, tx.amount, onUpdate]);

  return (
    <div className="flex items-center py-2.5 border-b border-gray-100 gap-3">
      <div className="flex-1 min-w-0">
        {editingDesc ? (
          <input
            autoFocus
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveDesc();
              if (e.key === 'Escape') {
                setDesc(tx.description);
                setEditingDesc(false);
              }
            }}
            className="w-full text-sm border-b border-blue-400 bg-transparent outline-none text-gray-800"
          />
        ) : (
          <p
            className="text-sm text-gray-800 truncate cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {tx.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <select
            value={tx.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${CAT_COLORS[tx.category] ?? CAT_COLORS[DEFAULT_CATEGORY]}`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {tx.source !== 'manual' && (
            <span className="text-xs text-gray-400">{tx.source}</span>
          )}
        </div>
      </div>

      {editingAmt ? (
        <input
          autoFocus
          type="number"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          onBlur={saveAmt}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveAmt();
            if (e.key === 'Escape') {
              setAmt(String(tx.amount));
              setEditingAmt(false);
            }
          }}
          className="w-20 text-sm text-right border-b border-blue-400 bg-transparent outline-none text-gray-800"
        />
      ) : (
        <span
          className="text-sm font-medium text-gray-800 cursor-pointer hover:text-blue-600 transition-colors whitespace-nowrap"
          onClick={() => setEditingAmt(true)}
          title="Click to edit"
        >
          −${tx.amount.toLocaleString()}
        </span>
      )}

      <button
        onClick={onDelete}
        className="text-gray-300 hover:text-red-400 text-xs transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
