"use client";

// 3D Model Preview wired to the CDN (/cdn/models/:id/preview.glb & /file.glb?key=)
import { useEffect, useRef, useState } from "react";
import { Box, KeyRound, Loader2, RotateCw } from "lucide-react";
import { CDN_SERVICE_URL } from "@/lib/api";
import { useT } from "@/lib/i18n/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ModelPreview({
  id,
  title,
  paid,
  posterUrl,
}: {
  id: string;
  title: string;
  paid: boolean;
  posterUrl?: string;
}) {
  const isRealModel = UUID_RE.test(id);
  const t = useT();
  const [viewerReady, setViewerReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(isRealModel);
  const [loadFailed, setLoadFailed] = useState(!isRealModel);
  const [autoRotate, setAutoRotate] = useState(true);
  const [embedKey, setEmbedKey] = useState("");
  const [appliedKey, setAppliedKey] = useState("");
  // The "invalid key" notice is a flag, not text, so it follows the language when the visitor switches it.
  const [keyInvalid, setKeyInvalid] = useState(false);
  const viewerRef = useRef<HTMLElement | null>(null);

  const baseCdn = `${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(id)}`;
  const previewSrc = `${baseCdn}/preview.glb`;
  const fullSrc = `${baseCdn}/file.glb?key=${encodeURIComponent(appliedKey)}`;
  const activeSrc = appliedKey ? fullSrc : previewSrc;
  const poster = posterUrl || `${baseCdn}/poster.webp`;

  useEffect(() => {
    if (!isRealModel) return;
    import("@google/model-viewer")
      .then(() => setViewerReady(true))
      .catch(() => {
        setModelLoading(false);
        setLoadFailed(true);
      });
  }, [isRealModel]);

  useEffect(() => {
    if (isRealModel) setModelLoading(true);
  }, [activeSrc, isRealModel]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !viewerReady) return;

    const onError = () => {
      setModelLoading(false);
      if (appliedKey) {
        setKeyInvalid(true);
        setAppliedKey("");
      } else {
        setLoadFailed(true);
      }
    };

    const onLoad = () => {
      setModelLoading(false);
      if (appliedKey) setKeyInvalid(false);
    };

    el.addEventListener("error", onError);
    el.addEventListener("load", onLoad);
    return () => {
      el.removeEventListener("error", onError);
      el.removeEventListener("load", onLoad);
    };
  }, [viewerReady, appliedKey]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-ink/[0.06]">
        {isRealModel && viewerReady && !loadFailed ? (
          <>
            <model-viewer
              ref={viewerRef}
              src={activeSrc}
              poster={poster}
              alt={title}
              loading="eager"
              crossorigin="anonymous"
              camera-controls=""
              {...(autoRotate ? { "auto-rotate": "" } : {})}
              exposure="1"
              shadow-intensity="1"
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
              }}
            />
            {modelLoading && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas/45 backdrop-blur-[2px]"
              >
                <Loader2
                  aria-hidden
                  className="h-5 w-5 animate-spin text-accent motion-reduce:animate-none"
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                  {t('model.streaming3d')}
                </span>
              </div>
            )}
            <div className=" absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] backdrop-blur transition-colors ${
                  autoRotate
                    ? "border-accent/50 bg-canvas/70 text-accent"
                    : "border-line bg-canvas/70 text-ink/70 hover:text-ink"
                }`}
              >
                <RotateCw className="h-3.5 w-3.5" />
                {autoRotate ? t('model.rotateOn') : t('model.rotateOff')}
              </button>
            </div>
          </>
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink/40"
          >
            <Box className="h-8 w-8" />
            <span className="text-sm">{t('model.preview3d')}</span>
          </div>
        )}
      </div>

      {paid && isRealModel && !loadFailed && (
        <div className="rounded-lg border border-line bg-ink/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <input
              type="text"
              value={embedKey}
              onChange={(e) => setEmbedKey(e.target.value)}
              placeholder={t('model.keyPlaceholder')}
              className="min-w-0 flex-1 rounded border border-line bg-canvas/60 px-2.5 py-1 font-mono text-xs text-ink placeholder:text-ink/40 focus:border-accent/60 focus:outline-none"
            />
            <button
              type="button"
              disabled={modelLoading}
              onClick={() => {
                if (modelLoading) return;
                const nextKey = embedKey.trim();
                setKeyInvalid(false);
                if (nextKey === appliedKey) return;
                setAppliedKey(nextKey);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-line bg-ink/10 px-3 py-1 font-mono text-xs text-ink transition-colors hover:bg-ink/20 disabled:cursor-wait disabled:opacity-50"
            >
              {modelLoading && (
                <Loader2
                  aria-hidden
                  className="h-3.5 w-3.5 animate-spin text-accent motion-reduce:animate-none"
                />
              )}
              {appliedKey ? t('model.keyUpdate') : t('model.keyStream')}
            </button>
          </div>
          {keyInvalid && (
            <p className="mt-1.5 font-mono text-xs text-warn">
              {t('model.keyInvalid')}
            </p>
          )}
          {appliedKey && !keyInvalid && (
            <p className="mt-1.5 font-mono text-xs text-accent">
              {t('model.keyActive', { id })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
