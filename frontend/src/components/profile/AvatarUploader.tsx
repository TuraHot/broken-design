"use client";

import { ChangeEvent, useRef, useState } from "react";
import { AlertCircle, Camera, Loader2 } from "lucide-react";
import { uploadMyAvatar } from "@/lib/auth";
import { readSession, updateSessionUser } from "@/lib/session";
import UserAvatar from "@/components/ui/UserAvatar";
import { useT } from "@/lib/i18n/client";
import { authErrorText } from "@/lib/i18n/auth-error";
import type { MessageKey } from "@/lib/i18n/messages";

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
  const t = useT();
  // Either a key of ours or an error from the server; both are turned into text when drawn, so they follow the language.
  const [error, setError] = useState<{ key: MessageKey } | { err: unknown } | null>(null);
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
      setError({ key: "avatar.errBig" });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const token =
      readSession()?.token ||
      (typeof window !== "undefined" ? readSession()?.token ?? null : null);
    if (!token) {
      setError({ key: "avatar.errLogin" });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      setError(null);

      const nextUrl = await uploadMyAvatar(file, token, file.name);
      updateSessionUser({ avatar_url: nextUrl });
      onUpdated?.(nextUrl);
    } catch (err: any) {
      setError({ err });
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
            aria-label={avatarUrl ? t('avatar.change') : t('avatar.upload')}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-accent/60 bg-canvas text-accent transition-colors hover:border-ink hover:text-ink disabled:cursor-wait disabled:opacity-60"
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
          className="inline-flex items-center gap-1.5 text-xs text-danger"
        >
          <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span>{'key' in error ? t(error.key) : authErrorText(error.err, t, 'avatar.errUpload')}</span>
        </p>
      )}
    </div>
  );
}
