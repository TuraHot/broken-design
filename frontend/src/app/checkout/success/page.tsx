'use client';

// Checkout Success page — displays confirmed purchase, embed_key, embed snippets, and .glb download.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  KeyRound,
  Library,
  Loader2,
} from 'lucide-react';
import { fetchMyPurchases } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { readSession, SESSION_UPDATED_EVENT } from '@/lib/session';
import { useT } from '@/lib/i18n/client';
import { fromErr, msgText, serverError, type Msg } from '@/lib/i18n/msg';
import {
  buildIframeSnippet,
  buildVmModelSnippet,
  DEFAULT_EMBED_ORIGIN,
  DownloadError,
  downloadModelGlb,
} from '@/lib/model-assets';
import type { PurchaseItem } from '@/lib/types';

const CARD = 'rounded-lg border border-line bg-ink/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-accent';

function CheckoutSuccessContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get('purchaseId');

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<Msg | null>(null);
  const [origin, setOrigin] = useState(DEFAULT_EMBED_ORIGIN);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    const syncSession = () => {
      const nextToken = readSession()?.token ?? null;
      setToken(nextToken);
      setReady(true);
      if (!nextToken) {
        setPurchase(null);
        setLoading(false);
      }
    };
    syncSession();
    window.addEventListener('storage', syncSession);
    window.addEventListener(SESSION_UPDATED_EVENT, syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener(SESSION_UPDATED_EVENT, syncSession);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setLoading(true);
    (async () => {
      try {
        const list = await fetchMyPurchases(token);
        if (!active) return;
        const found = purchaseId
          ? list.find((item) => item.id === purchaseId) ?? null
          : list[0] ?? null;
        setPurchase(found);
        setErrorMsg(found ? null : { key: 'pay.errNoPaid' });
      } catch (err: any) {
        if (active) setErrorMsg(fromErr(err, 'pay.errLoadPurchase'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, purchaseId]);

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(label);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownload = async () => {
    if (!token || !purchase || downloading) return;
    try {
      setDownloading(true);
      setErrorMsg(null);
      await downloadModelGlb(purchase.modelId, purchase.title, token);
    } catch (err: any) {
      if (err instanceof DownloadError && err.serverMessage) {
        setErrorMsg(fromErr(serverError(err.serverMessage), 'pay.errDownload'));
      } else {
        setErrorMsg(fromErr(err, 'pay.errDownload'));
      }
    } finally {
      setDownloading(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className={`${CARD} flex items-center gap-3 text-ink/70`}>
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span className="font-mono text-xs uppercase tracking-wider">{t('pay.loadingConfirm')}</span>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={CARD}>
        <p className={LABEL}>{t('pay.crumb')}</p>
        <h1 className="mt-2 font-display text-2xl uppercase text-ink">{t('pay.signInTitle')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t('pay.signInView')}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
        >
          {t('pay.login')}
        </Link>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className={CARD}>
        <p className={LABEL}>{t('pay.crumb')}</p>
        <h1 className="mt-2 font-display text-2xl uppercase text-ink">{t('pay.success.notFound')}</h1>
        <p className="mt-2 text-sm text-warn">{errorMsg ? msgText(errorMsg, t) : t('pay.success.notFoundBody')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/me"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
          >
            {t('pay.goLibrary')}
          </Link>
          <Link
            href="/gallery"
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/10"
          >
            {t('pay.browseGallery')}
          </Link>
        </div>
      </div>
    );
  }

  const webComponentSnippet = buildVmModelSnippet({
    origin,
    modelId: purchase.modelId,
    embedKey: purchase.embedKey,
    multiline: true,
  });
  const iframeSnippet = buildIframeSnippet({
    origin,
    modelId: purchase.modelId,
    embedKey: purchase.embedKey,
  });

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <div className="flex items-center gap-2 text-accent">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-mono text-xs uppercase tracking-wider">{t('pay.paidTitle')}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl uppercase text-ink sm:text-3xl">{purchase.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {t('pay.success.paid', {
            amount: formatMoney(purchase.amountCents, purchase.currency || 'USD'),
            license: purchase.licenseType,
            date: formatDate(purchase.paidAt),
          })}
        </p>

        {/* Embed Key Box */}
        <div className="mt-6 rounded-lg border border-accent/40 bg-canvas/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-accent">
              <KeyRound className="h-3.5 w-3.5" />
              {t('pay.success.key')}
            </span>
            <button
              type="button"
              onClick={() => handleCopy('key', purchase.embedKey)}
              className="inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1 font-mono text-[11px] text-ink/80 transition-colors hover:bg-ink/10"
            >
              {copiedTarget === 'key' ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedTarget === 'key' ? t('pay.success.copied') : t('pay.success.copyKey')}
            </button>
          </div>
          <div className="mt-2 break-all font-mono text-xs text-ink select-all sm:text-sm">
            {purchase.embedKey}
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="mt-4 text-sm text-warn">
            {msgText(errorMsg, t)}
          </p>
        )}

        {/* Primary Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-canvas transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? t('pay.success.downloading') : t('pay.success.download')}
          </button>
          <Link
            href="/me"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <Library className="h-4 w-4" />
            {t('pay.goLibrary')}
          </Link>
          <Link
            href={`/models/${purchase.modelId}`}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-ink/80 transition-colors hover:bg-ink/10"
          >
            {t('pay.success.viewModel')}
          </Link>
        </div>
      </section>

      {/* Embed Snippets */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-accent" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-ink">{t('pay.success.embedTitle')}</h2>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink/60">
                {t('pay.success.webComponent')}
              </span>
              <button
                type="button"
                onClick={() => handleCopy('vm', webComponentSnippet)}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
              >
                {copiedTarget === 'vm' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedTarget === 'vm' ? t('pay.success.copied') : t('pay.success.copy')}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-card p-3 font-mono text-xs text-ink/80">
              <code>{webComponentSnippet}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink/60">{t('pay.success.iframe')}</span>
              <button
                type="button"
                onClick={() => handleCopy('iframe', iframeSnippet)}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
              >
                {copiedTarget === 'iframe' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedTarget === 'iframe' ? t('pay.success.copied') : t('pay.success.copy')}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-card p-3 font-mono text-xs text-ink/80">
              <code>{iframeSnippet}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  const t = useT();
  return (
    <main className="mx-auto max-w-[920px] px-4 pb-16 pt-24 md:px-6">
      <Suspense
        fallback={
          <div className={`${CARD} flex items-center gap-3 text-ink/70`}>
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="font-mono text-xs uppercase tracking-wider">{t('pay.loading')}</span>
          </div>
        }
      >
        <CheckoutSuccessContent />
      </Suspense>
    </main>
  );
}
