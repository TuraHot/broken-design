'use client';

// The Creator butterfly with HUD callouts: small info cards joined by leader lines to spots on the butterfly (the lines
// follow the wings as they beat). Cards and lines only show from `md` up; on phones there is just the butterfly.
import { useCallback, useEffect, useRef, useState } from 'react';
import CreatorViewer from '@/components/viewer/CreatorViewer';
import type { ButterflyAnchors } from '@/components/viewer/ButterflyScene';

const CLIP = 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))';

// Facts come from the product scope (docs/PRD.md); nothing here is a live number.
const CALLOUTS = [
  { id: 'antenna', side: 'left', pos: 'left-0 top-[16%]', tag: 'Antenna', title: 'Embed', lines: ['<vm-model>', 'or iframe'] },
  { id: 'fore', side: 'right', pos: 'right-0 top-[6%]', tag: 'Wing 01', title: 'Upload', lines: ['.glb, glTF 2.0', 'up to 50 MB'] },
  { id: 'hind', side: 'right', pos: 'right-0 bottom-[12%]', tag: 'Wing 02', title: 'License', lines: ['Open licenses', 'Free or paid'] },
] as const;

type Id = (typeof CALLOUTS)[number]['id'];

// Callout cards and leader lines are switched off for now; set to true to bring them back.
const SHOW_CALLOUTS = false;

export default function CreatorModel() {
  const cards = useRef<Partial<Record<Id, HTMLDivElement | null>>>({});
  const lines = useRef<Partial<Record<Id, SVGLineElement | null>>>({});
  const dots = useRef<Partial<Record<Id, SVGGElement | null>>>({});

  // Only track the butterfly when the callouts are actually visible.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(SHOW_CALLOUTS && mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Called every frame by the scene: move each line from its card edge to the butterfly spot (no React re-render).
  const onProject = useCallback((anchors: ButterflyAnchors) => {
    for (const c of CALLOUTS) {
      const card = cards.current[c.id];
      const line = lines.current[c.id];
      const dot = dots.current[c.id];
      if (!card || !line || !dot) continue;
      const p = anchors[c.id];
      line.setAttribute('x1', String(c.side === 'left' ? card.offsetLeft + card.offsetWidth : card.offsetLeft));
      line.setAttribute('y1', String(card.offsetTop + card.offsetHeight / 2));
      line.setAttribute('x2', String(p.x));
      line.setAttribute('y2', String(p.y));
      dot.setAttribute('transform', `translate(${p.x} ${p.y})`);
    }
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[600px] lg:mx-0 lg:justify-self-end">
      {/* screen blend: the black canvas turns see-through, so the page's wave shows behind the butterfly's light */}
      <div className="absolute inset-0 z-[6] mix-blend-screen">
        <CreatorViewer onProject={wide ? onProject : undefined} />
      </div>
      <div aria-hidden className={`pointer-events-none absolute inset-0 z-[7] hidden ${SHOW_CALLOUTS ? 'md:block' : ''}`}>
        <svg className="absolute inset-0 h-full w-full">
          {CALLOUTS.map((c) => (
            <g key={c.id}>
              <line ref={(el) => { lines.current[c.id] = el; }} stroke="rgba(143,211,255,0.55)" strokeWidth="1" />
              <g ref={(el) => { dots.current[c.id] = el; }}>
                <circle r="6" fill="none" stroke="rgba(143,211,255,0.5)" strokeWidth="1" />
                <circle r="2.5" fill="#8fd3ff" />
              </g>
            </g>
          ))}
        </svg>
        {CALLOUTS.map((c) => (
          <div
            key={c.id}
            ref={(el) => { cards.current[c.id] = el; }}
            className={`absolute ${c.pos} w-[112px] border border-hud/40 bg-[rgba(4,8,18,0.66)] p-2.5 xl:w-[140px]`}
            style={{ clipPath: CLIP }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-hud/70">[ {c.tag} ]</p>
            <p className="mt-1.5 font-display text-[11px] uppercase text-white">{c.title}</p>
            {c.lines.map((l) => (
              <p key={l} className="mt-1 font-mono text-[10.5px] leading-snug text-white/65">
                {l}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
