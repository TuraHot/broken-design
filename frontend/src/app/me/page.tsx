'use client';

// User Dashboard — profile overview, purchased models, embed keys & GLB downloads
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import NoticeBox from '@/components/notifications/NoticeBox';
import {
  Check,
  Code2,
  Copy,
  Download,
  KeyRound,
  Layers,
  RefreshCw,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import {
  fetchMyPurchases,
  fetchSellerStatus,
  regenerateEmbedKey,
} from '@/lib/api';
import { creatorHandle } from '@/lib/creators';
import { formatPrice } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { fromErr, serverError, type Msg } from '@/lib/i18n/msg';
import {
  buildVmModelSnippet,
  DEFAULT_EMBED_ORIGIN,
  DownloadError,
  downloadModelGlb,
} from '@/lib/model-assets';
import { readSession, SESSION_UPDATED_EVENT, updateSessionUser } from '@/lib/session';
import type { AuthUser, PurchaseItem } from '@/lib/types';


const CARD = 'rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

export default function MePage() {
  const t = useT();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<Msg | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [origin, setOrigin] = useState(DEFAULT_EMBED_ORIGIN);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Load & stay in sync with session storage (display name, avatar, sign-out)
  useEffect(() => {
    setOrigin(window.location.origin);
    const syncSession = () => {
      const session = readSession();
      setToken(session?.token ?? null);
      setUser((session?.user as AuthUser) ?? null);
      if (!session) setPurchases([]);
      setLoading(false);
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

  // 2. Fetch purchases and seller status
  useEffect(() => {
    if (!token) return;

    let mounted = true;
    (async () => {
      try {
        const [purchaseList, isSeller] = await Promise.all([
          fetchMyPurchases(token).catch(() => []),
          fetchSellerStatus(token).catch(() => false),
        ]);

        if (mounted) {
          setPurchases(purchaseList);
          setUser((prev) => {
            const next = prev ? { ...prev, is_seller: isSeller } : prev;
            if (next) updateSessionUser({ is_seller: isSeller });
            return next;
          });
        }
      } catch (err: any) {
        if (mounted) setStatusMsg(fromErr(err, 'acct.errLoadPurchases'));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  // Handle Regenerate Embed Key
  const handleRegenerateKey = async (purchaseId: string) => {
    if (!token) return;
    if (!window.confirm(t('me.regenConfirm'))) {
      return;
    }

    try {
      setBusyAction(`regen-${purchaseId}`);
      setStatusMsg(null);
      const res = await regenerateEmbedKey(purchaseId, token);
      setPurchases((prev) =>
        prev.map((p) => (p.id === purchaseId ? { ...p, embedKey: res.embedKey } : p)),
      );
      setStatusMsg({ key: 'me.regenDone' });
    } catch (err: any) {
      setStatusMsg(fromErr(err, 'me.regenFail'));
    } finally {
      setBusyAction(null);
    }
  };

  // Handle Download GLB with Watermark
  const handleDownload = async (modelId: string, title: string) => {
    try {
      setBusyAction(`dl-${modelId}`);
      setStatusMsg(null);
      await downloadModelGlb(modelId, title, token);
      setStatusMsg({ key: 'me.dlStarted', vars: { title } });
    } catch (err: any) {
      if (err instanceof DownloadError && err.serverMessage) {
        setStatusMsg(fromErr(serverError(err.serverMessage), 'me.dlFailed'));
      } else {
        setStatusMsg(fromErr(err, 'me.dlFailed'));
      }
    } finally {
      setBusyAction(null);
    }
  };

  // Copy helper
  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
        <p className="font-mono text-sm text-white/50">{t('me.loading')}</p>
      </main>
    );
  }

  // Not logged in view
  if (!token) {
    return (
      <main className="mx-auto max-w-[800px] px-4 pb-16 pt-28 md:px-6">
        <div className={`${CARD} text-center`}>
          <p className={LABEL}>{t('me.needLabel')}</p>
          <h1 className="mt-4 font-display text-2xl uppercase tracking-wide text-white">{t('me.needTitle')}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            {t('me.needBody')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/login"
              className="h-10 rounded-lg bg-white px-5 text-sm font-medium leading-10 text-black transition-colors hover:bg-white/85"
            >
              {t('me.needLogin')}
            </Link>
            <Link
              href="/gallery"
              className="h-10 rounded-lg border border-white/20 px-5 text-sm font-mono uppercase tracking-wider leading-10 text-white/80 transition-colors hover:bg-white/10"
            >
              {t('me.browse')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const displayName = user?.display_name || user?.email?.split('@')[0] || 'User';
  const handle = creatorHandle(displayName);

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      {/* Notices from admins: a suspension or its end, a license change, with the reason */}
      <NoticeBox token={token} />

      {/* Toast / Notification */}
      {statusMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-hud/30 bg-hud/10 px-4 py-3 text-sm text-hud">
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

      {/* Profile Header */}
      <div className={`${CARD} flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={displayName} avatarUrl={user?.avatar_url} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words font-display text-2xl uppercase text-white">{displayName}</h1>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  user?.is_seller
                    ? 'border-hud/40 bg-hud/15 text-hud'
                    : 'border-white/20 bg-white/5 text-white/70'
                }`}
              >
                {user?.is_seller ? t('me.creator') : t('me.buyer')}
              </span>
            </div>
            <p className="mt-1 break-all font-mono text-xs text-white/50">{user?.email}</p>
          </div>
        </div>

        {/* Action button based on Seller status */}
        <div className="flex flex-wrap gap-2">
          {user?.is_seller ? (
            <>
              <Link
                href={handle ? `/creators/${encodeURIComponent(handle)}` : '/seller'}
                className="flex h-9 items-center gap-2 rounded-lg border border-hud/30 bg-hud/10 px-3.5 text-xs font-mono uppercase tracking-wider text-hud transition-colors hover:bg-hud/20"
              >
                <UserIcon className="h-4 w-4" />
                {t('me.creatorProfile')}
              </Link>
              <Link
                href="/upload"
                className="flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-mono uppercase tracking-wider text-black transition-colors hover:bg-white/85"
              >
                <Layers className="h-4 w-4" />
                {t('me.uploadGlb')}
              </Link>
            </>
          ) : (
            <Link
              href="/creator"
              className="flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-xs font-mono uppercase tracking-wider text-black transition-colors hover:bg-white/85"
            >
              <Sparkles className="h-4 w-4" />
              {t('me.becomeCreator')}
            </Link>
          )}
        </div>
      </div>

      {/* Become a Creator Banner (if not seller) */}
      {!user?.is_seller && (
        <div className="mt-6 rounded-lg border border-hud/30 bg-gradient-to-r from-hud/10 via-transparent to-transparent p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={LABEL}>{t('me.oppLabel')}</p>
              <h2 className="mt-1 font-display text-lg uppercase text-white">{t('me.oppTitle')}</h2>
              <p className="mt-1 text-sm text-white/65">
                {t('me.oppBody')}
              </p>
            </div>
            <Link
              href="/creator"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-hud px-4 py-2 font-mono text-xs uppercase tracking-wider text-black font-semibold transition-colors hover:bg-hud/85"
            >
              {t('me.enableSeller')}
            </Link>
          </div>
        </div>
      )}

      {/* Purchases Section */}
      <section className="mt-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="font-display text-lg uppercase text-white">
            {t('me.purchasesTitle')}
            <span className="ml-2 font-mono text-xs text-white/50">({purchases.length})</span>
          </h2>
          <Link
            href="/gallery"
            className="font-mono text-xs text-hud transition-colors hover:underline"
          >
            {t('me.explore')}
          </Link>
        </div>

        {purchases.length === 0 ? (
          <div className={`${CARD} mt-6 text-center py-12`}>
            <KeyRound className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-display text-base uppercase text-white">{t('me.noneTitle')}</h3>
            <p className="mt-1 text-sm text-white/50">
              {t('me.noneBody')}
            </p>
            <Link
              href="/gallery"
              className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-xs font-mono uppercase tracking-wider text-black transition-colors hover:bg-white/85"
            >
              {t('me.noneButton')}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6">
            {purchases.map((item) => {
              const vmSnippet = buildVmModelSnippet({
                origin,
                modelId: item.modelId,
                embedKey: item.embedKey,
              });

              return (
                <div key={item.id} className={`${CARD} min-w-0 space-y-4`}>
                  {/* Top Bar: Title, License, Price, Actions */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/models/${item.modelId}`}
                          className="font-display text-lg uppercase text-white transition-colors hover:text-hud"
                        >
                          {item.title}
                        </Link>
                        <span className="rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/65">
                          {item.licenseType}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-white/40">
                        {t('me.purchasedFor', { price: formatPrice(item.amountCents || item.priceCents), id: item.modelId })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyAction === `dl-${item.modelId}`}
                        onClick={() => handleDownload(item.modelId, item.title)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 font-mono text-xs uppercase tracking-wider text-white transition-colors hover:bg-white/10 disabled:opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t('me.download')}
                      </button>
                    </div>
                  </div>

                  {/* Embed Key Box */}
                  <div className="rounded-lg border border-white/10 bg-black/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <KeyRound className="h-4 w-4 text-hud" />
                        <span className="font-mono text-xs uppercase tracking-wider text-white/80">
                          {t('me.keyLabel')}
                        </span>
                        <code className="break-all rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-hud">
                          {item.embedKey}
                        </code>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(item.embedKey, `key-${item.id}`)}
                          className="flex h-7 items-center gap-1 rounded border border-white/15 px-2 font-mono text-[11px] text-white/70 hover:text-white"
                        >
                          {copiedKey === `key-${item.id}` ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" /> {t('me.copied')}
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> {t('me.copyKey')}
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={busyAction === `regen-${item.id}`}
                          onClick={() => handleRegenerateKey(item.id)}
                          className="flex h-7 items-center gap-1 rounded border border-red-500/30 px-2 font-mono text-[11px] text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                          title={t('me.regenerateTip')}
                        >
                          <RefreshCw className={`h-3 w-3 ${busyAction === `regen-${item.id}` ? 'animate-spin' : ''}`} />
                          {t('me.regenerate')}
                        </button>
                      </div>
                    </div>

                    {/* Code Snippets for web developers */}
                    <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-white/50 flex items-center gap-1">
                          <Code2 className="h-3.5 w-3.5" /> {t('me.snippet')}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(vmSnippet, `vm-${item.id}`)}
                          className="font-mono text-[11px] text-hud/80 hover:text-hud"
                        >
                          {copiedKey === `vm-${item.id}` ? t('me.snippetCopied') : t('me.snippetCopy')}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-white/70">
                        {vmSnippet}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
