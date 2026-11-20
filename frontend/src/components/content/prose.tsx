// Small building blocks for the text pages (/docs, /licenses and the legal pages). Server components, no state.
import { Info } from 'lucide-react';

export const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft';

/** Label, page title and an optional intro, used at the top of every text page. */
export function PageHeader({ label, title, intro }: { label: string; title: string; intro?: React.ReactNode }) {
  return (
    <header>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">[ {label} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{title}</h1>
      {intro && <div className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-ink-soft">{intro}</div>}
    </header>
  );
}

/** A titled block with an anchor (`#id`) so the table of contents can link to it. */
export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-2 text-[15px] font-medium text-ink">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[72ch] text-[15px] leading-relaxed text-ink-soft">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft marker:text-ink/40">{children}</ul>;
}

export function OL({ children }: { children: React.ReactNode }) {
  return <ol className="max-w-[72ch] list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft marker:font-mono marker:text-accent">{children}</ol>;
}

/** Inline code. */
export function C({ children }: { children: React.ReactNode }) {
  return <code className="rounded border border-line bg-ink/5 px-1.5 py-0.5 font-mono text-[13px] text-ink/80">{children}</code>;
}

/** A highlighted note. The icon and the heading word carry the meaning, not only the colour. */
export function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="max-w-[72ch] rounded-lg border border-accent/40 bg-ink/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Info aria-hidden className="h-4 w-4 shrink-0 text-accent" />
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </aside>
  );
}

/** A table that scrolls sideways inside its frame on a phone instead of widening the page. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-lg border border-line bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink/50">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-ink-soft">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line align-top">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-medium text-ink' : 'text-ink-soft'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
