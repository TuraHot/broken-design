'use client';

// The framed area on the right of the hero: grid lines, a status chip, an info box and a corner tag. The 3D lily is
// drawn into it by the scene (step 4); the chip and the info box show the scene's real numbers (lib/lily-telemetry.ts)
// and read "standby" / dashes until the scene publishes any.
import { Globe } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useT } from '@/lib/i18n/client';
import { formatTelemetry, getTelemetry, subscribeTelemetry } from '@/lib/lily-telemetry';

const GRID = {
  backgroundImage:
    'linear-gradient(rgb(var(--c-line)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-line)) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
};

export default function HeroFrame() {
  const t = useT();
  const text = formatTelemetry(useSyncExternalStore(subscribeTelemetry, getTelemetry, () => null));

  return (
    <div
      role="img"
      aria-label={t('home.hero.frame')}
      id="hero-frame"
      className="relative min-h-[320px] border-line md:min-h-0 md:border-l"
      style={GRID}
    >
      <div className="absolute left-3 top-3 bg-card px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink">
        <p>
          <span className="text-accent">&bull;</span> {text.chip}
        </p>
        {text.percent && (
          <p>
            <span className="text-accent">&bull;</span> {text.percent}
          </p>
        )}
      </div>
      <Globe aria-hidden className="absolute right-3 top-3 h-6 w-6 text-ink" />
      <div className="absolute bottom-10 right-0 border border-ink/80 bg-highlight px-3 py-2 font-mono text-[11px] leading-relaxed text-black">
        <p>{text.x}</p>
        <p>{text.y}</p>
        <p>{text.z}</p>
      </div>
      <p className="absolute bottom-3 right-3 font-mono text-[11px] text-ink">{'//SCN_01'}</p>
    </div>
  );
}
