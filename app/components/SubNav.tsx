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
    <div className="flex gap-1 mb-5 p-1 bg-surface-raised rounded-xl border border-border w-fit">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            active === key
              ? 'bg-bg text-text shadow-sm border border-border'
              : 'text-text-3 hover:text-text-2'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
