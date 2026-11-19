'use client';

// Checkout Success page — displays confirmed purchase, embed_key, embed snippets, and .glb download.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
import { CDN_SERVICE_URL, fetchMyPurchases } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { readSession } from '@/lib/session';
import { useT } from '@/lib/i18n/client';
import { fromErr, msgText, serverError, type Msg } from '@/lib/i18n/msg';
import type { PurchaseItem } from '@/lib/types';

const CARD = 'rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

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

  useEffect(() => {
    const session = readSession();
    setToken(session?.token ?? null);
    setReady(true);

    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const list = await fetchMyPurchases(session.token);
        if (!active) return;
        const found = purchaseId
          ? list.find((item) => item.id === purchaseId) ?? null
          : list[0] ?? null;
        setPurchase(found);
        if (!found) setErrorMsg({ key: 'pay.errNoPaid' });
      } catch (err: any) {
        if (active) setErrorMsg(fromErr(err, 'pay.errLoadPurchase'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [purchaseId]);

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(label);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownload = async () => {
    if (!token || !purchase || downloading) return;
    try {
      setDownloading(true);
      setErrorMsg(null);
      const res = await fetch(
        `${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(purchase.modelId)}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw body?.error?.message ? serverError(body.error.message) : new Error('download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName =
        purchase.title.replace(/[^\w\u0E00-\u0E7F-]+/g, '_').replace(/^_+|_+$/g, '') || 'model';
      a.download = `${safeName}.glb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(fromErr(err, 'pay.errDownload'));
    } finally {
      setDownloading(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className={`${CARD} flex items-center gap-3 text-white/70`}>
        <Loader2 className="h-5 w-5 animate-spin text-hud" />
        <span className="font-mono text-xs uppercase tracking-wider">{t('pay.loadingConfirm')}</span>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={CARD}>
        <p className={LABEL}>{t('pay.crumb')}</p>
        <h1 className="mt-2 font-display text-2xl uppercase text-white">{t('pay.signInTitle')}</h1>
        <p className="mt-2 text-sm text-white/65">{t('pay.signInView')}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
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
        <h1 className="mt-2 font-display text-2xl uppercase text-white">{t('pay.success.notFound')}</h1>
        <p className="mt-2 text-sm text-amber">{errorMsg ? msgText(errorMsg, t) : t('pay.success.notFoundBody')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/me"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
          >
            {t('pay.goLibrary')}
          </Link>
          <Link
            href="/gallery"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            {t('pay.browseGallery')}
          </Link>
        </div>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const webComponentSnippet = `<script type="module" src="${origin}/embed.js"></script>\n<vm-model\n  model-id="${purchase.modelId}"\n  cdn-base="${CDN_SERVICE_URL}"\n  key="${purchase.embedKey}"\n  auto-rotate\n  camera-controls\n></vm-model>`;
  const iframeSnippet = `<iframe\n  src="${origin}/embed/${purchase.modelId}?key=${purchase.embedKey}"\n  width="600"\n  height="400"\n  loading="lazy"\n  allow="fullscreen"\n  style="border:0"\n></iframe>`;

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <div className="flex items-center gap-2 text-hud">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-mono text-xs uppercase tracking-wider">{t('pay.paidTitle')}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl uppercase text-white sm:text-3xl">{purchase.title}</h1>
        <p className="mt-2 text-sm text-white/65">
          {t('pay.success.paid', {
            amount: formatMoney(purchase.amountCents, purchase.currency || 'USD'),
            license: purchase.licenseType,
            date: formatDate(purchase.paidAt),
          })}
        </p>

        {/* Embed Key Box */}
        <div className="mt-6 rounded-lg border border-hud/40 bg-black/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-hud">
              <KeyRound className="h-3.5 w-3.5" />
              {t('pay.success.key')}
            </span>
            <button
              type="button"
              onClick={() => handleCopy('key', purchase.embedKey)}
              className="inline-flex items-center gap-1.5 rounded border border-white/20 px-2.5 py-1 font-mono text-[11px] text-white/80 transition-colors hover:bg-white/10"
            >
              {copiedTarget === 'key' ? <Check className="h-3.5 w-3.5 text-hud" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedTarget === 'key' ? t('pay.success.copied') : t('pay.success.copyKey')}
            </button>
          </div>
          <div className="mt-2 break-all font-mono text-xs text-white select-all sm:text-sm">
            {purchase.embedKey}
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="mt-4 text-sm text-amber">
            {msgText(errorMsg, t)}
          </p>
        )}

        {/* Primary Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? t('pay.success.downloading') : t('pay.success.download')}
          </button>
          <Link
            href="/me"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-hud/40 bg-hud/10 px-4 text-sm font-medium text-hud transition-colors hover:bg-hud/20"
          >
            <Library className="h-4 w-4" />
            {t('pay.goLibrary')}
          </Link>
          <Link
            href={`/models/${purchase.modelId}`}
            className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            {t('pay.success.viewModel')}
          </Link>
        </div>
      </section>

      {/* Embed Snippets */}
      <section className={CARD}>
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-hud" />
          <h2 className="font-mono text-xs uppercase tracking-wider text-white">{t('pay.success.embedTitle')}</h2>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-white/60">
                {t('pay.success.webComponent')}
              </span>
              <button
                type="button"
                onClick={() => handleCopy('vm', webComponentSnippet)}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-hud hover:underline"
              >
                {copiedTarget === 'vm' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedTarget === 'vm' ? t('pay.success.copied') : t('pay.success.copy')}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-[#0d0d0d] p-3 font-mono text-xs text-white/80">
              <code>{webComponentSnippet}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-white/60">{t('pay.success.iframe')}</span>
              <button
                type="button"
                onClick={() => handleCopy('iframe', iframeSnippet)}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-hud hover:underline"
              >
                {copiedTarget === 'iframe' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedTarget === 'iframe' ? t('pay.success.copied') : t('pay.success.copy')}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-[#0d0d0d] p-3 font-mono text-xs text-white/80">
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
          <div className={`${CARD} flex items-center gap-3 text-white/70`}>
            <Loader2 className="h-5 w-5 animate-spin text-hud" />
            <span className="font-mono text-xs uppercase tracking-wider">{t('pay.loading')}</span>
          </div>
        }
      >
        <CheckoutSuccessContent />
      </Suspense>
    </main>
  );
}
