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
import { LICENSE_INFO, LICENSE_INFO_TH } from '@/lib/licenses';
import { readSession } from '@/lib/session';
import { useLocale, useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { fromErr, msgText, type Msg } from '@/lib/i18n/msg';
import type { License, PurchaseDetail } from '@/lib/types';

const CARD = 'rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

export default function MockPayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<Msg | null>(null);

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
        if (active) setErrorMsg(fromErr(err, 'pay.errLoadCheckout'));
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
      setErrorMsg(fromErr(err, 'pay.errConfirm'));
      setPaying(false);
    }
  };

  if (!ready || loading) {
    return (
      <main className="mx-auto max-w-[920px] px-4 pb-16 pt-28 md:px-6">
        <div className={`${CARD} flex items-center gap-3 text-white/70`}>
          <Loader2 className="h-5 w-5 animate-spin text-hud" />
          <span className="font-mono text-xs uppercase tracking-wider">{t('pay.loadingCheckout')}</span>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-[680px] px-4 pb-16 pt-28 md:px-6">
        <div className={CARD}>
          <p className={LABEL}>{t('pay.crumb')}</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">{t('pay.signInTitle')}</h1>
          <p className="mt-2 text-sm text-white/65">
            {t('pay.signInOrder')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
            >
              {t('pay.login')}
            </Link>
            <Link
              href="/gallery"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              {t('pay.backGallery')}
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
          <p className={LABEL}>{t('pay.crumb')}</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">{t('pay.orderNotFound')}</h1>
          <p className="mt-2 text-sm text-amber">{errorMsg ? msgText(errorMsg, t) : t('pay.errOrderOther')}</p>
          <Link
            href="/gallery"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('pay.backGallery')}
          </Link>
        </div>
      </main>
    );
  }

  const licenseKey = purchase.licenseType as License;
  const licenseInfo = (locale === 'th' ? LICENSE_INFO_TH : LICENSE_INFO)[licenseKey];
  const statusLabel = ['pending', 'paid', 'failed'].includes(purchase.status)
    ? t(`pay.status.${purchase.status}` as MessageKey)
    : purchase.status;
  const priceText = formatMoney(purchase.amountCents, purchase.currency || 'USD');

  if (purchase.status === 'paid') {
    return (
      <main className="mx-auto max-w-[680px] px-4 pb-16 pt-28 md:px-6">
        <div className={CARD}>
          <div className="flex items-center gap-2 text-hud">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-mono text-xs uppercase tracking-wider">{t('pay.mock.alreadyPaid')}</span>
          </div>
          <h1 className="mt-3 font-display text-2xl uppercase text-white">{purchase.title}</h1>
          <p className="mt-2 text-sm text-white/65">
            {t('pay.mock.alreadyBody', { amount: priceText, date: formatDate(purchase.paidAt) })}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/checkout/success?purchaseId=${encodeURIComponent(purchase.id)}`}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
            >
              {t('pay.mock.viewKey')}
            </Link>
            <Link
              href="/me"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              {t('pay.goLibrary')}
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
        {t('pay.mock.back')}
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        {/* Left: Mock Payment Form */}
        <section className={CARD}>
          <p className={LABEL}>{t('pay.mock.label')}</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">{t('pay.mock.title')}</h1>
          <p className="mt-1.5 text-sm text-white/65">
            {t('pay.mock.lead')}
          </p>

          <div className="mt-6 rounded-lg border border-hud/30 bg-hud/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm font-medium text-white">
                <CreditCard className="h-4 w-4 text-hud" />
                {t('pay.mock.testPay')}
              </div>
              <span className="rounded border border-hud/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-hud">
                {t('pay.mock.testMode')}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-white/60">
              {t('pay.mock.unlock1')} <span className="text-hud">embed_key</span> {t('pay.mock.unlock2')}{' '}
              <span className="text-white">.glb</span> {t('pay.mock.unlock3')}
            </p>
          </div>

          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 font-mono text-xs text-white/65">
            <div className="flex justify-between gap-4">
              <dt>{t('pay.mock.orderId')}</dt>
              <dd className="truncate text-white/85">{purchase.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('pay.mock.created')}</dt>
              <dd className="text-white/85">{formatDate(purchase.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('pay.mock.status')}</dt>
              <dd className="uppercase text-amber">{statusLabel}</dd>
            </div>
          </dl>

          {errorMsg && (
            <p role="alert" className="mt-4 rounded border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
              {msgText(errorMsg, t)}
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
                  {t('pay.mock.confirming')}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {t('pay.mock.confirmPay', { price: priceText })}
                </>
              )}
            </button>
            <Link
              href={`/models/${purchase.modelId}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 px-4 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              {t('pay.mock.cancel')}
            </Link>
          </div>
        </section>

        {/* Right: Order Summary */}
        <aside className={CARD}>
          <p className={LABEL}>{t('pay.mock.summary')}</p>
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
              <span>{t('pay.mock.single')}</span>
              <span className="font-mono">{priceText}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-medium text-white">
              <span>{t('pay.total')}</span>
              <span className="font-mono text-hud">{priceText}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-white/50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-hud/70" />
            <span>{t('pay.mock.locked')}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
