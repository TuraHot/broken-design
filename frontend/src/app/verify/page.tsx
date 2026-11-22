'use client';

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { CDN_SERVICE_URL } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

const MAX_BYTES = 50 * 1024 * 1024;
const CARD = 'rounded-lg border border-line bg-ink/5 p-5 sm:p-6';

interface VerifyResult {
  isValidMetadata: boolean;
  isValidVertexWatermark: boolean;
  vertexBitMatchRatio: number;
  extractedMetadata: Record<string, unknown> | null;
}

export default function VerifyWatermarkPage() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [expectedModelId, setExpectedModelId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<{ key: MessageKey } | { text: string } | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const selectFile = (candidate: File | null | undefined) => {
    if (!candidate) return;
    setResult(null);
    if (!candidate.name.toLowerCase().endsWith('.glb')) {
      setFile(null);
      setErrorMsg({ key: 'verify.errExt' });
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setFile(null);
      setErrorMsg({ key: 'verify.errSize' });
      return;
    }
    setErrorMsg(null);
    setFile(candidate);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (checking) return;
    if (!file) {
      setErrorMsg({ key: 'verify.errRequired' });
      return;
    }

    setChecking(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file);
      if (expectedModelId.trim()) {
        form.append('expectedModelId', expectedModelId.trim());
      }

      const res = await fetch(`${CDN_SERVICE_URL}/cdn/verify-watermark`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error?.message;
        setErrorMsg(msg ? { text: msg } : { key: 'verify.errNetwork' });
        return;
      }

      setResult(data as VerifyResult);
    } catch {
      setErrorMsg({ key: 'verify.errNetwork' });
    } finally {
      setChecking(false);
    }
  };

  const meta = result?.extractedMetadata ?? null;
  const resolvedModelId =
    (typeof meta?.modelId === 'string' && meta.modelId) ||
    (typeof meta?.recoveredModelId === 'string' && meta.recoveredModelId) ||
    null;
  const resolvedOwnerId =
    (typeof meta?.ownerId === 'string' && meta.ownerId) ||
    (typeof meta?.recoveredOwnerId === 'string' && meta.recoveredOwnerId) ||
    null;
  const resolvedTitle = typeof meta?.recoveredTitle === 'string' ? meta.recoveredTitle : null;
  const resolvedPurchaseId = typeof meta?.purchaseId === 'string' ? meta.purchaseId : null;
  const resolvedLicense = typeof meta?.license === 'string' ? meta.license : null;
  const resolvedIssuedAt = typeof meta?.issuedAt === 'string' ? meta.issuedAt : null;
  const resolvedSignature = typeof meta?.signature === 'string' ? meta.signature : null;

  const pct = result ? Math.round((result.vertexBitMatchRatio || 0) * 100) : 0;
  const anyValid = Boolean(result && (result.isValidMetadata || result.isValidVertexWatermark));

  return (
    <main className="mx-auto max-w-[900px] px-4 pb-16 pt-28 md:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('verify.eyebrow')}</p>
      <h1 className="mt-3 font-display text-[clamp(24px,3.2vw,34px)] uppercase leading-tight text-ink">
        {t('verify.title')}
      </h1>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">{t('verify.lead')}</p>

      <form onSubmit={handleVerify} className={`mt-8 ${CARD} space-y-5`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition-colors ${
            dragging ? 'border-accent bg-accent/10' : 'border-line bg-canvas/40 hover:border-ink/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            onChange={onFileChange}
            className="hidden"
          />
          {file ? (
            <>
              <FileCheck2 aria-hidden className="h-8 w-8 text-accent" />
              <p className="mt-3 break-all text-sm font-medium text-ink">{file.name}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {(file.size / (1024 * 1024)).toFixed(2)} MB · {t('verify.changeFile')}
              </p>
            </>
          ) : (
            <>
              <Upload aria-hidden className="h-8 w-8 text-ink-soft" />
              <p className="mt-3 text-sm font-medium text-ink">{t('verify.dropPrompt')}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">{t('verify.fileLimits')}</p>
            </>
          )}
        </div>

        <div>
          <label htmlFor="expected-model-id" className="block text-sm font-medium text-ink">
            {t('verify.modelIdLabel')}
          </label>
          <input
            id="expected-model-id"
            type="text"
            value={expectedModelId}
            onChange={(e) => setExpectedModelId(e.target.value)}
            placeholder={t('verify.modelIdPlaceholder')}
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas/40 px-3 font-mono text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none"
          />
        </div>

        {errorMsg && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{'key' in errorMsg ? t(errorMsg.key) : errorMsg.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={checking || !file}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking && <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {checking ? t('verify.checking') : t('verify.submit')}
        </button>
      </form>

      {result && (
        <section aria-labelledby="verify-result-title" className={`mt-6 ${CARD} space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              {anyValid ? (
                <ShieldCheck aria-hidden className="h-6 w-6 text-accent" />
              ) : (
                <ShieldAlert aria-hidden className="h-6 w-6 text-warn" />
              )}
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t('verify.resultTitle')}
                </p>
                <h2 id="verify-result-title" className="text-base font-semibold text-ink">
                  {result.isValidMetadata
                    ? t('verify.statusVerified')
                    : result.isValidVertexWatermark
                      ? t('verify.statusPartial')
                      : t('verify.statusNone')}
                </h2>
              </div>
            </div>

            {resolvedModelId && (
              <Link
                href={`/models/${encodeURIComponent(resolvedModelId)}`}
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20"
              >
                {t('verify.viewModel')}
              </Link>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-canvas/40 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                {t('verify.layer1Label')}
              </p>
              <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-medium ${result.isValidMetadata ? 'text-accent' : 'text-ink-soft'}`}>
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
                {result.isValidMetadata ? t('verify.layer1Pass') : t('verify.layer1Fail')}
              </p>
            </div>

            <div className="rounded-lg border border-line bg-canvas/40 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                {t('verify.layer2Label')}
              </p>
              <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-medium ${result.isValidVertexWatermark ? 'text-accent' : 'text-ink-soft'}`}>
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
                {result.isValidVertexWatermark
                  ? t('verify.layer2Pass', { pct })
                  : t('verify.layer2Fail', { pct })}
              </p>
            </div>
          </div>

          {(resolvedModelId || resolvedOwnerId || resolvedPurchaseId || resolvedLicense) && (
            <div className="rounded-lg border border-line bg-canvas/40 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                {t('verify.detailsLabel')}
              </p>
              <dl className="mt-3 divide-y divide-line text-sm">
                {resolvedTitle && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldTitle')}</dt>
                    <dd className="break-words text-ink">{resolvedTitle}</dd>
                  </div>
                )}
                {resolvedModelId && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldModel')}</dt>
                    <dd className="break-all font-mono text-xs text-ink">{resolvedModelId}</dd>
                  </div>
                )}
                {resolvedOwnerId && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldOwner')}</dt>
                    <dd className="break-all font-mono text-xs text-ink">{resolvedOwnerId}</dd>
                  </div>
                )}
                {resolvedPurchaseId && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldPurchase')}</dt>
                    <dd className="break-all font-mono text-xs text-ink">{resolvedPurchaseId}</dd>
                  </div>
                )}
                {resolvedLicense && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldLicense')}</dt>
                    <dd className="font-mono text-xs text-ink">{resolvedLicense}</dd>
                  </div>
                )}
                {resolvedIssuedAt && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldIssued')}</dt>
                    <dd className="font-mono text-xs text-ink">{formatDate(resolvedIssuedAt)}</dd>
                  </div>
                )}
                {resolvedSignature && (
                  <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-ink-soft">{t('verify.fieldSig')}</dt>
                    <dd className="break-all font-mono text-xs text-ink-soft">{resolvedSignature}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
