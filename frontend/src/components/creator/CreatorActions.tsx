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
import { readSession, type Session } from '@/lib/session';

const PRIMARY_BTN =
  'inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85';
const PENDING_BTN =
  'inline-flex items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3.5 py-1.5 text-[15px] font-medium text-amber';
const OUTLINE_BTN =
  'border border-white px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black';

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
          const updatedUser = { ...current.user, is_seller: true, role: 'creator' as const };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setSession({ token, user: updatedUser });
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
        const updatedUser = { ...session.user, is_seller: true, role: 'creator' as const };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setSession({ token: session.token, user: updatedUser });
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
            Creator profile
          </Link>
        ) : user ? (
          isPending ? (
            <span className={PENDING_BTN}>
              <Clock aria-hidden className="h-4 w-4" />
              Pending Admin Approval
            </span>
          ) : (
            <button type="button" onClick={openRulesModal} className={PRIMARY_BTN}>
              Become a creator
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          )
        ) : (
          <Link href="/login" className={PRIMARY_BTN}>
            Get started
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        )}
        <a href="#how-it-works" className={OUTLINE_BTN}>
          See how it works
        </a>
      </div>

      {!isCreator && application?.status === 'rejected' && (
        <p className="mt-3 text-xs text-amber">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
        >
          {step === 1 ? (
            <form
              onSubmit={handleStep1Continue}
              className="max-h-[90dvh] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b0d12] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-hud">
                  <ShieldCheck className="h-4 w-4" />
                  [ Creator Rules ]
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-white/50">1/2</span>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded p-1 text-white/55 hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h2 className="mt-2 font-display text-xl uppercase text-white">
                Creator Rules &amp; Terms
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Please read and accept the rules below before continuing.
              </p>

              <ul className="mt-4 space-y-2.5">
                {CREATOR_RULES.map((rule) => (
                  <li
                    key={rule.title}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
                  >
                    <p className="text-xs font-semibold text-white">{rule.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/65">{rule.body}</p>
                  </li>
                ))}
              </ul>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-black accent-white"
                />
                <span>
                  I have read and agree to the Creator Rules and{' '}
                  <Link href="/seller-terms" className="text-hud underline underline-offset-2">
                    Seller Terms
                  </Link>
                  .
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-lg border border-white/20 px-4 text-xs text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!agreed}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 text-xs font-semibold text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleFinalSubmit}
              className="w-full max-w-[440px] rounded-2xl border border-white/15 bg-[#12141c] p-6 shadow-2xl"
            >
              {/* Top bar: < Back and 2/2 (matching VGen popup) */}
              <div className="flex items-center justify-between text-white/75">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setStep(1);
                  }}
                  className="rounded-lg p-1 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Back to rules"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="font-mono text-xs font-semibold text-white/65">2/2</span>
              </div>

              <h2 className="mt-4 font-display text-2xl font-bold text-white">
                Finish applying
              </h2>

              {/* Toggle row: I have a Creator Invite Code */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">
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
                    hasInviteCode ? 'bg-hud' : 'bg-white/25'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      hasInviteCode ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {hasInviteCode ? (
                <div className="mt-4">
                  <label htmlFor="creator-invite-code" className="block text-xs text-white/70">
                    Creator Invite Code
                  </label>
                  <div className="relative mt-1.5">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      id="creator-invite-code"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g. LIXYTE-XXXXXX"
                      className="h-11 w-full rounded-xl border border-white/15 bg-black/50 pl-9 pr-3 font-mono text-sm uppercase text-white placeholder:normal-case placeholder:text-white/35 focus:border-hud/60 focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/55">
                    With a valid invite code, your creator account will be activated immediately.
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <label htmlFor="creator-apply-note" className="block text-xs text-white/70">
                    About your 3D work / Portfolio link (optional)
                  </label>
                  <textarea
                    id="creator-apply-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Share your portfolio or describe your 3D models for admin review…"
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 p-3 text-xs text-white placeholder:text-white/35 focus:border-hud/60 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-white/55">
                    No invite code? Your request will be sent to an admin to verify and approve your account.
                  </p>
                </div>
              )}

              {errorMsg && (
                <p role="alert" className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || (hasInviteCode && !inviteCode.trim())}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-45"
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
