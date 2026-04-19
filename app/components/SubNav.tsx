'use client';

export default function SubNav({
  options,
  active,
  onChange,
}: {
  options: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="bg-surface-raised border-border mb-5 flex w-fit gap-1 rounded-xl border p-1">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
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
