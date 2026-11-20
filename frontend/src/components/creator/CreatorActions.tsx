'use client';

// Client-side CTA buttons on /creator:
// - Creator/Seller -> links to /creators/[handle]?tab=dashboard
// - Signed-in buyer -> Step 1/2: Creator Rules Agreement -> Step 2/2: Invite Code popup (or Admin Approval)
// - Signed-out visitor -> links to /login
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Clock,
  KeyRound,
  Loader2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  applyAsCreator,
  fetchMyCreatorApplication,
  fetchSellerStatus,
  type CreatorApplication,
} from '@/lib/api';
import { creatorHandle } from '@/lib/creators';
import { useT } from '@/lib/i18n/client';
import { readSession, updateSessionUser, type Session } from '@/lib/session';

const PRIMARY_BTN =
  'inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-1.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85';
const PENDING_BTN =
  'inline-flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3.5 py-1.5 text-[15px] font-medium text-warn';
const OUTLINE_BTN =
  'border border-ink px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink transition-colors hover:bg-ink hover:text-canvas';

const CREATOR_RULES = [
  {
    title: '1. Original Work & Copyright',
    body: 'You must own or hold full publishing rights to every .glb model you upload. Ripped, stolen, or unauthorized models will be removed.',
  },
  {
    title: '2. File & Watermark Standards',
    body: 'Main and preview .glb files can be up to 50 MB. All uploaded models receive Lixyte dual-layer license and steganography watermarking.',
  },
  {
    title: '3. Platform Escrow & 7% Fee',
    body: 'Sales proceeds are held in your platform wallet first. A 7% platform fee is calculated and deducted when you request a withdrawal.',
  },
  {
    title: '4. Buyer Access & Soft Delete',
    body: 'Removing a model hides it from the public gallery, while existing buyers keep access to their purchased files and embed keys.',
  },
];

