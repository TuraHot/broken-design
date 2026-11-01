'use client';

// Dropdown button for one gallery filter — UI only: the choice is remembered in local state for the look and feel,
// it does not change the list of models.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function FilterDropdown({ label, options }: { label: string; options: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(options[0]);
  const rootRef = useRef<HTMLDivElement>(null);
  const chosen = value !== options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
          chosen ? 'border-white text-white' : 'border-white/15 text-white/65 hover:border-white/30 hover:text-white'
        } bg-white/5`}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">{label}</span>
        <span>{value}</span>
        <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          aria-label={label}
          className="absolute right-0 top-full z-20 mt-2 max-h-72 min-w-[160px] overflow-auto rounded-lg border border-white/15 bg-black/95 p-1 backdrop-blur"
        >
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                aria-pressed={o === value}
                onClick={() => {
                  setValue(o);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/10 ${
                  o === value ? 'text-white' : 'text-white/65 hover:text-white'
                }`}
              >
                {o}
                {o === value && <Check aria-hidden className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
