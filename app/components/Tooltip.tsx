'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
}

export default function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    timer.current = setTimeout(() => {
      if (triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setPos({
          x: r.left + r.width / 2,
          y: side === 'top' ? r.top - 8 : r.bottom + 8,
        });
      }
      setVisible(true);
    }, 150);
  }

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            className="border-border bg-surface text-text-2 pointer-events-none fixed z-[9999] w-max max-w-[220px] rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug shadow-xl"
            style={{
              left: pos.x,
              top: pos.y,
              transform: side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
          >
            {content}
            <span
              className={`absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent ${
                side === 'top' ? 'border-t-border top-full' : 'border-b-border bottom-full'
              }`}
            />
          </span>,
          document.body,
        )}
    </span>
  );
}
