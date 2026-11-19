'use client';

// Centered Ko-fi-style Checkout Summary page — QR Payment only (PromptPay via Stripe API or Mock).
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, QrCode } from 'lucide-react';
import { confirmMockPayment, createQrPayment, fetchPurchaseById } from '@/lib/api';
import { initials } from '@/lib/creators';
import { formatMoney } from '@/lib/format';
import { readSession } from '@/lib/session';
import type { PurchaseDetail, QrPaymentResponse } from '@/lib/types';

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [qrInfo, setQrInfo] = useState<QrPaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        if (active) setErrorMsg(err?.message || 'Unable to load order.');
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
      const res = await createQrPayment(purchase.id, token);
      setQrInfo(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to generate QR payment.');
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
      setErrorMsg(err?.message || 'Payment confirmation failed.');
      setSubmitting(false);
    }
  };

  if (!ready || loading) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin text-hud" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading checkout…</span>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#0b0d12] p-6 text-center shadow-2xl">
          <h1 className="font-display text-xl uppercase text-white">Sign in required</h1>
          <p className="mt-2 text-sm text-white/65">Please sign in to continue to QR checkout.</p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-medium text-black transition-colors hover:bg-white/85"
          >
            Log in
          </Link>
        </div>
      </main>
    );
  }

  if (!purchase) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#0b0d12] p-6 text-center shadow-2xl">
          <h1 className="font-display text-xl uppercase text-white">Order not found</h1>
          <p className="mt-2 text-sm text-amber">{errorMsg || 'This order could not be found.'}</p>
          <Link
            href="/gallery"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-white/20 px-5 text-sm text-white/80 hover:bg-white/10"
          >
            Back to Gallery
          </Link>
        </div>
      </main>
    );
  }

  const sellerName = purchase.sellerName || 'Creator';
  const priceText = formatMoney(purchase.amountCents, purchase.currency || 'USD');

  if (purchase.status === 'paid') {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#0b0d12] p-6 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto h-10 w-10 text-hud" />
          <h1 className="mt-3 font-display text-xl uppercase text-white">Payment Confirmed</h1>
          <p className="mt-1.5 text-sm text-white/65">{purchase.title}</p>
          <Link
            href={`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-medium text-black transition-colors hover:bg-white/85"
          >
            View Embed Key &amp; Download
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 pt-20 pb-12">
      <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#0b0d12] p-6 shadow-2xl sm:p-7">
        {/* Seller header (Ko-fi prototype style) */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-hud/40 bg-hud/10 font-mono text-[11px] text-hud">
            {initials(sellerName)}
          </span>
          <p className="text-sm font-medium text-white">
            {sellerName} <span className="font-normal text-white/50">(Seller)</span>
          </p>
        </div>

        <p className="mt-3 text-center text-xs text-white/55">
          Signed in as <span className="text-white/80">{email}</span>
        </p>

        {/* Item card */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{purchase.title}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-white/50">
              {purchase.licenseType}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-white">{priceText}</span>
        </div>

        {/* Highlighted Total bar */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-hud/25 bg-hud/10 px-4 py-3">
          <span className="text-sm font-medium text-white">Total</span>
          <span className="font-mono text-sm font-semibold text-hud">{priceText}</span>
        </div>

        <div className="mt-2.5 text-right">
          <Link href={`/models/${purchase.modelId}`} className="text-xs text-hud hover:underline">
            Continue shopping
          </Link>
        </div>

        {/* Buyer Info */}
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="checkout-email" className="block text-xs font-medium text-white/85">
              Email address
            </label>
            <input
              id="checkout-email"
              type="email"
              value={email}
              readOnly
              className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white/75 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="checkout-name" className="block text-xs font-medium text-white/85">
              Your display name
            </label>
            <p className="mt-0.5 text-[11px] text-white/45">
              Enter your name as you&apos;d like it to be shown to the creator
            </p>
            <input
              id="checkout-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-hud/60 focus:outline-none"
            />
          </div>
        </div>

        {/* Payment Method: QR Only */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <QrCode className="h-4 w-4 text-hud" />
              PromptPay QR Payment
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-hud/80">QR Only</span>
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
            {errorMsg}
          </p>
        )}

        {/* Step 1: Checkout now button OR Step 2: QR Display */}
        {!qrInfo ? (
          <button
            type="button"
            disabled={submitting}
            onClick={handleCheckoutNow}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Generating QR…' : 'Checkout now'}
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-hud/35 bg-black/70 p-4 text-center">
            {qrInfo.provider === 'stripe' && qrInfo.qrImageUrl ? (
              <>
                <p className="font-mono text-xs uppercase tracking-wider text-hud">
                  Scan PromptPay QR ({formatMoney(qrInfo.amountSatang, 'THB')})
                </p>
                <div className="mx-auto mt-3 inline-block rounded-xl bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrInfo.qrImageUrl}
                    alt="PromptPay QR Code"
                    className="h-48 w-48 object-contain"
                  />
                </div>
                <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[11px] text-white/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-hud" />
                  Waiting for payment confirmation…
                </p>
                {qrInfo.hostedUrl && (
                  <a
                    href={qrInfo.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-hud hover:underline"
                  >
                    Open Stripe QR instructions
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="font-mono text-xs uppercase tracking-wider text-amber">
                  Mock QR Mode ({formatMoney(qrInfo.amountSatang, 'THB')})
                </p>
                <div className="mx-auto mt-3 grid h-40 w-40 place-items-center rounded-xl border border-dashed border-white/25 bg-white/5">
                  <QrCode className="h-24 w-24 text-white/80" />
                </div>
                <p className="mt-2 text-xs text-white/55">
                  Set <code className="text-white/80">PAYMENT_PROVIDER=stripe</code> in{' '}
                  <code className="text-white/80">core-api/.env</code> for live PromptPay QR.
                </p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleMockConfirm}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white text-xs font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm QR Payment (Mock)
                </button>
              </>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-white/45">
          Questions, refunds or issues: contact {sellerName}.
        </p>
      </div>
    </main>
  );
}
