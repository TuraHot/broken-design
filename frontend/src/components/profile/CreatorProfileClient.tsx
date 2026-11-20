'use client';

// Unified Creator Profile & Seller Dashboard — VGen-inspired layout:
// Full-width cover banner -> left sidebar (avatar, handle, stats, bio) + right underline tabs
// (Models | Dashboard | Wallet & Withdraw for creator owner), with Donate at the bottom.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Coins,
  Download,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import ModelCard from '@/components/gallery/ModelCard';
import NoticeBox from '@/components/notifications/NoticeBox';
import DonateCard from '@/components/profile/DonateCard';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  CDN_SERVICE_URL,
  deleteModel,
  fetchSellerModels,
  fetchSellerSales,
  fetchSellerStatus,
  fetchSellerWallet,
  replaceModelAssets,
  requestSellerWithdrawal,
  updateSellerModel,
} from '@/lib/api';
import { creatorHandle, type CreatorProfile } from '@/lib/creators';
import type { AuthUser } from '@/lib/auth';
import { formatCount, formatMoney, formatPrice } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n/client';
import { readSession } from '@/lib/session';
import type {
  SellerModelItem,
  SellerSalesSummary,
  SellerWalletResponse,
} from '@/lib/types';

type TabKey = 'models' | 'dashboard' | 'wallet';

const CARD = 'rounded-xl border border-white/10 bg-white/[0.04] p-5';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

interface Props {
  handle: string;
  initialCreator: CreatorProfile | null;
}

