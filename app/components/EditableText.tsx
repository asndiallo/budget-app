'use client';

import { useEffect, useState } from 'react';

export default function EditableText({
  value,
  placeholder,
  className,
  onSave,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

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
        className={`${className} border-b border-[#4a8cff]/50 bg-transparent outline-none w-full`}
      />
    );
  }
  return (
    <span
      className={`${className} cursor-pointer hover:opacity-70 transition-opacity truncate ${!value ? 'opacity-30' : ''}`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}
