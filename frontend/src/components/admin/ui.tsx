'use client';

// Small building blocks shared by the admin pages
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

type Tone = 'neutral' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'border-line text-ink-soft',
  warn: 'border-warn/50 text-warn',
  danger: 'border-danger/50 text-danger',
};

/** Status label. The text carries the meaning; the colour only backs it up. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const BTN = 'h-8 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Two-step button: the first click asks "Sure?", the second runs the action.
 * Focus lands on Cancel so a stray Enter does not confirm.
 */
export function ConfirmAction({
  label,
  ariaLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  ariaLabel: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={`${BTN} border-line text-ink/80 hover:border-ink/40 hover:text-ink`}
      >
        {label}
      </button>
    );
  }

  return (
    <span role="group" aria-label={t('admin.confirmGroup', { label: ariaLabel })} className="inline-flex items-center gap-2">
      <span className="text-sm text-ink-soft">{t('admin.sure')}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
        className={`${BTN} border-danger/60 text-danger hover:bg-danger/10`}
      >
        {busy ? t('admin.working') : t('admin.yes')}
      </button>
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={() => setAsking(false)}
        className={`${BTN} border-line text-ink/80 hover:border-ink/40 hover:text-ink`}
      >
        {t('admin.cancel')}
      </button>
    </span>
  );
}
