"use client";

import { ChangeEvent, useRef, useState } from "react";
import { AlertCircle, Camera, Loader2, Trash2 } from "lucide-react";
import { CDN_SERVICE_URL } from "@/lib/api";
import { readSession, updateSessionUser } from "@/lib/session";
import UserAvatar from "@/components/ui/UserAvatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function AvatarUploader({
  name,
  avatarUrl,
  size = "lg",
  onUpdated,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "lg" | "xl";
  onUpdated?: (nextUrl: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (busyRef.current) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busyRef.current) return;

    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be 2 MB or smaller.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const token =
      readSession()?.token ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (!token) {
      setError("Please log in first to update your avatar.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setError(null);

      const form = new FormData();
      form.append("avatar", file);

      const res = await fetch(`${CDN_SERVICE_URL}/api/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error?.message || `Upload failed (${res.status})`,
        );
      }

      const nextUrl = data?.avatarPath
        ? `${CDN_SERVICE_URL}${data.avatarPath}`
        : null;
      updateSessionUser({ avatar_url: nextUrl });
      onUpdated?.(nextUrl);
    } catch (err: any) {
      setError(err?.message || "Could not upload avatar.");
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative">
          <UserAvatar name={name} avatarUrl={avatarUrl} size={size} />
          <button
            type="button"
            disabled={busy}
            onClick={pickFile}
            aria-label={avatarUrl ? "Change user logo" : "Upload user logo"}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-hud/60 bg-black text-hud transition-colors hover:border-white hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <Loader2
                aria-hidden
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Camera aria-hidden className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/png,image/jpeg"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="inline-flex items-center gap-1.5 text-xs text-red-300"
        >
          <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
