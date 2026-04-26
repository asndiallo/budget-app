'use client';

import { useRef } from 'react';

export default function SubNav({
  options,
  active,
  onChange,
}: {
  options: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % options.length;
      refs.current[next]?.focus();
      onChange(options[next].key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + options.length) % options.length;
      refs.current[prev]?.focus();
      onChange(options[prev].key);
    } else if (e.key === 'Home') {
      e.preventDefault();
      refs.current[0]?.focus();
      onChange(options[0].key);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = options.length - 1;
      refs.current[last]?.focus();
      onChange(options[last].key);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Sub navigation"
      className="bg-surface-raised border-border mb-5 flex w-fit gap-1 rounded-xl border p-1"
    >
      {options.map(({ key, label }, idx) => (
        <button
          key={key}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          role="tab"
          aria-selected={active === key}
          tabIndex={active === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            active === key
              ? 'bg-bg text-text border-border border shadow-sm'
              : 'text-text-3 hover:text-text-2'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
