'use client';

// The complaint form. Needs a signed-in user; the API checks that again.
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_MAX,
  COMPLAINT_MIN,
  ComplaintError,
  extractModelId,
  submitComplaint,
  type ComplaintCategoryValue,
} from '@/lib/complaints';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { readSession } from '@/lib/session';

const FIELD = 'w-full rounded-lg border border-line bg-ink/5 px-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none';
const PRIMARY = 'inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50';

const CATEGORY_KEYS: Record<ComplaintCategoryValue, MessageKey> = {
  model: 'report.cat.model',
  account: 'report.cat.account',
  purchase: 'report.cat.purchase',
  other: 'report.cat.other',
};

/** The form lives in the report popup. `initialModelRef`: a model link or id to start with. `onClose` closes the popup. */
export default function ReportForm({ initialModelRef = '', onClose }: { initialModelRef?: string; onClose: () => void }) {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [category, setCategory] = useState<ComplaintCategoryValue>(initialModelRef ? 'model' : 'other');
  const [modelRef, setModelRef] = useState(initialModelRef);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setSignedIn(readSession() !== null);
    setReady(true);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const modelId = extractModelId(modelRef);
    if (category === 'model' && !modelId) {
      setError(t('report.errModel'));
      return;
    }
    const text = message.trim();
    if (text.length < COMPLAINT_MIN) {
      setError(t('report.errShort', { min: COMPLAINT_MIN }));
      return;
    }

    setSending(true);
    try {
      await submitComplaint({ category, message: text, ...(modelId ? { modelId } : {}) });
      setSent(true);
    } catch (err) {
      // Our own failures are translated by code; a message that came from the API is shown as the server wrote it.
      if (err instanceof ComplaintError && err.code === 'LOGIN') setError(t('report.errLogin'));
      else if (err instanceof ComplaintError && err.code === 'NETWORK') setError(t('report.errNetwork'));
      else setError(err instanceof ComplaintError && err.message ? err.message : t('report.errSend'));
    } finally {
      setSending(false);
    }
  };

  if (!ready) return <p role="status" className="text-sm text-ink-soft">{t('report.loading')}</p>;

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-line bg-ink/5 p-10 text-center">
        <p className="text-ink-soft">{t('report.loginPrompt')}</p>
        <div className="mt-6 flex justify-center">
          <Link href="/login" onClick={onClose} className={PRIMARY}>{t('report.login')}</Link>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-line bg-ink/5 p-10 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-6 w-6 text-accent" />
        <p className="mt-3 font-medium text-ink">{t('report.thanks')}</p>
        <p className="mt-2 text-ink-soft">{t('report.thanksNote')}</p>
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onClose} className={PRIMARY}>{t('report.close')}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-lg border border-line bg-ink/5 p-5 sm:p-6">
      <div className="grid gap-5">
        <div>
          <label htmlFor="report-category" className="text-sm text-ink-soft">{t('report.about')}</label>
          <select
            id="report-category"
            autoFocus
            value={category}
            onChange={(e) => setCategory(e.target.value as ComplaintCategoryValue)}
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus:border-ink/50 focus:outline-none"
          >
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{t(CATEGORY_KEYS[c.value])}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-model" className="text-sm text-ink-soft">
            {category === 'model' ? t('report.modelLink') : t('report.modelLinkOptional')}
          </label>
          <input
            id="report-model"
            type="text"
            value={modelRef}
            onChange={(e) => setModelRef(e.target.value)}
            placeholder="http://…/models/…"
            autoComplete="off"
            className={`${FIELD} mt-1.5 h-10`}
          />
        </div>

        <div>
          <label htmlFor="report-message" className="text-sm text-ink-soft">{t('report.whatHappened')}</label>
          <textarea
            id="report-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={COMPLAINT_MAX}
            rows={6}
            placeholder={t('report.placeholder')}
            aria-describedby="report-count"
            className={`${FIELD} mt-1.5 py-2`}
          />
          <p id="report-count" className="mt-1.5 text-right font-mono text-[12px] text-ink-soft">
            {message.trim().length} / {COMPLAINT_MAX}
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" disabled={sending} className={PRIMARY}>
          {sending ? t('report.sending') : t('report.send')}
        </button>
      </div>
    </form>
  );
}
