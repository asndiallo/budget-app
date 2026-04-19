'use client';

import { format, isValid, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';

interface Props {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;
  // Start calendar on the selected month, or today
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-bg border-border text-text flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition-colors focus:ring-1 focus:ring-blue-500 focus:outline-none"
      >
        <span className="text-text-3 text-[11px]">📅</span>
        {selected ? (
          <span>{format(selected, 'MMM d, yyyy')}</span>
        ) : (
          <span className="text-text-4">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="bg-surface border-border absolute top-full left-0 z-60 mt-1 rounded-xl border p-3 shadow-2xl">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            captionLayout="dropdown"
            startMonth={new Date(1980, 0)}
            endMonth={new Date()}
            classNames={{
              root: 'text-xs text-text',
              months: 'flex flex-col',
              month: 'space-y-2',
              month_caption: 'flex items-center justify-center gap-1 pb-1',
              dropdowns: 'flex items-center gap-1',
              dropdown:
                'text-xs bg-bg border border-border rounded px-1.5 py-0.5 text-text focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer',
              button_previous: 'hidden',
              button_next: 'hidden',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday: 'w-8 text-center text-[10px] text-text-4 font-medium pb-1',
              week: 'flex',
              day: 'w-8 h-8 text-center p-0',
              day_button:
                'w-8 h-8 rounded-lg text-xs transition-colors hover:bg-surface-raised focus:outline-none',
              selected: '[&>button]:bg-blue-600 [&>button]:text-white [&>button]:hover:bg-blue-500',
              today: '[&>button]:font-bold [&>button]:text-[#4a8cff]',
              outside: '[&>button]:text-text-4 [&>button]:opacity-40',
              disabled: '[&>button]:opacity-20 [&>button]:cursor-not-allowed',
            }}
          />
          {selected && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-text-4 mt-2 w-full text-center text-[10px] transition-colors hover:text-[#ff4560]"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
