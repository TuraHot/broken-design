// Landing — hero (bold type on the left, the framed 3D lily on the right), then how it works, categories, popular
// models and a closing call to action. A scroll-down arrow and dots on the right edge jump between the sections.
import Link from "next/link";
import { ArrowUpRight, Scan } from "lucide-react";
import Band from "@/components/landing/Band";
import Categories from "@/components/landing/Categories";
import HeroFrame from "@/components/landing/HeroFrame";
import HowItWorks from "@/components/landing/HowItWorks";
import NumberedHeading from "@/components/landing/NumberedHeading";
import PageSnap from "@/components/landing/PageSnap";
import PopularGrid from "@/components/landing/PopularGrid";
import SectionDots, { ScrollCue } from "@/components/landing/SectionDots";
import PixieCursor from "@/components/PixieCursor";
import { fetchModels } from "@/lib/api";
import { getT } from "@/lib/i18n/server";

export default async function HomePage() {
  const { t } = await getT();
  // Popular = top of the popularity-sorted list (top 15, one row that drifts sideways)
  const { items } = await fetchModels({ page: 1 });
  const popular = items.slice(0, 15);
  const sectionIds = ["hero", "how", "join"];

  return (
    <main>
      <PixieCursor />
      <SectionDots ids={sectionIds} />
      <PageSnap ids={sectionIds} />

      <section id="hero" className="relative z-10 min-h-dvh">
        <div className="mx-auto grid min-h-dvh w-full max-w-[2400px] grid-cols-1 pt-16 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-center py-10 pb-24 pl-12 pr-6 md:pl-16 md:pr-10 min-[1500px]:pl-[calc((100vw-1400px)/2+2rem)]">
            <div className="absolute inset-y-0 left-0 flex w-8 items-center justify-center border-r border-line">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent [writing-mode:vertical-rl] rotate-180">
                {t("home.hero.side")}
              </span>
            </div>

            <p className="font-mono text-[11px] text-accent">/01</p>
            <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-[length:var(--hero-title-size)] uppercase leading-[0.92] text-ink">
              <span className="block">{t("home.hero.line1")}</span>
              <span className="block">{t("home.hero.line2")}</span>
              <span className="hero-accent block">{t("home.hero.line3")}</span>
            </h1>
            <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.06em] text-accent">
              {t("home.hero.tagline")}
            </p>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-soft">
              {t("home.lead")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/gallery"
                className="inline-flex items-center gap-4 bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-canvas transition-opacity hover:opacity-85"
              >
                {t("home.explore")}
                <ArrowUpRight aria-hidden className="h-4 w-4 text-accent" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:text-accent"
              >
                {t("home.viewDocs")}
                <Scan aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <HeroFrame />
        </div>
        <ScrollCue target={sectionIds[1]} />
      </section>

      {/* Below the hero there are two pages with no gaps: 02 (how it works, categories, popular) and 03 (join) */}
      <Band id="how" full page>
        <div className="flex flex-col gap-10 md:gap-8">
          <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
            <HowItWorks />
          </div>

          <section aria-label={t('home.categories')} className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
            <NumberedHeading index="02.2" title={t('home.categories')} />
            <Categories />
          </section>

          {popular.length > 0 && (
            <section aria-label={t('home.popularAria')}>
              <div className="mx-auto max-w-[1400px] px-4 md:px-6">
                <NumberedHeading index="02.3" title={t('home.popular')} href="/gallery" />
              </div>
              <PopularGrid models={popular} />
            </section>
          )}
        </div>
      </Band>

      <Band id="join" tint page>
        <section aria-label={t('home.joinAria')}>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[13px] text-accent">/03</p>
              <h2 className="mt-3 font-[family-name:var(--font-barlow)] text-[clamp(40px,6vw,96px)] uppercase leading-[0.95] text-ink">
                {t('home.joinTitle')}
              </h2>
              <p className="mt-4 max-w-[52ch] font-mono text-[12px] leading-relaxed text-ink">{t('home.joinBody')}</p>
            </div>
            <Link
              href="/login"
              className="inline-flex shrink-0 items-center gap-4 self-start bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-canvas transition-opacity hover:opacity-85 md:self-auto"
            >
              {t('home.getStarted')}
              <ArrowUpRight aria-hidden className="h-4 w-4 text-accent" />
            </Link>
          </div>
        </section>
      </Band>
    </main>
  );
}
