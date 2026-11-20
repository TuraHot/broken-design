"use client";

//  Model download & checkout actions connected to CDN (/cdn/models/:id/download) & Core API
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { CORE_API_URL } from "@/lib/api";
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
  const busyRef = useRef(false);

  useEffect(() => {
    const syncSession = () => {
      const s = readSession();
      setSession(s);
      setSignedIn(s !== null);
      setReady(true);
    };
    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener(SESSION_UPDATED_EVENT, syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(SESSION_UPDATED_EVENT, syncSession);
    };
  }, []);

  const isRealModel = Boolean(modelId && UUID_RE.test(modelId));

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

  const performDownload = async (id: string, token: string) => {
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
    if (!session) {
      setStatus({ key: "model.dlLogin" });
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setStatus(null);
      await performDownload(modelId, session.token);
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
        setStatus({ key: "model.alreadyOwn" });
        await performDownload(modelId, session.token);
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
      {isOwner && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <p className="font-semibold">{t("model.ownerTitle")}</p>
          <p className="mt-0.5 text-amber-200/80">
            {t("model.ownerNote")}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!ready || !signedIn || busy || isOwner}
        onClick={free ? handleDownload : handleBuy}
        className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3.5 text-[15px] font-medium transition-colors ${
          isOwner
            ? "border border-white/15 bg-white/5 text-white/40 cursor-not-allowed"
            : "bg-white text-black hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
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

      {!free && isRealModel && !isOwner && (
        <button
          type="button"
          disabled={!ready || !signedIn || busy}
          onClick={handleDownload}
          className="h-9 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-mono uppercase tracking-wider text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("model.alreadyBought")}
        </button>
      )}

      {ready && !signedIn && (
        <p className="text-xs text-white/65">
          {t("model.loginPre")}{" "}
          <Link href="/login" className="font-medium text-hud underline underline-offset-2 hover:text-white">
            {t("model.loginLink")}
          </Link>{" "}
          {t("model.loginPost")}
        </p>
      )}

      {status && (
        <p role="status" className="text-sm text-amber">
          {"text" in status ? status.text : t(status.key, status.vars)}
        </p>
      )}
    </div>
  );
}
