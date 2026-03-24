'use client';

import { useMemo, useState } from 'react';

import { INSTALLATIONS } from '@/lib/pay-tables';

// Sorted unique states from the installations table
const STATES = [...new Set(INSTALLATIONS.map((i) => i.state))].sort();

interface Props {
  value: string; // installation name (matches INSTALLATIONS[].name)
  onChange: (name: string) => void;
  className?: string;
}

export default function DutyStationSelect({
  value,
  onChange,
  className = '',
}: Props) {
  // Derive the current state from the current value, defaulting to the first state
  const currentState = INSTALLATIONS.find((i) => i.name === value)?.state ?? '';

  const [selectedState, setSelectedState] = useState(currentState);

  const installations = useMemo(
    () => INSTALLATIONS.filter((i) => i.state === selectedState),
    [selectedState],
  );

  function handleStateChange(state: string) {
    setSelectedState(state);
    // Reset to first installation in the new state, or clear
    const first = INSTALLATIONS.find((i) => i.state === state);
    onChange(first?.name ?? '');
  }

  const selectCls = `text-sm bg-bg border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-blue-600 transition-colors ${className}`;

  return (
    <div className="flex gap-2">
      {/* State picker */}
      <select
        value={selectedState}
        onChange={(e) => handleStateChange(e.target.value)}
        className={`w-20 shrink-0 ${selectCls}`}
        aria-label="State"
      >
        <option value="">State</option>
        {STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Installation picker */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!selectedState}
        className={`flex-1 ${selectCls} disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Installation"
      >
        {!selectedState && <option value="">Select a state first</option>}
        {installations.map((i) => (
          <option key={i.name} value={i.name}>
            {i.name}
          </option>
        ))}
      </select>
    </div>
  );
}
