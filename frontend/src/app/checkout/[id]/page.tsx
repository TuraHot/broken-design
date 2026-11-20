'use client';

// Centered Ko-fi-style Checkout Summary page — QR Payment only (PromptPay via Stripe API or Mock).
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, QrCode } from 'lucide-react';
import { confirmMockPayment, createQrPayment, fetchPurchaseById } from '@/lib/api';
import { updateProfile } from '@/lib/auth';
import { initials } from '@/lib/creators';
import { formatMoney } from '@/lib/format';
import { readSession, updateSessionUser } from '@/lib/session';
import { useT } from '@/lib/i18n/client';
import { fromErr, msgText, type Msg } from '@/lib/i18n/msg';
import type { PurchaseDetail, QrPaymentResponse } from '@/lib/types';

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [qrInfo, setQrInfo] = useState<QrPaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<Msg | null>(null);

  useEffect(() => {
    const session = readSession();
    setToken(session?.token ?? null);
    setEmail(session?.user?.email ?? '');
    setDisplayName(session?.user?.display_name ?? '');
    setReady(true);

    if (!session || !id) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const data = await fetchPurchaseById(id, session.token);
        if (active) setPurchase(data);
      } catch (err: any) {
        if (active) setErrorMsg(fromErr(err, 'pay.errLoadOrder'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  // Poll order status every 3s once Stripe QR is displayed
  useEffect(() => {
    if (!token || !purchase || !qrInfo || qrInfo.provider !== 'stripe' || purchase.status === 'paid') {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const latest = await fetchPurchaseById(purchase.id, token);
        if (latest.status === 'paid') {
          router.push(`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [token, purchase, qrInfo, router]);

  const handleCheckoutNow = async () => {
    if (!token || !purchase || submitting) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const trimmedName = displayName.trim();
      const savedName = readSession()?.user.display_name?.trim() ?? '';
      if (trimmedName && trimmedName !== savedName) {
        const updated = await updateProfile(trimmedName, token);
        updateSessionUser({ display_name: updated.display_name });
      }
      const res = await createQrPayment(purchase.id, token);
      setQrInfo(res);
    } catch (err: any) {
      setErrorMsg(fromErr(err, 'pay.errQr'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockConfirm = async () => {
    if (!token || !purchase || submitting) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await confirmMockPayment(purchase.id, token);
      router.push(`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`);
    } catch (err: any) {
      setErrorMsg(fromErr(err, 'pay.errConfirm'));
      setSubmitting(false);
    }
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink/5 px-6 py-5 text-ink/70">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="font-mono text-xs uppercase tracking-wider">{t('pay.loadingCheckout')}</span>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-[460px] rounded-2xl border border-line bg-card p-6 text-center shadow-2xl">
          <h1 className="font-display text-xl uppercase text-ink">{t('pay.signInTitle')}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t('pay.signInQr')}</p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
          >
            {t('pay.login')}
          </Link>
        </div>
      </main>
    );
  }

  if (!purchase) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-[460px] rounded-2xl border border-line bg-card p-6 text-center shadow-2xl">
          <h1 className="font-display text-xl uppercase text-ink">{t('pay.orderNotFound')}</h1>
          <p className="mt-2 text-sm text-warn">{errorMsg ? msgText(errorMsg, t) : t('pay.errOrderMissing')}</p>
          <Link
            href="/gallery"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-line px-5 text-sm text-ink/80 hover:bg-ink/10"
          >
            {t('pay.backGallery')}
          </Link>
        </div>
      </main>
    );
  }

  const sellerName = purchase.sellerName || t('pay.creator');
  const priceText = formatMoney(purchase.amountCents, purchase.currency || 'USD');

  if (purchase.status === 'paid') {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-[460px] rounded-2xl border border-line bg-card p-6 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-3 font-display text-xl uppercase text-ink">{t('pay.paidTitle')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{purchase.title}</p>
          <p className="mt-2 text-sm font-medium text-accent">{t('pay.alreadyOwned')}</p>
          <Link
            href={`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
          >
            {t('pay.viewKey')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-card p-6 shadow-2xl sm:p-7">
        {/* Seller header (Ko-fi prototype style) */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent">
            {initials(sellerName)}
          </span>
          <p className="text-sm font-medium text-ink">
            {sellerName} <span className="font-normal text-ink-soft">({t('pay.seller')})</span>
          </p>
        </div>

        <p className="mt-3 text-center text-xs text-ink-soft">
          {t('pay.signedInAs', { email })}
        </p>

        {/* Item card */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/[0.03] px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{purchase.title}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {purchase.licenseType}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-ink">{priceText}</span>
        </div>

        {/* Highlighted Total bar */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-accent/25 bg-accent/10 px-4 py-3">
          <span className="text-sm font-medium text-ink">{t('pay.total')}</span>
          <span className="font-mono text-sm font-semibold text-accent">{priceText}</span>
        </div>

        <div className="mt-2.5 text-right">
          <Link href={`/models/${purchase.modelId}`} className="text-xs text-accent hover:underline">
            {t('pay.continue')}
          </Link>
        </div>

        {/* Buyer Info */}
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="checkout-email" className="block text-xs font-medium text-ink/85">
              {t('pay.email')}
            </label>
            <input
              id="checkout-email"
              type="email"
              value={email}
              readOnly
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-ink/5 px-3 text-sm text-ink/75 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="checkout-name" className="block text-xs font-medium text-ink/85">
              {t('pay.displayName')}
            </label>
            <p className="mt-0.5 text-[11px] text-ink/45">
              {t('pay.displayNameHint')}
            </p>
            <input
              id="checkout-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-ink/5 px-3 text-sm text-ink focus:border-accent/60 focus:outline-none"
            />
          </div>
        </div>

        {/* Payment Method: QR Only */}
        <div className="mt-4 rounded-xl border border-line bg-ink/[0.03] px-3.5 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-ink">
              <QrCode className="h-4 w-4 text-accent" />
              {t('pay.method')}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent">{t('pay.qrOnly')}</span>
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
            {msgText(errorMsg, t)}
          </p>
        )}

        {/* Step 1: Checkout now button OR Step 2: QR Display */}
        {!qrInfo ? (
          <button
            type="button"
            disabled={submitting}
            onClick={handleCheckoutNow}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-canvas transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? t('pay.generating') : t('pay.checkoutNow')}
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-accent/35 bg-canvas/70 p-4 text-center">
            {qrInfo.provider === 'stripe' && qrInfo.qrImageUrl ? (
              <>
                <p className="font-mono text-xs uppercase tracking-wider text-accent">
                  {t('pay.scanQr', { amount: formatMoney(qrInfo.amountSatang, 'THB') })}
                </p>
                <div className="mx-auto mt-3 inline-block rounded-xl bg-ink p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrInfo.qrImageUrl}
                    alt={t('pay.qrAlt')}
                    className="h-48 w-48 object-contain"
                  />
                </div>
                <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[11px] text-ink/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  {t('pay.waiting')}
                </p>
                {qrInfo.hostedUrl && (
                  <a
                    href={qrInfo.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    {t('pay.stripeHelp')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="font-mono text-xs uppercase tracking-wider text-warn">
                  {t('pay.mockQr', { amount: formatMoney(qrInfo.amountSatang, 'THB') })}
                </p>
                <div className="mx-auto mt-3 grid h-40 w-40 place-items-center rounded-xl border border-dashed border-ink/25 bg-ink/5">
                  <QrCode className="h-24 w-24 text-ink/80" />
                </div>
                {process.env.NODE_ENV !== 'production' && (
                  <p className="mt-2 text-xs text-ink-soft">
                    {t('pay.mockHelp1')} <code className="text-ink/80">PAYMENT_PROVIDER=stripe</code> {t('pay.mockHelp2')}{' '}
                    <code className="text-ink/80">core-api/.env</code> {t('pay.mockHelp3')}
                  </p>
                )}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleMockConfirm}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-xs font-semibold text-canvas transition-colors hover:bg-ink/85 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('pay.confirmMock')}
                </button>
              </>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-ink/45">
          {t('pay.contactSeller', { name: sellerName })}
        </p>
      </div>
    </main>
  );
}
