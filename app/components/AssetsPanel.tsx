'use client';

import type { Asset, AssetCategory } from '@/lib/types';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

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
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addAsset() {
    if (!newLabel.trim()) return;
    await api.assets.add(newLabel.trim(), newCat, parseFloat(newBalance) || 0);
    setAdding(false);
    setNewLabel('');
    setNewBalance('');
    setNewCat('Checking');
    reload();
    onUpdate();
  }

  async function updateField(
    asset: Asset,
    field: keyof Omit<Asset, 'id' | 'updated_at'>,
    raw: string,
  ) {
    const value = field === 'balance' ? parseFloat(raw) || 0 : raw;
    await api.assets.update(asset.id, { [field]: value });
    reload();
    onUpdate();
  }

  async function removeAsset(id: number) {
    await api.assets.remove(id);
    reload();
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-3">
          Assets
        </h3>
        {totalAssets > 0 && (
          <span className="font-mono text-xs text-[#00d98a]">
            {formatCurrency(totalAssets)} total
          </span>
        )}
      </div>

      <div className="space-y-4">
        {grouped.map(({ cat, items }) => (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs">{CAT_ICON[cat]}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-4">
                {cat}
              </span>
              <span className="text-[10px] font-mono text-text-4 ml-auto">
                {formatCurrency(items.reduce((s, a) => s + a.balance, 0))}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  catColor={CAT_COLOR[asset.category as AssetCategory]}
                  onUpdate={updateField}
                  onRemove={removeAsset}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="mt-4 bg-bg border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAsset()}
              placeholder="Label (e.g. Chase Checking)"
              className="flex-1 text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as AssetCategory)}
              className="text-sm bg-bg border border-border rounded-lg px-3 py-1.5 text-text focus:outline-none focus:border-blue-600 transition-colors"
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
              className="flex-1 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-1.5 text-text placeholder-text-4 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAdding(false)}
              className="text-sm px-3 py-1.5 rounded-lg border border-border text-text-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addAsset}
              className="text-sm px-3 py-1.5 rounded-lg bg-surface-blue text-[#4a8cff] hover:bg-surface-blue-dark transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 text-sm text-text-3 hover:text-[#4a8cff] transition-colors"
        >
          + Add asset
        </button>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  catColor,
  onUpdate,
  onRemove,
}: {
  asset: Asset;
  catColor: string;
  onUpdate: (
    asset: Asset,
    field: keyof Omit<Asset, 'id' | 'updated_at'>,
    value: string,
  ) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="group flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <EditableText
            value={asset.label}
            className="text-sm font-medium text-text"
            onSave={(v) => onUpdate(asset, 'label', v)}
          />
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${catColor}`}
          >
            {asset.category}
          </span>
          <span className="text-[10px] text-text-4 ml-auto">
            updated {daysAgo(asset.updated_at)}
          </span>
        </div>
        <div className="mt-1">
          <BalanceField
            value={asset.balance}
            onSave={(v) => onUpdate(asset, 'balance', v)}
          />
        </div>
      </div>
      <button
        onClick={() => onRemove(asset.id)}
        className="text-text-3 hover:text-[#ff4560] text-xs transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

function EditableText({
  value,
  className,
  onSave,
}: {
  value: string;
  className?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
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
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${className} border-b border-[#4a8cff]/50 bg-transparent outline-none`}
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer hover:opacity-70 transition-opacity`}
      onClick={() => setEditing(true)}
    >
      {value}
    </span>
  );
}

function BalanceField({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: string) => void;
}) {
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
        className="w-32 text-sm font-mono border-b border-[#4a8cff]/50 bg-transparent outline-none text-text"
      />
    );
  }
  return (
    <span
      className="text-sm font-mono text-text-2 cursor-pointer hover:text-text transition-colors"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {formatCurrency(value)}
    </span>
  );
}
