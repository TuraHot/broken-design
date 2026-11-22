"use client";

//  Model download & checkout actions connected to CDN (/cdn/models/:id/download) & Core API
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { checkModelPurchased, CORE_API_URL } from "@/lib/api";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { DownloadError, downloadModelGlb } from "@/lib/model-assets";
import { readSession, SESSION_UPDATED_EVENT, type Session } from "@/lib/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What the status line shows: a text of ours (kept as a key, so it follows the language) or a message the server sent
// (shown as the server wrote it).
type Status = { key: MessageKey; vars?: Record<string, string | number> } | { text: string } | null;

// A failure that carries one of our own texts.
class UiMessage extends Error {
  constructor(
    public key: MessageKey,
    public vars?: Record<string, string | number>,
  ) {
    super(key);
  }
}

export default function ModelActions({
  modelId,
  ownerId,
  title = "model",
  free,
  priceLabel,
  creator,
}: {
  modelId?: string;
  ownerId?: string;
  title?: string;
  free: boolean;
  priceLabel: string;
  creator?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [checkingPurchased, setCheckingPurchased] = useState(false);
  const busyRef = useRef(false);

  const isRealModel = Boolean(modelId && UUID_RE.test(modelId));

  useEffect(() => {
    let active = true;
    const syncSession = async () => {
      const s = readSession();
      setSession(s);
      const isAuth = s !== null;
      setSignedIn(isAuth);
      setReady(true);

      if (s?.token && isRealModel && modelId && !free) {
        setCheckingPurchased(true);
        try {
          const res = await checkModelPurchased(modelId, s.token);
          if (active && res.purchased) {
            setHasPurchased(true);
          } else if (active) {
            setHasPurchased(false);
          }
        } catch {
          // Keep current state on transient failure
        } finally {
          if (active) setCheckingPurchased(false);
        }
      } else {
        setHasPurchased(false);
      }
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener(SESSION_UPDATED_EVENT, syncSession);
    return () => {
      active = false;
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(SESSION_UPDATED_EVENT, syncSession);
    };
  }, [modelId, isRealModel, free]);

  const isOwner = Boolean(
    session?.user &&
      (ownerId
        ? session.user.id === ownerId
        : Boolean(
            creator &&
              session.user.display_name?.trim().toLowerCase() === creator.trim().toLowerCase(),
          )),
  );

  const failure = (err: unknown, fallback: MessageKey): Status => {
    if (err instanceof UiMessage) return { key: err.key, vars: err.vars };
    if (err instanceof Error && err.message) return { text: err.message };
    return { key: fallback };
  };

  const performDownload = async (id: string, token?: string | null) => {
    try {
      await downloadModelGlb(id, title, token);
      setStatus({ key: "model.dlStarted" });
    } catch (err) {
      if (err instanceof DownloadError) {
        if (err.serverMessage) throw new Error(err.serverMessage);
        throw new UiMessage("model.dlFailedStatus", { status: err.status });
      }
      throw err;
    }
  };

  const handleDownload = async () => {
    if (busyRef.current) return;
    if (isOwner) {
      setStatus({ key: "model.ownerNote" });
      return;
    }
    if (!isRealModel || !modelId) {
      setStatus({ key: "model.dlSample" });
      return;
    }

    const session = readSession();
    setSignedIn(session !== null);
    if (!free && !session) {
      setStatus({ key: "model.dlLogin" });
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setStatus(null);
      await performDownload(modelId, session?.token ?? null);
    } catch (err) {
      setStatus(failure(err, "model.dlFailed"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleBuy = async () => {
    if (busyRef.current) return;
    if (isOwner) {
      setStatus({ key: "model.ownerNote" });
      return;
    }
    if (hasPurchased) {
      setStatus({ key: "model.alreadyPurchased" });
      return;
    }
    if (!isRealModel || !modelId) {
      setStatus({ key: "model.buySample" });
      return;
    }

    const session = readSession();
    setSignedIn(session !== null);
    if (!session) {
      setStatus({ key: "model.buyLogin" });
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setStatus(null);
      const checkoutRes = await fetch(
        `${CORE_API_URL}/api/models/${encodeURIComponent(modelId)}/checkout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
        },
      );
      const checkoutData = await checkoutRes.json().catch(() => null);

      if (checkoutData?.error?.code === "ALREADY_PURCHASED") {
        setHasPurchased(true);
        setStatus({ key: "model.alreadyPurchased" });
        return;
      }

      if (!checkoutRes.ok) {
        if (checkoutData?.error?.message) throw new Error(checkoutData.error.message);
        throw new UiMessage("model.buyFailedStatus", { status: checkoutRes.status });
      }

      if (checkoutData?.checkoutUrl) {
        router.push(checkoutData.checkoutUrl);
        return;
      }

      if (checkoutData?.message) throw new Error(checkoutData.message);
      throw new UiMessage("model.buyNoUrl");
    } catch (err) {
      setStatus(failure(err, "model.buyFailed"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {hasPurchased ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2 text-sm font-medium text-accent">
            <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-accent" />
            <span>{t("model.alreadyPurchased")}</span>
          </div>

          <button
            type="button"
            disabled={!ready || !signedIn || busy}
            onClick={handleDownload}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-3.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Download aria-hidden className="h-4 w-4" />
            )}
            {busy ? t("model.processing") : t("model.downloadGlb")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!ready || (!free && !signedIn) || busy || isOwner || checkingPurchased}
          onClick={free ? handleDownload : handleBuy}
          className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3.5 text-[15px] font-medium transition-colors ${
            isOwner
              ? "border border-line bg-ink/5 text-ink/40 cursor-not-allowed"
              : "bg-ink text-canvas hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
          }`}
        >
          {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {busy
            ? t("model.processing")
            : isOwner
              ? t("model.ownerDisabled")
              : free
                ? t("model.getFree")
                : t("model.buy", { price: priceLabel })}
        </button>
      )}

      {ready && !signedIn && !free && (
        <p className="text-xs text-ink-soft">
          {t("model.loginPre")}{" "}
          <Link href="/login" className="font-medium text-accent underline underline-offset-2 hover:text-ink">
            {t("model.loginLink")}
          </Link>{" "}
          {t("model.loginPost")}
        </p>
      )}

      {status && (
        <p role="status" className="text-sm text-warn">
          {"text" in status ? status.text : t(status.key, status.vars)}
        </p>
      )}
    </div>
  );
}
