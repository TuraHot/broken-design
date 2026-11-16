'use client';

// The complaint form. Needs a signed-in user; the API checks that again.
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_MAX,
  COMPLAINT_MIN,
  extractModelId,
  submitComplaint,
  type ComplaintCategoryValue,
} from '@/lib/complaints';
import { readSession } from '@/lib/session';

const FIELD = 'w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none';
const PRIMARY = 'inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50';

/** The form lives in the report popup. `initialModelRef`: a model link or id to start with. `onClose` closes the popup. */
export default function ReportForm({ initialModelRef = '', onClose }: { initialModelRef?: string; onClose: () => void }) {
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
      setError('Paste the link of the model you are reporting (the address of its page).');
      return;
    }
    const text = message.trim();
    if (text.length < COMPLAINT_MIN) {
      setError(`Please write at least ${COMPLAINT_MIN} characters so we can understand the problem.`);
      return;
    }

    setSending(true);
    try {
      await submitComplaint({ category, message: text, ...(modelId ? { modelId } : {}) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!ready) return <p role="status" className="text-sm text-white/65">Loading…</p>;

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-white/65">Please log in to send a report, so we can follow up with you.</p>
        <div className="mt-6 flex justify-center">
          <Link href="/login" onClick={onClose} className={PRIMARY}>Log in</Link>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-white/10 bg-white/5 p-10 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-6 w-6 text-hud" />
        <p className="mt-3 font-medium text-white">Thank you. Your report was sent.</p>
        <p className="mt-2 text-white/65">An admin will review it. Please do not send the same report again.</p>
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onClose} className={PRIMARY}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
      <div className="grid gap-5">
        <div>
          <label htmlFor="report-category" className="text-sm text-white/65">What is this about?</label>
          <select
            id="report-category"
            autoFocus
            value={category}
            onChange={(e) => setCategory(e.target.value as ComplaintCategoryValue)}
            className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus:border-white/50 focus:outline-none"
          >
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-model" className="text-sm text-white/65">
            Model link {category === 'model' ? '' : '(optional)'}
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
          <label htmlFor="report-message" className="text-sm text-white/65">What happened?</label>
          <textarea
            id="report-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={COMPLAINT_MAX}
            rows={6}
            placeholder="Describe the problem. Include anything that helps us check it."
            aria-describedby="report-count"
            className={`${FIELD} mt-1.5 py-2`}
          />
          <p id="report-count" className="mt-1.5 text-right font-mono text-[12px] text-white/65">
            {message.trim().length} / {COMPLAINT_MAX}
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-300">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" disabled={sending} className={PRIMARY}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}
