'use client';

// Donate box. Payments are not connected yet, so the button only validates the amount and shows a status line.
import { useId, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

const PRESETS = [3, 5, 10];
const MIN = 1;
const MAX = 500;

export default function DonateCard({ creator }: { creator: string }) {
  const t = useT();
  const [preset, setPreset] = useState<number | 'custom'>(5);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(false);
  const customId = useId();
  const messageId = useId();

  const amount = preset === 'custom' ? Number.parseInt(custom, 10) : preset;
  const valid = Number.isInteger(amount) && amount >= MIN && amount <= MAX;

  const submit = () => {
    if (!valid) {
      setNotice(false);
      setError(true);
      return;
    }
    setError(false);
    setNotice(true);
  };

  const chip = (active: boolean) =>
    `rounded-lg border px-2 py-2 text-center text-sm transition-colors ${
      active ? 'border-ink/60 text-ink' : 'border-line text-ink-soft hover:text-ink'
    }`;

  return (
    <section aria-labelledby="donate-title" className="rounded-lg border border-line bg-ink/5 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('donate.label')}</p>
      <h2 id="donate-title" className="mt-2 font-display text-lg uppercase leading-snug text-ink">
        {t('donate.title')}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{t('donate.thanks', { creator })}</p>

      <div role="group" aria-label={t('donate.amountGroup')} className="mt-4 grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)} className={chip(preset === p)}>
            ${p}
          </button>
        ))}
        <button type="button" aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')} className={chip(preset === 'custom')}>
          {t('donate.other')}
        </button>
      </div>

      {preset === 'custom' && (
        <div className="mt-3">
          <label htmlFor={customId} className="text-sm text-ink-soft">
            {t('donate.amountUsd')}
          </label>
          <input
            id={customId}
            inputMode="numeric"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value.replace(/\D/g, '').slice(0, 3));
              setError(false);
              setNotice(false);
            }}
            aria-invalid={!!error}
            className="mt-1 h-10 w-full rounded-lg border border-line bg-ink/5 px-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none"
            placeholder="25"
          />
        </div>
      )}

      <div className="mt-3">
        <label htmlFor={messageId} className="text-sm text-ink-soft">
          {t('donate.message')}
        </label>
        <textarea
          id={messageId}
          value={message}
          maxLength={200}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full resize-none rounded-lg border border-line bg-ink/5 px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none"
          placeholder={t('donate.placeholder')}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
          {t('donate.errAmount', { min: MIN, max: MAX })}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        className="mt-4 h-10 w-full rounded-lg bg-ink px-3.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85"
      >
        {valid ? t('donate.button', { amount }) : t('donate.title')}
      </button>
      {notice && (
        <p role="status" className="mt-2 text-sm text-warn">
          {t('donate.notConnected')}
        </p>
      )}
      <p className="mt-4 text-sm text-ink/40">{t('donate.none')}</p>
    </section>
  );
}
