'use client';

// Seller Dashboard — sales summary, my models, soft delete, and links to public profile & upload
import { useEffect, useState } from 'react';
import NoticeBox from '@/components/notifications/NoticeBox';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Coins,
  Download,
  Eye,
  Layers,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import {
  deleteModel,
  enableSellerMode,
  fetchSellerModels,
  fetchSellerSales,
  fetchSellerStatus,
  fetchSellerWallet,
  requestSellerWithdrawal,
} from '@/lib/api';
import { creatorHandle } from '@/lib/creators';
import { formatMoney, formatPrice } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n/client';
import { fromErr, type Msg } from '@/lib/i18n/msg';
import { readSession, updateSessionUser } from '@/lib/session';
import type {
  AuthUser,
  SellerModelItem,
  SellerSalesSummary,
  SellerWalletResponse,
} from '@/lib/types';

const CARD = 'rounded-lg border border-line bg-ink/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-accent';

export default function SellerPage() {
  const t = useT();
  const locale = useLocale();
  const dateFmt = (v: string) => new Date(v).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState<boolean | null>(null);
  const [models, setModels] = useState<SellerModelItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SellerSalesSummary | null>(null);
  const [walletData, setWalletData] = useState<SellerWalletResponse | null>(null);
  const [withdrawAmountUsd, setWithdrawAmountUsd] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'promptpay' | 'bank'>('promptpay');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<Msg | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // 1. Load user & token
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = readSession();
    if (session) {
      setToken(session.token);
      setUser(session.user as AuthUser);
    }
  }, []);

  // 2. Fetch seller status & data
  const loadData = async (authToken: string) => {
    try {
      setLoading(true);
      const sellerStatus = await fetchSellerStatus(authToken).catch(() => false);
      setIsSeller(sellerStatus);

      if (sellerStatus) {
        const [modelsList, sales, wallet] = await Promise.all([
          fetchSellerModels(authToken).catch(() => []),
          fetchSellerSales(authToken).catch(() => null),
          fetchSellerWallet(authToken).catch(() => null),
        ]);
        setModels(modelsList);
        setSalesSummary(sales);
        setWalletData(wallet);
        if (wallet && wallet.wallet.availableGrossCents > 0) {
          setWithdrawAmountUsd((wallet.wallet.availableGrossCents / 100).toFixed(2));
        } else {
          setWithdrawAmountUsd('');
        }
      }
    } catch (err: any) {
      setStatusMsg(fromErr(err, 'seller.errLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  // Handle Enable Seller
  const handleEnableSeller = async () => {
    if (!token) return;
    try {
      setBusyAction('enable');
      await enableSellerMode(token);
      setIsSeller(true);
      setUser((prev) => {
        if (!prev) return prev;
        const nextRole: typeof prev.role = prev.role === 'user' ? 'creator' : prev.role;
        const next = { ...prev, is_seller: true, role: nextRole };
        updateSessionUser({ is_seller: true, role: nextRole });
        return next;
      });
      setStatusMsg({ key: 'seller.enabled' });
      await loadData(token);
    } catch (err: any) {
      setStatusMsg(fromErr(err, 'seller.enableFail'));
    } finally {
      setBusyAction(null);
    }
  };

  // Handle Soft Delete Model
  const handleDeleteModel = async (modelId: string, title: string) => {
    if (!token) return;
    if (!window.confirm(t('seller.deleteConfirm', { title }))) {
      return;
    }

    try {
      setBusyAction(`del-${modelId}`);
      await deleteModel(modelId, token);
      setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, isDeleted: true } : m)));
      setStatusMsg({ key: 'seller.deleted', vars: { title } });
    } catch (err: any) {
      setStatusMsg(fromErr(err, 'seller.deleteFail'));
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
        <p className="font-mono text-sm text-ink/50">{t('seller.loading')}</p>
      </main>
    );
  }

  // Not logged in
  if (!token) {
    return (
      <main className="mx-auto max-w-[800px] px-4 pb-16 pt-28 md:px-6">
        <div className={`${CARD} text-center`}>
          <p className={LABEL}>{t('seller.needLabel')}</p>
          <h1 className="mt-4 font-display text-2xl uppercase tracking-wide text-ink">{t('seller.needTitle')}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {t('seller.needBody')}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-ink px-5 py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/85"
          >
            {t('seller.needLogin')}
          </Link>
        </div>
      </main>
    );
  }

  // Not a seller yet
  if (!isSeller) {
    return (
      <main className="mx-auto max-w-[800px] px-4 pb-16 pt-28 md:px-6">
        <div className={`${CARD} text-center`}>
          <Store className="mx-auto h-12 w-12 text-accent" />
          <p className={`${LABEL} mt-4`}>{t('seller.offLabel')}</p>
          <h1 className="mt-2 font-display text-2xl uppercase tracking-wide text-ink">
            {t('seller.offTitle')}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {t('seller.offBody')}
          </p>
          <button
            type="button"
            disabled={busyAction === 'enable'}
            onClick={handleEnableSeller}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 font-mono text-xs uppercase tracking-wider text-canvas font-semibold transition-colors hover:bg-accent/85 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {busyAction === 'enable' ? t('seller.activating') : t('seller.offButton')}
          </button>
        </div>
      </main>
    );
  }

  const displayName = user?.display_name || 'Creator';
  const handle = creatorHandle(displayName);
  const activeModels = models.filter((m) => !m.isDeleted);

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      {/* Toast Notification */}
      {statusMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <span>{'key' in statusMsg ? t(statusMsg.key, statusMsg.vars) : statusMsg.text}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="ml-4 font-mono text-xs opacity-70 hover:opacity-100"
          >
            {t('acct.close')}
          </button>
        </div>
      )}

      {/* Notices from admins (for example a license change and the reason) */}
      {token && <NoticeBox token={token} />}

      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl uppercase text-ink">{t('seller.title')}</h1>
            <span className="rounded border border-accent/40 bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase text-accent">
              {t('seller.active')}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-ink/50">
            {t('seller.welcome', { name: displayName, handle })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/creators/${handle}`}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-ink/5 px-3.5 font-mono text-xs uppercase tracking-wider text-ink transition-colors hover:bg-ink/10"
          >
            <User className="h-4 w-4" />
            {t('seller.publicProfile')}
            <ArrowUpRight className="h-3.5 w-3.5 text-ink/50" />
          </Link>
          <Link
            href="/upload"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 font-mono text-xs uppercase tracking-wider text-canvas transition-colors hover:bg-ink/85"
          >
            <Plus className="h-4 w-4" />
            {t('seller.uploadNew')}
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={CARD}>
          <div className="flex items-center justify-between text-ink/50">
            <span className={LABEL}>{t('seller.revenue')}</span>
            <Coins className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-3 font-display text-2xl uppercase text-ink">
            {formatPrice(salesSummary?.totalRevenue || 0)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink/40">{t('seller.revenueNote')}</p>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between text-ink/50">
            <span className={LABEL}>{t('seller.sales')}</span>
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 font-display text-2xl uppercase text-ink">
            {t('seller.orders', { n: salesSummary?.totalSales ?? 0 })}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink/40">{t('seller.salesNote')}</p>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between text-ink/50">
            <span className={LABEL}>{t('seller.activeModels')}</span>
            <Layers className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-3 font-display text-2xl uppercase text-ink">
            {t('seller.modelsCount', { n: activeModels.length })}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink/40">{t('seller.activeNote')}</p>
        </div>
      </div>

      {/* Platform Wallet & Withdrawal (with Fee / Difference Calculation) */}
      <section className="mt-10">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Wallet className="h-4 w-4 text-accent" />
          <h2 className="font-display text-lg uppercase text-ink">{t('seller.walletTitle')}</h2>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className={CARD}>
            <span className={LABEL}>{t('seller.held')}</span>
            <p className="mt-2 font-display text-3xl uppercase text-ink">
              {formatMoney(walletData?.wallet.availableGrossCents ?? 0, 'USD')}
            </p>
            <p className="mt-1 text-xs text-ink/55">
              {t('seller.heldNote')}
            </p>

            {(() => {
              const availableCents = walletData?.wallet.availableGrossCents ?? 0;
              const feeBps = walletData?.wallet.feeRateBps ?? 700;
              const parsedInputCents = Math.round((Number(withdrawAmountUsd) || 0) * 100);
              const previewGross = parsedInputCents > 0 ? parsedInputCents : availableCents;
              const previewFee = Math.round((previewGross * feeBps) / 10000);
              const previewNet = Math.max(0, previewGross - previewFee);

              return (
                <dl className="mt-5 space-y-2 border-t border-line pt-4 font-mono text-xs">
                  <div className="flex justify-between text-ink/70">
                    <dt>{t('seller.gross')}</dt>
                    <dd>{formatMoney(previewGross, 'USD')}</dd>
                  </div>
                  <div className="flex justify-between text-warn">
                    <dt>{t('seller.fee', { pct: feeBps / 100 })}</dt>
                    <dd>-{formatMoney(previewFee, 'USD')}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-sm font-semibold text-accent">
                    <dt>{t('seller.net')}</dt>
                    <dd>{formatMoney(previewNet, 'USD')}</dd>
                  </div>
                </dl>
              );
            })()}
          </div>

          <form
            className={CARD}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!token || !walletData) return;
              const amountCents = Math.round((Number(withdrawAmountUsd) || 0) * 100);
              try {
                setBusyAction('withdraw');
                setStatusMsg(null);
                await requestSellerWithdrawal(token, {
                  amountCents: amountCents > 0 ? amountCents : undefined,
                  payoutMethod,
                  payoutAccount,
                });
                setPayoutAccount('');
                setStatusMsg({ key: 'seller.withdrawDone' });
                await loadData(token);
              } catch (err: any) {
                setStatusMsg(fromErr(err, 'seller.withdrawFail'));
              } finally {
                setBusyAction(null);
              }
            }}
          >
            <span className={LABEL}>{t('seller.withdrawLabel')}</span>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="withdraw-amount" className="block text-xs text-ink/75">
                  {t('seller.amountUsd')}
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={withdrawAmountUsd}
                  onChange={(e) => setWithdrawAmountUsd(e.target.value)}
                  placeholder="0.00"
                  className="mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas/50 px-3 font-mono text-sm text-ink focus:border-accent/60 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="payout-method" className="block text-xs text-ink/75">
                  {t('seller.payoutMethod')}
                </label>
                <select
                  id="payout-method"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as 'promptpay' | 'bank')}
                  className="mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas/50 px-3 text-sm text-ink focus:border-accent/60 focus:outline-none"
                >
                  <option value="promptpay">{t('seller.promptpay')}</option>
                  <option value="bank">{t('seller.bank')}</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="payout-account" className="block text-xs text-ink/75">
                {payoutMethod === 'promptpay' ? t('seller.accountPromptpay') : t('seller.accountBank')}
              </label>
              <input
                id="payout-account"
                type="text"
                required
                value={payoutAccount}
                onChange={(e) => setPayoutAccount(e.target.value)}
                placeholder={payoutMethod === 'promptpay' ? t('seller.phPromptpay') : t('seller.phBank')}
                className="mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas/50 px-3 text-sm text-ink focus:border-accent/60 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busyAction === 'withdraw' || (walletData?.wallet.availableGrossCents ?? 0) <= 0}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-ink px-5 font-mono text-xs font-semibold uppercase tracking-wider text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === 'withdraw' ? t('seller.processing') : t('seller.withdrawButton')}
            </button>
          </form>
        </div>

        {walletData && walletData.withdrawals.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-line bg-ink/5 text-[11px] uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="px-4 py-3">{t('seller.thGross')}</th>
                  <th className="px-4 py-3">{t('seller.thFee')}</th>
                  <th className="px-4 py-3">{t('seller.thNet')}</th>
                  <th className="px-4 py-3">{t('seller.thDestination')}</th>
                  <th className="px-4 py-3">{t('seller.thStatus')}</th>
                  <th className="px-4 py-3">{t('seller.thDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {walletData.withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3 text-ink">{formatMoney(w.grossAmountCents, w.currency)}</td>
                    <td className="px-4 py-3 text-warn">-{formatMoney(w.platformFeeCents, w.currency)}</td>
                    <td className="px-4 py-3 font-medium text-accent">{formatMoney(w.netAmountCents, w.currency)}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {w.payoutMethod.toUpperCase()} · {w.payoutAccount}
                    </td>
                    <td className="px-4 py-3 uppercase text-ink/80">{w.status}</td>
                    <td className="px-4 py-3 text-ink/40">{dateFmt(w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Uploaded Models Table */}
      <section className="mt-10">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="font-display text-lg uppercase text-ink">
            {t('seller.myModels')}
            <span className="ml-2 font-mono text-xs text-ink/50">({models.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => token && loadData(token)}
            className="flex items-center gap-1 font-mono text-xs text-ink-soft hover:text-ink"
          >
            <RefreshCw className="h-3 w-3" /> {t('seller.refresh')}
          </button>
        </div>

        {models.length === 0 ? (
          <div className={`${CARD} mt-6 text-center py-12`}>
            <Layers className="mx-auto h-8 w-8 text-ink/30" />
            <h3 className="mt-3 font-display text-base uppercase text-ink">{t('seller.noneTitle')}</h3>
            <p className="mt-1 text-sm text-ink/50">
              {t('seller.noneBody')}
            </p>
            <Link
              href="/upload"
              className="mt-5 inline-block rounded-lg bg-ink px-4 py-2 text-xs font-mono uppercase tracking-wider text-canvas transition-colors hover:bg-ink/85"
            >
              {t('seller.noneButton')}
            </Link>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-ink/5 font-mono text-[11px] uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="px-4 py-3">{t('seller.thTitle')}</th>
                  <th className="px-4 py-3">{t('seller.thPrice')}</th>
                  <th className="px-4 py-3">{t('seller.thViews')}</th>
                  <th className="px-4 py-3">{t('seller.thDownloads')}</th>
                  <th className="px-4 py-3">{t('seller.thStatus')}</th>
                  <th className="px-4 py-3 text-right">{t('seller.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono text-xs">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/models/${m.id}`}
                        className="font-medium text-ink transition-colors hover:text-accent"
                      >
                        {m.title}
                      </Link>
                      <span className="block text-[11px] text-ink/40">{m.id}</span>
                    </td>
                    <td className="px-4 py-3.5 text-ink/80">
                      {m.priceCents === 0 ? t('acct.free') : formatPrice(m.priceCents)}
                    </td>
                    <td className="px-4 py-3.5 text-ink/60">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> {m.viewCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-ink/60">
                      <span className="flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" /> {m.downloadCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {m.isDeleted ? (
                        <span className="rounded bg-danger/10 px-2 py-0.5 text-danger border border-danger/20">
                          {t('seller.statusDeleted')}
                        </span>
                      ) : m.isHidden ? (
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-warn border border-amber-500/20">
                          {t('seller.statusHidden')}
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-500 border border-emerald-500/20">
                          {t('seller.statusLive')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/models/${m.id}`}
                          className="rounded border border-line px-2 py-1 text-[11px] text-ink/70 hover:text-ink"
                        >
                          {t('acct.view')}
                        </Link>
                        {!m.isDeleted && (
                          <button
                            type="button"
                            disabled={busyAction === `del-${m.id}`}
                            onClick={() => handleDeleteModel(m.id, m.title)}
                            className="rounded border border-danger/30 px-2 py-1 text-[11px] text-danger/80 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                            title={t('seller.softDelete')}
                          >
                            <Trash2 className="h-3 w-3 inline" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Sales History */}
      {salesSummary && salesSummary.sales && salesSummary.sales.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg uppercase text-ink border-b border-line pb-3">
            {t('seller.ordersTitle')}
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm font-mono text-xs">
              <thead className="border-b border-line bg-ink/5 text-[11px] uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="px-4 py-3">{t('seller.thModel')}</th>
                  <th className="px-4 py-3">{t('seller.thBuyer')}</th>
                  <th className="px-4 py-3">{t('seller.thPrice')}</th>
                  <th className="px-4 py-3">{t('seller.thDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {salesSummary.sales.map((s) => (
                  <tr key={s.purchaseId} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3 text-ink">{s.title}</td>
                    <td className="px-4 py-3 text-ink/70">{s.buyerName || t('seller.buyerFallback')}</td>
                    <td className="px-4 py-3 text-emerald-500 font-medium">
                      +{formatPrice(s.priceCents)}
                    </td>
                    <td className="px-4 py-3 text-ink/40">
                      {dateFmt(s.soldAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

