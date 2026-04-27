'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { BTN_BLUE_CLS, INPUT_CLS, LABEL_CLS } from '@/lib/config';
import type { ApiKey, ApiKeyCreated } from '@/lib/types';

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = () => api.apiKeys.list().then(setKeys);

  useEffect(() => {
    void reload();
  }, []);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await api.apiKeys.create(trimmed);
      setNewName('');
      setRevealed(created);
      setKeys((prev) => [created, ...prev]);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    setRevealed(null);
    setCopied(false);
  };

  const handleRevoke = async (id: number) => {
    await api.apiKeys.remove(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
    if (revealed?.id === id) handleDismiss();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className={LABEL_CLS}>API Keys</p>
        <p className="text-text-3 mt-1 text-xs">
          Use these keys to authenticate external apps via{' '}
          <code className="text-text-2 font-mono">Authorization: Bearer &lt;key&gt;</code>.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className={`${INPUT_CLS} flex-1`}
          placeholder="Key name (e.g. House Hack Tool)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className={`px-4 py-1.5 text-sm ${BTN_BLUE_CLS} disabled:opacity-40`}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>

      {revealed && (
        <div className="border-border bg-surface space-y-2 rounded-xl border px-4 py-3">
          <p className="text-text text-xs font-medium">
            Copy your key now — it will not be shown again.
          </p>
          <p className="text-text-2 font-mono text-xs break-all">{revealed.key}</p>
          <div className="flex gap-3">
            <button onClick={handleCopy} className={`text-xs ${BTN_BLUE_CLS} px-3 py-1`}>
              {copied ? 'Copied!' : 'Copy key'}
            </button>
            <button
              onClick={handleDismiss}
              className="text-text-3 hover:text-text-2 text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-text-4 text-xs">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="bg-surface border-border rounded-xl border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-text text-sm font-medium">{k.name}</p>
                  <p className="text-text-3 mt-0.5 font-mono text-xs">{k.key_prefix}…</p>
                  <p className="text-text-4 mt-1 text-[11px]">
                    Created {formatDate(k.created_at)} · Last used {formatDate(k.last_used_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="shrink-0 text-[11px] text-red-500 transition-colors hover:text-red-400"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
