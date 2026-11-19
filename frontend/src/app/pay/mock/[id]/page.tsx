'use client';

// Mock Payment Checkout page — reviews order details and confirms mock payment via Core API.
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { confirmMockPayment, fetchPurchaseById } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { LICENSE_INFO } from '@/lib/licenses';
import { readSession } from '@/lib/session';
import type { License, PurchaseDetail } from '@/lib/types';

const CARD = 'rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

export default function MockPayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    setToken(session?.token ?? null);
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
        if (active) setErrorMsg(err?.message || 'Unable to load checkout details.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const handleConfirmPay = async () => {
    if (!token || !purchase || paying) return;
    try {
      setPaying(true);
      setErrorMsg(null);
      await confirmMockPayment(purchase.id, token);
      router.push(`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Payment confirmation failed.');
      setPaying(false);
    }
  };

  if (!ready || loading) {
    return (
      <main className="mx-auto max-w-[920px] px-4 pb-16 pt-28 md:px-6">
        <div className={`${CARD} flex items-center gap-3 text-white/70`}>
          <Loader2 className="h-5 w-5 animate-spin text-hud" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading checkout…</span>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-[680px] px-4 pb-16 pt-28 md:px-6">
        <div className={CARD}>
          <p className={LABEL}>[ Checkout ]</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">Sign in required</h1>
          <p className="mt-2 text-sm text-white/65">
            Please log in with the account that created this order to complete your payment.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
            >
              Log in
            </Link>
            <Link
              href="/gallery"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Back to Gallery
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!purchase) {
    return (
      <main className="mx-auto max-w-[680px] px-4 pb-16 pt-28 md:px-6">
        <div className={CARD}>
          <p className={LABEL}>[ Checkout ]</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">Order not found</h1>
          <p className="mt-2 text-sm text-amber">{errorMsg || 'This purchase does not exist or belongs to another account.'}</p>
          <Link
            href="/gallery"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Gallery
          </Link>
        </div>
      </main>
    );
  }

  const licenseKey = purchase.licenseType as License;
  const licenseInfo = LICENSE_INFO[licenseKey];
  const priceText = formatMoney(purchase.amountCents, purchase.currency || 'USD');

  if (purchase.status === 'paid') {
    return (
      <main className="mx-auto max-w-[680px] px-4 pb-16 pt-28 md:px-6">
        <div className={CARD}>
          <div className="flex items-center gap-2 text-hud">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-mono text-xs uppercase tracking-wider">Already Paid</span>
          </div>
          <h1 className="mt-3 font-display text-2xl uppercase text-white">{purchase.title}</h1>
          <p className="mt-2 text-sm text-white/65">
            This order ({priceText}) was already confirmed on {formatDate(purchase.paidAt)}.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
            >
              View Embed Key
            </Link>
            <Link
              href="/me"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Go to Library
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[920px] px-4 pb-16 pt-24 md:px-6">
      <Link
        href={`/models/${purchase.modelId}`}
        className="inline-flex items-center gap-1.5 text-sm text-white/65 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to model
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        {/* Left: Mock Payment Form */}
        <section className={CARD}>
          <p className={LABEL}>[ Mock Payment ]</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">Complete Purchase</h1>
          <p className="mt-1.5 text-sm text-white/65">
            Sandbox checkout for Lixyte. No real card or bank charge will be made.
          </p>

          <div className="mt-6 rounded-lg border border-hud/30 bg-hud/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm font-medium text-white">
                <CreditCard className="h-4 w-4 text-hud" />
                Mock Test Payment
              </div>
              <span className="rounded border border-hud/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-hud">
                Test Mode
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-white/60">
              Confirming this payment unlocks your unique <span className="text-hud">embed_key</span> and watermarked{' '}
              <span className="text-white">.glb</span> download immediately.
            </p>
          </div>

          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 font-mono text-xs text-white/65">
            <div className="flex justify-between gap-4">
              <dt>Order ID</dt>
              <dd className="truncate text-white/85">{purchase.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Created</dt>
              <dd className="text-white/85">{formatDate(purchase.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd className="uppercase text-amber">{purchase.status}</dd>
            </div>
          </dl>

          {errorMsg && (
            <p role="alert" className="mt-4 rounded border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
              {errorMsg}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              disabled={paying}
              onClick={handleConfirmPay}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirming Payment…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Confirm &amp; Pay {priceText}
                </>
              )}
            </button>
            <Link
              href={`/models/${purchase.modelId}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 px-4 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Cancel
            </Link>
          </div>
        </section>

        {/* Right: Order Summary */}
        <aside className={CARD}>
          <p className={LABEL}>[ Order Summary ]</p>
          <h2 className="mt-2 font-display text-lg uppercase text-white">{purchase.title}</h2>
          <div className="mt-2 inline-block rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
            {purchase.licenseType}
          </div>

          {licenseInfo && (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3.5 text-xs text-white/70">
              <p className="font-medium text-white">{licenseInfo.name}</p>
              <p className="mt-1 text-white/60">{licenseInfo.summary}</p>
            </div>
          )}

          <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex items-center justify-between text-white/70">
              <span>Single-item license</span>
              <span className="font-mono">{priceText}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-medium text-white">
              <span>Total</span>
              <span className="font-mono text-hud">{priceText}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-white/50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-hud/70" />
            <span>Price &amp; license are locked at checkout.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
