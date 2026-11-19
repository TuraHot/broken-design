"use client";

//  Model download & checkout actions connected to CDN (/cdn/models/:id/download) & Core API
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { CDN_SERVICE_URL, CORE_API_URL } from "@/lib/api";
import { readSession } from "@/lib/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ModelActions({
  modelId,
  title = "model",
  free,
  priceLabel,
}: {
  modelId?: string;
  title?: string;
  free: boolean;
  priceLabel: string;
}) {
  const router = useRouter();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const syncSession = () => {
      setSignedIn(readSession() !== null);
      setReady(true);
    };
    syncSession();
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const isRealModel = Boolean(modelId && UUID_RE.test(modelId));

  const performDownload = async (id: string, token: string) => {
    const res = await fetch(
      `${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(id)}/download`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        body?.error?.message || `Download failed (${res.status})`,
      );
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName =
      title.replace(/[^\w\u0E00-\u0E7F-]+/g, "_").replace(/^_+|_+$/g, "") ||
      "model";
    a.download = `${safeName}.glb`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusMsg("Download started (.glb)");
  };

  const handleDownload = async () => {
    if (busyRef.current) return;
    if (!isRealModel || !modelId) {
      setStatusMsg(
        "This is a sample catalogue item — upload or open a real model to download its .glb file.",
      );
      return;
    }

    const session = readSession();
    setSignedIn(session !== null);
    if (!session) {
      setStatusMsg("Please log in first to download this model.");
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setStatusMsg(null);
      await performDownload(modelId, session.token);
    } catch (err: any) {
      setStatusMsg(err?.message || "Unable to download model from CDN.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleBuy = async () => {
    if (busyRef.current) return;
    if (!isRealModel || !modelId) {
      setStatusMsg("Checkout is available for uploaded models.");
      return;
    }

    const session = readSession();
    setSignedIn(session !== null);
    if (!session) {
      setStatusMsg(
        "Please log in first to purchase or download this paid model.",
      );
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setStatusMsg(null);
      const checkoutRes = await fetch(
        `${CORE_API_URL}/api/models/${encodeURIComponent(modelId)}/checkout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
        },
      );
      const checkoutData = await checkoutRes.json().catch(() => null);

      if (checkoutData?.error?.code === "ALREADY_PURCHASED") {
        setStatusMsg("You already own this model — starting download…");
        await performDownload(modelId, session.token);
        return;
      }

      if (!checkoutRes.ok) {
        throw new Error(
          checkoutData?.error?.message ||
            `Checkout failed (${checkoutRes.status})`,
        );
      }

      if (checkoutData?.checkoutUrl) {
        router.push(checkoutData.checkoutUrl);
        return;
      }

      throw new Error(
        checkoutData?.message || "Payment checkout URL is not available.",
      );
    } catch (err: any) {
      setStatusMsg(err?.message || "Checkout could not be completed.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!ready || !signedIn || busy}
        onClick={free ? handleDownload : handleBuy}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
        {busy
          ? "Processing…"
          : free
            ? "Get this model (.glb)"
            : `Buy for ${priceLabel}`}
      </button>

      {!free && isRealModel && (
        <button
          type="button"
          disabled={!ready || !signedIn || busy}
          onClick={handleDownload}
          className="h-9 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-mono uppercase tracking-wider text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Already bought? Download .glb
        </button>
      )}

      {ready && !signedIn && (
        <p className="text-xs text-white/65">
          Please{" "}
          <Link href="/login" className="font-medium text-hud underline underline-offset-2 hover:text-white">
            log in
          </Link>{" "}
          to download or purchase this model.
        </p>
      )}

      {statusMsg && (
        <p role="status" className="text-sm text-amber">
          {statusMsg}
        </p>
      )}
    </div>
  );
}
