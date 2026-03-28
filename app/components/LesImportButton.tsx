'use client';

import { useRef, useState } from 'react';
import { parseLes, type LesParseResult } from '@/lib/les-parser';
import { api } from '@/lib/api';
import { LABEL_CLS } from '@/lib/config';

interface Props {
  month: string;
  onImport: () => void;
}

type Step = 'idle' | 'input' | 'preview' | 'done';

export default function LesImportButton({ month, onImport }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [applying, setApplying] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<LesParseResult | null>(null);
  const [targetMonth, setTargetMonth] = useState(month);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('idle');
    setText('');
    setResult(null);
    setTargetMonth(month);
  }

  function handleText(raw: string) {
    setText(raw);
    if (raw.trim().length > 20) {
      const parsed = parseLes(raw);
      setResult(parsed);
      setTargetMonth(parsed.month ?? month);
      setStep('preview');
    } else {
      setResult(null);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    handleText(raw);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function applyImport() {
    if (!result || Object.keys(result.fields).length === 0) return;
    setApplying(true);
    try {
      await api.income.update(targetMonth, result.fields);
      setStep('done');
      onImport();
    } finally {
      setApplying(false);
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('input')}
        className="text-[11px] px-2 py-1 rounded-lg border border-border text-text-3 hover:text-[#4a8cff] hover:border-[#4a8cff]/40 transition-colors"
        title="Import from Leave & Earnings Statement"
      >
        Import LES
      </button>
    );
  }

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[#00d98a]">
        <span>✓ Imported</span>
        <button
          onClick={reset}
          className="text-text-4 hover:text-text-3 transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border border-border rounded-xl p-4 space-y-4 bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text">Import LES</p>
        <button
          onClick={reset}
          className="text-text-4 hover:text-text-3 text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Input area — shown until we have a parsed result */}
      {(step === 'input' ||
        (step === 'preview' && !result?.preview.length)) && (
        <div className="space-y-3">
          <p className="text-[11px] text-text-4 leading-relaxed">
            Paste your LES text below, or upload the{' '}
            <code className="text-text-3">.txt</code> file from{' '}
            <a
              href="https://mypay.dfas.mil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4a8cff] hover:underline"
            >
              myPay
            </a>
            . For a PDF: open it, press{' '}
            <kbd className="px-1 py-0.5 rounded bg-surface text-text-2 font-mono text-[10px]">
              ⌘A
            </kbd>{' '}
            then{' '}
            <kbd className="px-1 py-0.5 rounded bg-surface text-text-2 font-mono text-[10px]">
              ⌘C
            </kbd>
            , then paste here.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => handleText(e.target.value)}
            placeholder="Paste LES text here…"
            rows={6}
            className="w-full text-xs font-mono bg-surface border border-border rounded-lg px-3 py-2 text-text placeholder-text-4 focus:outline-none focus:border-blue-500 transition-colors resize-y"
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#4a8cff] hover:underline cursor-pointer">
              Upload .txt file
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.text"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && result && result.preview.length > 0 && (
        <div className="space-y-3">
          {/* Detected fields */}
          <div>
            <p className={`${LABEL_CLS} mb-2`}>
              Extracted fields ({result.preview.length})
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              {result.preview.map(({ key, label, value }, i) => (
                <div
                  key={key}
                  className={`flex items-center justify-between px-3 py-2 text-xs ${
                    i < result.preview.length - 1
                      ? 'border-b border-border-dim'
                      : ''
                  }`}
                >
                  <span className="text-text-3">{label}</span>
                  <span className="font-mono text-text">
                    {key === 'tsp_rate'
                      ? `${Math.round(value * 100)}% of base`
                      : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w) => (
                <p
                  key={w}
                  className="text-[11px] text-amber-400 flex items-start gap-1.5"
                >
                  <span className="shrink-0">⚠</span>
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

          {/* Month confirmation */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-3 shrink-0">
              Apply to month
            </span>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="text-xs bg-surface border border-border rounded-lg px-2 py-1 text-text focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Paste a different LES */}
          {text && (
            <button
              onClick={() => {
                setText('');
                setResult(null);
                setStep('input');
              }}
              className="text-[11px] text-text-4 hover:text-text-3 transition-colors"
            >
              ← Paste different LES
            </button>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={applyImport}
              disabled={applying || !targetMonth}
              className="flex-1 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {applying ? 'Applying…' : `Apply to ${targetMonth}`}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 text-xs rounded-lg border border-border text-text-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
