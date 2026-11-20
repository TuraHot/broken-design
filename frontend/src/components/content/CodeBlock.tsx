'use client';

// A code sample with a Copy button
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export default function CodeBlock({ code, label }: { code: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className="max-w-full">
      <div className="flex items-center justify-between gap-3">
        <figcaption className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">{label}</figcaption>
        <button
          type="button"
          onClick={copy}
          aria-label={t('doc.copyLabel', { label })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          {copied ? <Check aria-hidden className="h-4 w-4 text-accent" /> : <Copy aria-hidden className="h-4 w-4" />}
          {copied ? t('doc.copied') : t('doc.copy')}
        </button>
      </div>
      <pre tabIndex={0} className="mt-1 max-w-full overflow-x-auto rounded-lg border border-line bg-canvas px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink/50">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
