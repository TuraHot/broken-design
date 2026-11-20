'use client';

// Dropdown button for one gallery filter — updates the URL query parameter when an option is selected.
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { buildHref } from '@/lib/pagination';
import type { License, ModelsParams } from '@/lib/types';

export default function FilterDropdown({
  label,
  paramKey,
  options,
  params = {},
}: {
  label: string;
  paramKey: 'tag' | 'license' | 'price';
  /** `value` goes into the URL, `label` is shown. The first option means "no filter". */
  options: readonly { value: string; label: string }[];
  params?: ModelsParams;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const currentParam = params[paramKey];
  const current = options.find((o) => o.value.toLowerCase() === currentParam?.toLowerCase()) ?? options[0];
  const chosen = current !== options[0];

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

  const selectOption = (o: { value: string; label: string }) => {
    if (isPending) return;
    setOpen(false);
    const isAll = o === options[0];
    const next: ModelsParams = { ...params, page: 1 };
    if (paramKey === 'tag') {
      next.tag = isAll ? undefined : o.value.toLowerCase();
    } else if (paramKey === 'license') {
      next.license = isAll ? undefined : (o.value.toUpperCase() as License);
    } else if (paramKey === 'price') {
      next.price = isAll ? undefined : (o.value.toLowerCase() as 'free' | 'paid');
    }
    startTransition(() => {
      router.push(buildHref(next));
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
          chosen ? 'border-ink text-ink' : 'border-line text-ink-soft hover:border-ink/40 hover:text-ink'
        } bg-ink/5`}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{label}</span>
        <span>{current.label}</span>
        {isPending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin text-accent motion-reduce:animate-none" />
        ) : (
          <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <ul
          aria-label={label}
          className="absolute right-0 top-full z-20 mt-2 max-h-72 min-w-[160px] overflow-auto rounded-lg border border-line bg-canvas/95 p-1 backdrop-blur"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                aria-pressed={o === current}
                onClick={() => selectOption(o)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-ink/10 ${
                  o === current ? 'text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {o.label}
                {o === current && <Check aria-hidden className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
