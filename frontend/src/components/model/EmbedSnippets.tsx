'use client';

// "How to use": copy-ready embed code (web component or iframe) with a short numbered guide.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Copy, Lock } from 'lucide-react';
import { CDN_SERVICE_URL } from '@/lib/api';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { readSession } from '@/lib/session';

type Kind = 'component' | 'iframe';

const TABS: { id: Kind; label: string }[] = [
  { id: 'component', label: '<vm-model>' },
  { id: 'iframe', label: 'iframe' },
];

export default function EmbedSnippets({ id, paid }: { id: string; paid: boolean }) {
  const t = useT();
  const [kind, setKind] = useState<Kind>('component');
  const [copied, setCopied] = useState(false);
  // Default to localhost:3000 so snippets never copy with an empty/relative origin before hydration.
  const [origin, setOrigin] = useState('http://localhost:3000');
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    const syncSession = () => {
      setSignedIn(readSession() !== null);
      setReady(true);
    };
    syncSession();
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  const canUseEmbed = ready && signedIn;
  const key = paid ? ' key="YOUR_EMBED_KEY"' : '';
  const code =
    kind === 'component'
      ? `<script type="module" src="${origin}/embed.js"></script>\n<vm-model model-id="${id}" cdn-base="${CDN_SERVICE_URL}"${key} auto-rotate camera-controls></vm-model>`
      : `<iframe\n  src="${origin}/embed/${id}${paid ? '?key=YOUR_EMBED_KEY' : ''}"\n  width="600"\n  height="400"\n  loading="lazy"\n  allow="fullscreen"\n  style="border:0"\n></iframe>`;

  const selectKind = (next: Kind) => {
    if (!readSession()) {
      setSignedIn(false);
      return;
    }
    setKind(next);
  };

  const copy = async () => {
    if (!readSession()) {
      setSignedIn(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const steps: MessageKey[] = paid
    ? ['embed.snip.buy', 'embed.snip.keyStep', 'embed.snip.pastePaid']
    : ['embed.snip.copyBelow', 'embed.snip.paste', 'embed.snip.done'];

  return (
    <div>
      <ol className="space-y-2 text-sm text-ink-soft">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="font-mono text-[11px] leading-5 tracking-[0.16em] text-accent">0{i + 1}</span>
            <span>{t(s)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div role="tablist" aria-label={t('embed.snip.type')} className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              disabled={!canUseEmbed}
              aria-selected={kind === tab.id}
              onClick={() => selectKind(tab.id)}
              className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                kind === tab.id ? 'border-ink/50 text-ink' : 'border-line text-ink-soft hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!canUseEmbed}
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copied ? <Check aria-hidden className="h-4 w-4 text-accent" /> : <Copy aria-hidden className="h-4 w-4" />}
          {copied ? t('embed.snip.copied') : t('embed.snip.copy')}
        </button>
      </div>
      <div className="relative mt-2">
        <pre
          aria-hidden={!canUseEmbed}
          className={`max-w-full overflow-x-auto rounded-lg border border-line bg-canvas px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink/80 transition ${
            !canUseEmbed ? 'pointer-events-none min-h-[120px] select-none blur-[4px]' : ''
          }`}
        >
          <code>{code}</code>
        </pre>
        {ready && !signedIn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-line bg-canvas/75 p-4 text-center backdrop-blur-[2px]">
            <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              <Lock aria-hidden className="h-3.5 w-3.5" />
              {t('embed.snip.loginRequired')}
            </div>
            <p className="max-w-xs text-xs text-ink/75">
              {t('embed.snip.loginHint')}
            </p>
            <Link
              href="/login"
              className="mt-1 inline-flex h-8 items-center rounded-lg bg-ink px-3.5 text-xs font-medium text-canvas transition-colors hover:bg-ink/85"
            >
              {t('embed.snip.login')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
