'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { BTN_BLUE_CLS, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { Asset, AssetCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

import EditableText from './EditableText';

const CATEGORIES: AssetCategory[] = [
  'Checking',
  'Savings',
  'Brokerage',
  'Retirement',
  'Property',
  'Vehicle',
  'Other',
];

const CAT_ICON: Record<AssetCategory, string> = {
  Checking: '🏦',
  Savings: '💰',
  Brokerage: '📈',
  Retirement: '🏛',
  Property: '🏠',
  Vehicle: '🚗',
  Other: '📦',
};

const CAT_COLOR: Record<AssetCategory, string> = {
  Checking: 'text-[#4a8cff] bg-[#4a8cff]/10',
  Savings: 'text-[#00d98a] bg-[#00d98a]/10',
  Brokerage: 'text-[#b085f5] bg-[#b085f5]/10',
  Retirement: 'text-[#f5aa2a] bg-[#f5aa2a]/10',
  Property: 'text-[#ff7043] bg-[#ff7043]/10',
  Vehicle: 'text-text-3 bg-surface-raised',
  Other: 'text-text-3 bg-surface-raised',
};

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 30) return `${diff}d ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

export default function AssetsPanel({ onUpdate }: { onUpdate: () => void }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState<AssetCategory>('Checking');
  const [newBalance, setNewBalance] = useState('');

  const reload = () => api.assets.list().then(setAssets);

  useEffect(() => {
    void reload();
  }, []);

  async function addAsset() {
    if (!newLabel.trim()) return;
    await api.assets.add(newLabel.trim(), newCat, parseFloat(newBalance) || 0);
    setAdding(false);
    setNewLabel('');
    setNewBalance('');
    setNewCat('Checking');
    void reload();
    onUpdate();
  }

  async function updateField(
    asset: Asset,
    field: keyof Omit<Asset, 'id' | 'updated_at'>,
    raw: string,
  ) {
    const value = field === 'balance' ? parseFloat(raw) || 0 : raw;
    await api.assets.update(asset.id, { [field]: value });
    void reload();
    onUpdate();
  }

  async function removeAsset(id: number) {
    await api.assets.remove(id);
    void reload();
    onUpdate();
  }

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: assets.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={LABEL_CLS}>Assets</h3>
        {totalAssets > 0 && (
          <span className="font-mono text-xs text-[#00d98a]">
            {formatCurrency(totalAssets)} total
          </span>
        )}
      </div>

      <div className="space-y-4">
        {grouped.map(({ cat, items }) => (
          <div key={cat}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs">{CAT_ICON[cat]}</span>
              <span className="text-text-4 text-[10px] font-semibold tracking-widest uppercase">
                {cat}
              </span>
              <span className="text-text-4 ml-auto font-mono text-[10px]">
                {formatCurrency(items.reduce((s, a) => s + a.balance, 0))}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onUpdate={updateField}
                  onRemove={removeAsset}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="bg-bg border-border mt-4 space-y-3 rounded-xl border p-4">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAsset()}
              placeholder="Label (e.g. Chase Checking)"
              className={`flex-1 ${INPUT_CLS}`}
            />
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as AssetCategory)}
              className={INPUT_CLS}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CAT_ICON[c]} {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAsset()}
              placeholder="Balance $"
              type="number"
              className={`flex-1 font-mono ${INPUT_CLS}`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="border-border text-text-2 hover:text-text rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <button onClick={addAsset} className={`px-3 py-1.5 text-sm ${BTN_BLUE_CLS}`}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-text-3 mt-3 text-sm transition-colors hover:text-[#4a8cff]"
        >
          + Add asset
        </button>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  onUpdate,
  onRemove,
}: {
  asset: Asset;
  onUpdate: (asset: Asset, field: keyof Omit<Asset, 'id' | 'updated_at'>, value: string) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="group bg-bg border-border flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <EditableText
            value={asset.label}
            className="text-text text-sm font-medium"
            onSave={(v) => onUpdate(asset, 'label', v)}
          />
          <CategoryField value={asset.category} onSave={(v) => onUpdate(asset, 'category', v)} />
          <span className="text-text-4 ml-auto text-[10px]">
            updated {daysAgo(asset.updated_at)}
          </span>
        </div>
        <div className="mt-1">
          <BalanceField value={asset.balance} onSave={(v) => onUpdate(asset, 'balance', v)} />
        </div>
      </div>
      <button
        onClick={() => onRemove(asset.id)}
        className="text-text-3 shrink-0 text-xs opacity-0 transition-colors group-hover:opacity-100 hover:text-[#ff4560]"
      >
        ✕
      </button>
    </div>
  );
}

function CategoryField({ value, onSave }: { value: AssetCategory; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={(e) => {
          onSave(e.target.value);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className="bg-bg text-text cursor-pointer rounded-full border border-[#4a8cff]/50 px-1.5 py-0.5 text-[10px] outline-none"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CAT_ICON[c]} {c}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Change category"
      className={`rounded-full px-1.5 py-0.5 text-[10px] transition-opacity hover:opacity-70 ${CAT_COLOR[value]}`}
    >
      {value}
    </button>
  );
}

function BalanceField({ value, onSave }: { value: number; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="text-text w-32 border-b border-[#4a8cff]/50 bg-transparent font-mono text-sm outline-none"
      />
    );
  }
  return (
    <span
      className="text-text-2 hover:text-text cursor-pointer font-mono text-sm transition-colors"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {formatCurrency(value)}
    </span>
  );
}