export default function CreatorProfileClient({ handle, initialCreator }: Props) {
  const t = useT();
  const locale = useLocale();
  const dateFmt = (v: string) => new Date(v).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US');

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isOwnerCreator, setIsOwnerCreator] = useState(false);
  const [previewPublic, setPreviewPublic] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('models');

  const [models, setModels] = useState<SellerModelItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SellerSalesSummary | null>(null);
  const [walletData, setWalletData] = useState<SellerWalletResponse | null>(null);
  const [withdrawAmountUsd, setWithdrawAmountUsd] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'promptpay' | 'bank'>('promptpay');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [editingModel, setEditingModel] = useState<SellerModelItem | null>(null);
  const [deletingModel, setDeletingModel] = useState<SellerModelItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriceUsd, setEditPriceUsd] = useState('0');
  const [editLicense, setEditLicense] = useState('CC0');
  const [editDescription, setEditDescription] = useState('');
  const [editMainFile, setEditMainFile] = useState<File | null>(null);
  const [editPreviewFile, setEditPreviewFile] = useState<File | null>(null);
  const [editPosterFile, setEditPosterFile] = useState<File | null>(null);

  const openEditModal = (m: SellerModelItem) => {
    setEditingModel(m);
    setEditTitle(m.title);
    setEditPriceUsd((m.priceCents / 100).toFixed(m.priceCents % 100 === 0 ? 0 : 2));
    setEditLicense(m.license || 'CC0');
    setEditDescription(m.description || '');
    setEditMainFile(null);
    setEditPreviewFile(null);
    setEditPosterFile(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingModel) return;
    const priceCents = Math.max(0, Math.round((Number(editPriceUsd) || 0) * 100));
    try {
      setBusyAction(`edit-${editingModel.id}`);
      setStatusMsg(null);

      // Upload replacement assets first so adding a preview GLB succeeds before setting a paid price (PREVIEW_REQUIRED).
      let nextPosterUrl = editingModel.posterUrl;
      if (editMainFile || editPreviewFile || editPosterFile) {
        const assetRes = await replaceModelAssets(editingModel.id, token, {
          file: editMainFile,
          preview: editPreviewFile,
          poster: editPosterFile,
        });
        if (editPosterFile || assetRes.model.posterHash) {
          nextPosterUrl = `${CDN_SERVICE_URL}/cdn/models/${editingModel.id}/poster.webp?v=${Date.now()}`;
        }
      }

      const res = await updateSellerModel(editingModel.id, token, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priceCents,
        license: editLicense,
      });

      setModels((prev) =>
        prev.map((item) =>
          item.id === editingModel.id
            ? {
                ...item,
                title: res.model.title,
                description: res.model.description,
                priceCents: res.model.priceCents,
                license: res.model.license,
                posterUrl: nextPosterUrl,
              }
            : item,
        ),
      );
      setStatusMsg(t('profile.updatedMsg', { title: res.model.title }));
      setEditingModel(null);
    } catch (err: any) {
      setStatusMsg(err?.message || t('profile.updateFail'));
    } finally {
      setBusyAction(null);
    }
  };

  const loadDashboardData = async (authToken: string) => {
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
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'dashboard' || tabParam === 'wallet' || tabParam === 'models') {
        setActiveTab(tabParam);
      }
    }

    const session = readSession();
    setReady(true);
    if (!session) return;

    const u = session.user;
    setUser(u);
    setToken(session.token);

    const myHandle = creatorHandle(u.display_name?.trim() || u.email);
    const isMine = myHandle === handle;
    if (!isMine) return;

    (async () => {
      const sellerActive =
        u.role === 'creator' || u.is_seller || (await fetchSellerStatus(session.token).catch(() => false));
      if (sellerActive) {
        setIsOwnerCreator(true);
        await loadDashboardData(session.token);
      }
    })();
  }, [handle]);

  const handleSoftDelete = async (modelId: string, title: string) => {
    if (!token) return;
    try {
      setBusyAction(`delete-${modelId}`);
      setStatusMsg(null);
      await deleteModel(modelId, token);
      setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, isDeleted: true } : m)));
      setStatusMsg(t('profile.deletedMsg', { title }));
      setDeletingModel(null);
    } catch (err: any) {
      setStatusMsg(err?.message || t('profile.deleteFail'));
    } finally {
      setBusyAction(null);
    }
  };

  const creatorName =
    initialCreator?.name || (isOwnerCreator && user ? user.display_name || user.email : null);

  if (!initialCreator && !isOwnerCreator) {
    if (!ready) {
      return (
        <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-28 md:px-6">
          <div className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/5" />
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-[680px] px-4 pb-16 pt-28 text-center md:px-6">
        <div className={CARD}>
          <p className={LABEL}>{t('creators.label')}</p>
          <h1 className="mt-2 font-display text-2xl uppercase text-white">{t('profile.notFound')}</h1>
          <p className="mt-2 text-sm text-white/65">{t('profile.notFoundDesc', { handle })}</p>
          <Link
            href="/gallery"
            className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/85"
          >
            {t('profile.browseGallery')}
          </Link>
        </div>
      </main>
    );
  }

  const displayName = creatorName || handle;
  const avatarUrl = (isOwnerCreator ? user?.avatar_url : null) ?? initialCreator?.avatarUrl ?? null;
  const publicModels = initialCreator?.models ?? [];
  const activeSellerModels = models.filter((m) => !m.isDeleted);
  const modelCount = initialCreator ? publicModels.length : activeSellerModels.length;
  const totalDownloads = initialCreator
    ? initialCreator.totalDownloads
    : models.reduce((sum, m) => sum + Number(m.downloadCount || 0), 0);
  const totalLikes = initialCreator?.totalLikes ?? 0;
  const bio = initialCreator?.bio || t('profile.bioFallback');

  const showOwnerTabs = isOwnerCreator && !previewPublic;
  const currentTab: TabKey = showOwnerTabs ? activeTab : 'models';

  const tabClass = (tab: TabKey) =>
    `relative whitespace-nowrap pb-3 text-sm font-medium transition-colors ${
      currentTab === tab
        ? 'text-white after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-white'
        : 'text-white/55 hover:text-white/85'
    }`;

  return (
    <main className="pb-16 pt-16">
      {/* Full-width Cover Banner (VGen prototype style) */}
      <div className="relative h-40 w-full overflow-hidden border-b border-white/10 bg-[#0c0e14] sm:h-52">
        <svg aria-hidden viewBox="0 0 1240 240" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="vgen-cover-holo" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#8fd3ff" />
              <stop offset="0.35" stopColor="#b892ff" />
              <stop offset="0.7" stopColor="#ff9ec7" />
              <stop offset="1" stopColor="#ffb070" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#vgen-cover-holo)" vectorEffect="non-scaling-stroke">
            <path d="M0 155 C220 185 380 45 620 95 S1020 190 1240 80" strokeOpacity="0.65" strokeWidth="1.5" />
            <path d="M0 185 C260 205 420 95 650 135 S1040 215 1240 125" strokeOpacity="0.3" strokeWidth="1.2" />
            <path d="M0 110 C190 135 350 20 590 60 S990 140 1240 45" strokeOpacity="0.2" strokeWidth="1" />
          </g>
        </svg>

        {isOwnerCreator && (
          <button
            type="button"
            onClick={() => setPreviewPublic((v) => !v)}
            className="absolute bottom-3 right-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black"
          >
            <span>{previewPublic ? t('profile.exitPreview') : t('profile.preview')}</span>
            <span className={`h-2 w-2 rounded-full ${previewPublic ? 'bg-amber' : 'bg-emerald-400'}`} />
          </button>
        )}
      </div>

      {/* Main Container: 2-Column VGen Layout */}
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left Sidebar */}
          <aside className="relative z-10 shrink-0 lg:w-[270px]">
            <div className="relative z-10 -mt-12 sm:-mt-14">
              <UserAvatar
                name={displayName}
                avatarUrl={avatarUrl}
                size="xl"
                className="!h-24 !w-24 sm:!h-28 sm:!w-28 !border-4 !border-black shadow-lg"
              />
            </div>

            <div className="mt-3">
              <h1 className="font-display text-2xl uppercase leading-tight text-white">{displayName}</h1>
              <p className="mt-0.5 text-sm text-white/55">@{handle}</p>
            </div>

            {showOwnerTabs && (
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/upload"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-medium text-white transition-colors hover:bg-white/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('profile.uploadGlb')}
                </Link>
              </div>
            )}

            {/* Rounded Stat Pills (matching Followers / Following style) */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-center font-mono text-xs text-white/80">
                <span className="font-semibold text-white">{formatCount(modelCount)}</span> {t('profile.modelsPill')}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-center font-mono text-xs text-white/80">
                <span className="font-semibold text-white">{formatCount(totalDownloads)}</span> {t('profile.dlsPill')}
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-xs font-medium text-white/80">
                <span>{t('profile.aboutMe')}</span>
                <span className="font-mono text-[11px] text-white/45">
                  {formatCount(totalLikes)} {t('creators.likes')}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{bio}</p>
              <Link
                href="/creator"
                className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-hud/75 hover:text-hud"
              >
                {t('profile.creatorHub')}
              </Link>
            </div>

            <div className="mt-5">
              <DonateCard creator={displayName} />
            </div>
          </aside>

          {/* Right Main Area: Horizontal Tabs + Tab Content */}
          <div className="min-w-0 flex-1 pt-2 lg:pt-5">
            <nav
              aria-label={t('profile.navAria')}
              className="flex items-center gap-6 overflow-x-auto border-b border-white/10"
            >
              <button type="button" onClick={() => setActiveTab('models')} className={tabClass('models')}>
                {t('profile.tabModels')} <span className="ml-1 font-mono text-xs text-white/50">{modelCount}</span>
              </button>
              {showOwnerTabs && (
                <>
                  <button type="button" onClick={() => setActiveTab('dashboard')} className={tabClass('dashboard')}>
                    {t('profile.tabDashboard')}
                  </button>
                  <button type="button" onClick={() => setActiveTab('wallet')} className={tabClass('wallet')}>
                    {t('profile.tabWallet')}
                  </button>
                </>
              )}
            </nav>

            {statusMsg && (
              <div
                role="status"
                className="mt-4 flex items-center gap-2 rounded-lg border border-hud/30 bg-hud/10 px-4 py-3 text-sm text-hud"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}

            {/* TAB 1: Public Models */}
            {currentTab === 'models' && (
              <section className="mt-6">
                {publicModels.length > 0 ? (
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {publicModels.map((m) => (
                      <li key={m.id}>
                        <ModelCard model={m} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
                    <p className="text-sm text-white/50">{t('profile.noPublicModels')}</p>
                    {showOwnerTabs && (
                      <Link
                        href="/upload"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-white/85"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('profile.uploadFirst')}
                      </Link>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: Seller Dashboard (Owner Only) */}
            {currentTab === 'dashboard' && showOwnerTabs && (
              <section className="mt-6 space-y-8">
                {token && <NoticeBox token={token} />}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className={CARD}>
                    <div className="flex items-center justify-between text-white/50">
                      <span className={LABEL}>{t('seller.revenue')}</span>
                      <Coins className="h-4 w-4 text-hud" />
                    </div>
                    <p className="mt-3 font-display text-2xl uppercase text-white">
                      {formatPrice(salesSummary?.totalRevenue || 0)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-white/40">{t('seller.revenueNote')}</p>
                  </div>

                  <div className={CARD}>
                    <div className="flex items-center justify-between text-white/50">
                      <span className={LABEL}>{t('seller.sales')}</span>
                      <ShoppingBag className="h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="mt-3 font-display text-2xl uppercase text-white">
                      {t('seller.orders', { n: salesSummary?.totalSales ?? 0 })}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-white/40">{t('seller.salesNote')}</p>
                  </div>

                  <div className={CARD}>
                    <div className="flex items-center justify-between text-white/50">
                      <span className={LABEL}>{t('seller.activeModels')}</span>
                      <Layers className="h-4 w-4 text-purple-400" />
                    </div>
                    <p className="mt-3 font-display text-2xl uppercase text-white">
                      {t('seller.modelsCount', { n: activeSellerModels.length })}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-white/40">{t('seller.activeNote')}</p>
                  </div>
                </div>

                {/* My 3D Models Table */}
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h2 className="font-display text-base uppercase text-white">
                      {t('seller.myModels')} <span className="ml-1 font-mono text-xs text-white/50">({models.length})</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => token && loadDashboardData(token)}
                      className="flex items-center gap-1 font-mono text-xs text-white/65 hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3" /> {t('seller.refresh')}
                    </button>
                  </div>

                  {models.length === 0 ? (
                    <div className={`${CARD} mt-4 text-center py-8`}>
                      <p className="text-sm text-white/55">{t('profile.noUploadedModels')}</p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-white/10 bg-white/5 font-mono text-[11px] uppercase tracking-wider text-white/50">
                          <tr>
                            <th className="px-4 py-3">{t('seller.thModel')}</th>
                            <th className="px-4 py-3">{t('seller.thPrice')}</th>
                            <th className="px-4 py-3">{t('seller.thDownloads')}</th>
                            <th className="px-4 py-3">{t('seller.thStatus')}</th>
                            <th className="px-4 py-3 text-right">{t('seller.thActions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {models.map((m) => (
                            <tr key={m.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 font-medium text-white">
                                {m.isDeleted ? (
                                  <div className="flex items-center gap-3 opacity-60">
                                    <div className="relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5">
                                      <ImageIcon className="h-4 w-4 text-white/30" />
                                    </div>
                                    <span className="truncate">{m.title}</span>
                                  </div>
                                ) : (
                                  <Link
                                    href={`/models/${m.id}`}
                                    className="group flex items-center gap-3 transition-colors hover:text-hud"
                                  >
                                    <div className="relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5 group-hover:border-hud/40">
                                      <ImageIcon className="h-4 w-4 text-white/30" />
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={m.posterUrl || `${CDN_SERVICE_URL}/cdn/models/${m.id}/poster.webp`}
                                        alt=""
                                        loading="lazy"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                        className="absolute inset-0 h-full w-full object-cover"
                                      />
                                    </div>
                                    <span className="truncate group-hover:underline">{m.title}</span>
                                  </Link>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-white/75">
                                {m.priceCents === 0 ? t('acct.free') : formatPrice(m.priceCents)}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-white/75">
                                <span className="inline-flex items-center gap-1">
                                  <Download className="h-3 w-3 text-white/40" />
                                  {m.downloadCount}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] uppercase">
                                {m.isDeleted ? (
                                  <span className="text-red-400">{t('seller.statusDeleted')}</span>
                                ) : m.isHidden ? (
                                  <span className="text-amber">{t('seller.statusHidden')}</span>
                                ) : (
                                  <span className="text-emerald-400">{t('seller.statusLive')}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!m.isDeleted && (
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(m)}
                                      className="rounded border border-white/15 px-2 py-1 text-xs text-white/75 hover:bg-white/10 hover:text-white"
                                      title={t('profile.editBtn')}
                                      aria-label={t('profile.editBtn')}
                                    >
                                      <Pencil className="inline h-3 w-3" />
                                    </button>
                                  )}
                                  {!m.isDeleted && (
                                    <button
                                      type="button"
                                      disabled={busyAction === `delete-${m.id}`}
                                      onClick={() => setDeletingModel(m)}
                                      className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                                      title={t('profile.deleteBtn')}
                                      aria-label={t('profile.deleteBtn')}
                                    >
                                      <Trash2 className="inline h-3 w-3" />
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
                </div>

                {/* Recent Orders */}
                {salesSummary && salesSummary.sales.length > 0 && (
                  <div>
                    <h2 className="border-b border-white/10 pb-3 font-display text-base uppercase text-white">
                      {t('seller.ordersTitle')}
                    </h2>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-white/50">
                          <tr>
                            <th className="px-4 py-3">{t('seller.thModel')}</th>
                            <th className="px-4 py-3">{t('seller.thBuyer')}</th>
                            <th className="px-4 py-3">{t('seller.thPrice')}</th>
                            <th className="px-4 py-3">{t('seller.thDate')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {salesSummary.sales.map((s) => (
                            <tr key={s.purchaseId} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-white">{s.title}</td>
                              <td className="px-4 py-3 text-white/70">{s.buyerName || t('seller.buyerFallback')}</td>
                              <td className="px-4 py-3 font-medium text-emerald-400">+{formatPrice(s.priceCents)}</td>
                              <td className="px-4 py-3 text-white/40">{dateFmt(s.soldAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: Wallet & Withdraw (Owner Only — 7% Platform Fee Calculation) */}
            {currentTab === 'wallet' && showOwnerTabs && (
              <section className="mt-6 space-y-6">
                <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                  <div className={CARD}>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-hud" />
                      <span className={LABEL}>{t('seller.held')}</span>
                    </div>
                    <p className="mt-2 font-display text-3xl uppercase text-white">
                      {formatMoney(walletData?.wallet.availableGrossCents ?? 0, 'USD')}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
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
                        <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 font-mono text-xs">
                          <div className="flex justify-between text-white/70">
                            <dt>{t('seller.gross')}</dt>
                            <dd>{formatMoney(previewGross, 'USD')}</dd>
                          </div>
                          <div className="flex justify-between text-amber">
                            <dt>{t('seller.fee', { pct: feeBps / 100 })}</dt>
                            <dd>-{formatMoney(previewFee, 'USD')}</dd>
                          </div>
                          <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-semibold text-hud">
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
                        setStatusMsg(t('seller.withdrawDone'));
                        await loadDashboardData(token);
                      } catch (err: any) {
                        setStatusMsg(err?.message || t('seller.withdrawFail'));
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                  >
                    <span className={LABEL}>{t('seller.withdrawLabel')}</span>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="profile-withdraw-amount" className="block text-xs text-white/75">
                          {t('seller.amountUsd')}
                        </label>
                        <input
                          id="profile-withdraw-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={withdrawAmountUsd}
                          onChange={(e) => setWithdrawAmountUsd(e.target.value)}
                          placeholder="0.00"
                          className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 font-mono text-sm text-white focus:border-hud/60 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-payout-method" className="block text-xs text-white/75">
                          {t('seller.payoutMethod')}
                        </label>
                        <select
                          id="profile-payout-method"
                          value={payoutMethod}
                          onChange={(e) => setPayoutMethod(e.target.value as 'promptpay' | 'bank')}
                          className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white focus:border-hud/60 focus:outline-none"
                        >
                          <option value="promptpay">{t('seller.promptpay')}</option>
                          <option value="bank">{t('seller.bank')}</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="profile-payout-account" className="block text-xs text-white/75">
                        {payoutMethod === 'promptpay' ? t('seller.accountPromptpay') : t('seller.accountBank')}
                      </label>
                      <input
                        id="profile-payout-account"
                        type="text"
                        required
                        value={payoutAccount}
                        onChange={(e) => setPayoutAccount(e.target.value)}
                        placeholder={payoutMethod === 'promptpay' ? t('seller.phPromptpay') : t('seller.phBank')}
                        className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white focus:border-hud/60 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={busyAction === 'withdraw' || (walletData?.wallet.availableGrossCents ?? 0) <= 0}
                      className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-white px-5 font-mono text-xs font-semibold uppercase tracking-wider text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyAction === 'withdraw' ? t('seller.processing') : t('seller.withdrawButton')}
                    </button>
                  </form>
                </div>

                {walletData && walletData.withdrawals.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-white/50">
                        <tr>
                          <th className="px-4 py-3">{t('seller.thGross')}</th>
                          <th className="px-4 py-3">{t('seller.thFee')}</th>
                          <th className="px-4 py-3">{t('seller.thNet')}</th>
                          <th className="px-4 py-3">{t('seller.thDestination')}</th>
                          <th className="px-4 py-3">{t('seller.thStatus')}</th>
                          <th className="px-4 py-3">{t('seller.thDate')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {walletData.withdrawals.map((w) => (
                          <tr key={w.id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{formatMoney(w.grossAmountCents, w.currency)}</td>
                            <td className="px-4 py-3 text-amber">-{formatMoney(w.platformFeeCents, w.currency)}</td>
                            <td className="px-4 py-3 font-medium text-hud">{formatMoney(w.netAmountCents, w.currency)}</td>
                            <td className="px-4 py-3 text-white/70">
                              {w.payoutMethod.toUpperCase()} · {w.payoutAccount}
                            </td>
                            <td className="px-4 py-3 uppercase text-white/80">{w.status}</td>
                            <td className="px-4 py-3 text-white/40">{dateFmt(w.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Edit Model Modal */}
      {editingModel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('profile.editTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-[460px] rounded-2xl border border-white/15 bg-[#0b0d12] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg uppercase text-white">{t('profile.editTitle')}</h2>
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="rounded p-1 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={t('modal.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="edit-model-title" className="block text-xs text-white/75">
                  {t('profile.fieldTitle')}
                </label>
                <input
                  id="edit-model-title"
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white focus:border-hud/60 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-model-price" className="block text-xs text-white/75">
                    {t('profile.fieldPrice')}
                  </label>
                  <input
                    id="edit-model-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPriceUsd}
                    onChange={(e) => setEditPriceUsd(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 font-mono text-sm text-white focus:border-hud/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-model-license" className="block text-xs text-white/75">
                    {t('profile.fieldLicense')}
                  </label>
                  <select
                    id="edit-model-license"
                    value={editLicense}
                    onChange={(e) => setEditLicense(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0b0d12] px-3 text-sm text-white focus:border-hud/60 focus:outline-none"
                  >
                    <option value="CC0">CC0</option>
                    <option value="CC-BY">CC-BY</option>
                    <option value="CC-BY-NC">CC-BY-NC</option>
                    <option value="COMMERCIAL">COMMERCIAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-model-desc" className="block text-xs text-white/75">
                  {t('profile.fieldDesc')}
                </label>
                <textarea
                  id="edit-model-desc"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white focus:border-hud/60 focus:outline-none"
                />
              </div>

              <div className="space-y-2.5 border-t border-white/10 pt-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                  {t('profile.replaceFiles')}
                </p>
                <div>
                  <label htmlFor="edit-model-file" className="block text-xs text-white/75">
                    {t('profile.fileMain')}
                  </label>
                  <input
                    id="edit-model-file"
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(e) => setEditMainFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs text-white/65 file:mr-3 file:rounded-md file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/15"
                  />
                </div>
                <div>
                  <label htmlFor="edit-preview-file" className="block text-xs text-white/75">
                    {t('profile.filePreview')}
                  </label>
                  <input
                    id="edit-preview-file"
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(e) => setEditPreviewFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs text-white/65 file:mr-3 file:rounded-md file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/15"
                  />
                </div>
                <div>
                  <label htmlFor="edit-poster-file" className="block text-xs text-white/75">
                    {t('profile.filePoster')}
                  </label>
                  <input
                    id="edit-poster-file"
                    type="file"
                    accept="image/webp,image/png,image/jpeg"
                    onChange={(e) => setEditPosterFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs text-white/65 file:mr-3 file:rounded-md file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/15"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="h-9 rounded-lg border border-white/20 px-4 text-xs text-white/80 hover:bg-white/10"
              >
                {t('creator.apply.cancel')}
              </button>
              <button
                type="submit"
                disabled={busyAction === `edit-${editingModel.id}`}
                className="h-9 rounded-lg bg-white px-4 text-xs font-semibold text-black hover:bg-white/85 disabled:opacity-50"
              >
                {busyAction === `edit-${editingModel.id}` ? t('profile.saving') : t('profile.saveChanges')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingModel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('profile.removeConfirm')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-[420px] rounded-2xl border border-white/15 bg-[#0b0d12] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-red-400">
                {t('profile.removeEyebrow')}
              </span>
              <button
                type="button"
                onClick={() => setDeletingModel(null)}
                className="rounded p-1 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={t('modal.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h2 className="mt-2 font-display text-lg uppercase text-white">
              {t('profile.removeTitle', { title: deletingModel.title })}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              {t('profile.removeBody')}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingModel(null)}
                disabled={busyAction === `delete-${deletingModel.id}`}
                className="h-9 rounded-lg border border-white/20 px-4 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                {t('creator.apply.cancel')}
              </button>
              <button
                type="button"
                disabled={busyAction === `delete-${deletingModel.id}`}
                onClick={() => handleSoftDelete(deletingModel.id, deletingModel.title)}
                className="h-9 rounded-lg border border-red-500/40 bg-red-500/20 px-4 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50"
              >
                {busyAction === `delete-${deletingModel.id}` ? t('profile.removing') : t('profile.removeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