export default function CreatorActions() {
  const t = useT();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [application, setApplication] = useState<CreatorApplication | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [agreed, setAgreed] = useState(false);
  const [hasInviteCode, setHasInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const current = readSession();
    setSession(current);

    if (current && current.user.role !== 'admin') {
      const token = current.token;
      Promise.all([
        fetchSellerStatus(token).catch(() => false),
        fetchMyCreatorApplication(token).catch(() => null),
      ]).then(([sellerActive, app]) => {
        if (sellerActive && !current.user.is_seller) {
          const nextRole = current.user.role === 'user' ? ('creator' as const) : current.user.role;
          const updated = updateSessionUser({ is_seller: true, role: nextRole });
          if (updated) setSession(updated);
        }
        setApplication(app);
      });
    }

    const onStorage = () => setSession(readSession());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const user = session?.user;
  const isCreator = Boolean(user && user.role !== 'admin' && (user.is_seller || user.role === 'creator'));
  const displayName = user?.display_name?.trim() || user?.email || '';
  const handle = displayName ? creatorHandle(displayName) : '';
  const isPending = application?.status === 'pending';

  const openRulesModal = () => {
    setStep(1);
    setAgreed(false);
    setHasInviteCode(false);
    setInviteCode('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setErrorMsg(null);
    setStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || submitting) return;

    if (hasInviteCode && !inviteCode.trim()) {
      setErrorMsg('Please enter your Creator Invite Code.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await applyAsCreator(session.token, {
        note: hasInviteCode ? '' : note,
        inviteCode: hasInviteCode ? inviteCode.trim() : undefined,
      });

      if (res.approved) {
        const nextRole = session.user.role === 'user' ? ('creator' as const) : session.user.role;
        const updated = updateSessionUser({ is_seller: true, role: nextRole });
        if (updated) setSession(updated);
        setModalOpen(false);
        router.push(handle ? `/creators/${handle}?tab=dashboard` : '/me');
        return;
      }

      setApplication(res.application);
      setModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit creator application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        {isCreator && handle ? (
          <Link href={`/creators/${handle}?tab=dashboard`} className={PRIMARY_BTN}>
            <User aria-hidden className="h-4 w-4" />
            {t('creator.profile')}
          </Link>
        ) : user ? (
          isPending ? (
            <span className={PENDING_BTN}>
              <Clock aria-hidden className="h-4 w-4" />
              Pending Admin Approval
            </span>
          ) : (
            <button type="button" onClick={openRulesModal} className={PRIMARY_BTN}>
              {t('creator.become')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          )
        ) : (
          <Link href="/login" className={PRIMARY_BTN}>
            {t('creator.start')}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        )}
        <a href="#how-it-works" className={OUTLINE_BTN}>
          {t('creator.how')}
        </a>
      </div>

      {!isCreator && application?.status === 'rejected' && (
        <p className="mt-3 text-xs text-warn">
          Previous application was not approved
          {application.adminNote ? `: ${application.adminNote}` : '.'} You may review the rules and apply again.
        </p>
      )}

      {/* Multi-step Creator Modal: Step 1/2 Rules -> Step 2/2 Invite Code or Admin Approval */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Become a Creator"
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 px-4 py-6 backdrop-blur-sm"
        >
          {step === 1 ? (
            <form
              onSubmit={handleStep1Continue}
              className="max-h-[90dvh] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                  <ShieldCheck className="h-4 w-4" />
                  [ Creator Rules ]
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink/50">1/2</span>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded p-1 text-ink/55 hover:bg-ink/10 hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h2 className="mt-2 font-display text-xl uppercase text-ink">
                Creator Rules &amp; Terms
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Please read and accept the rules below before continuing.
              </p>

              <ul className="mt-4 space-y-2.5">
                {CREATOR_RULES.map((rule) => (
                  <li
                    key={rule.title}
                    className="rounded-xl border border-line bg-ink/[0.03] p-3.5"
                  >
                    <p className="text-xs font-semibold text-ink">{rule.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{rule.body}</p>
                  </li>
                ))}
              </ul>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-ink/[0.02] p-3 text-xs text-ink/80">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 bg-canvas accent-ink"
                />
                <span>
                  I have read and agree to the Creator Rules and{' '}
                  <Link href="/seller-terms" className="text-accent underline underline-offset-2">
                    Seller Terms
                  </Link>
                  .
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-lg border border-line px-4 text-xs text-ink/80 hover:bg-ink/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!agreed}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-5 text-xs font-semibold text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleFinalSubmit}
              className="w-full max-w-[440px] rounded-2xl border border-line bg-card p-6 shadow-2xl"
            >
              {/* Top bar: < Back and 2/2 (matching VGen popup) */}
              <div className="flex items-center justify-between text-ink/75">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setStep(1);
                  }}
                  className="rounded-lg p-1 transition-colors hover:bg-ink/10 hover:text-ink"
                  aria-label="Back to rules"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="font-mono text-xs font-semibold text-ink-soft">2/2</span>
              </div>

              <h2 className="mt-4 font-display text-2xl font-bold text-ink">
                Finish applying
              </h2>

              {/* Toggle row: I have a Creator Invite Code */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">
                  I have a Creator Invite Code
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasInviteCode}
                  onClick={() => {
                    setHasInviteCode((v) => !v);
                    setErrorMsg(null);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    hasInviteCode ? 'bg-accent' : 'bg-ink/25'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-ink shadow transition-transform ${
                      hasInviteCode ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {hasInviteCode ? (
                <div className="mt-4">
                  <label htmlFor="creator-invite-code" className="block text-xs text-ink/70">
                    Creator Invite Code
                  </label>
                  <div className="relative mt-1.5">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                    <input
                      id="creator-invite-code"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g. LIXYTE-XXXXXX"
                      className="h-11 w-full rounded-xl border border-line bg-canvas/50 pl-9 pr-3 font-mono text-sm uppercase text-ink placeholder:normal-case placeholder:text-ink/35 focus:border-accent/60 focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    With a valid invite code, your creator account will be activated immediately.
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <label htmlFor="creator-apply-note" className="block text-xs text-ink/70">
                    About your 3D work / Portfolio link (optional)
                  </label>
                  <textarea
                    id="creator-apply-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Share your portfolio or describe your 3D models for admin review…"
                    className="mt-1.5 w-full rounded-xl border border-line bg-canvas/50 p-3 text-xs text-ink placeholder:text-ink/35 focus:border-accent/60 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-ink/55">
                    No invite code? Your request will be sent to an admin to verify and approve your account.
                  </p>
                </div>
              )}

              {errorMsg && (
                <p role="alert" className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || (hasInviteCode && !inviteCode.trim())}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting
                  ? 'Processing…'
                  : hasInviteCode
                    ? 'Verify Code & Become Creator'
                    : 'Submit for Admin Approval'}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
