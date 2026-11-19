// Landing — hero (bold type on the left, the framed 3D lily on the right), then popular models, categories, new
// arrivals and a closing call to action. A scroll-down arrow and dots on the right edge jump between the sections.
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Scan } from "lucide-react";
import Categories from "@/components/landing/Categories";
import HeroFrame from "@/components/landing/HeroFrame";
import PopularCarousel from "@/components/landing/PopularCarousel";
import SectionDots, { ScrollCue } from "@/components/landing/SectionDots";
import SectionHeading from "@/components/landing/SectionHeading";
import ModelCard from "@/components/gallery/ModelCard";
import PixieCursor from "@/components/PixieCursor";
import LilyViewer from "@/components/viewer/LilyViewer";
import { fetchModels } from "@/lib/api";
import { getT } from "@/lib/i18n/server";

const HUD_CLIP =
  "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))";

export default async function HomePage() {
  const { t } = await getT();
  // Popular = top of the popularity-sorted list. The API has no "recent" sort yet, so new arrivals take the
  // next models in that list as a stand-in.
  const { items } = await fetchModels({ page: 1 });
  const popular = items.slice(0, 8);
  const arrivals = items.slice(8, 14);
  const sectionIds = [
    "hero",
    ...(popular.length > 0 ? ["popular"] : []),
    "categories",
    ...(arrivals.length > 0 ? ["arrivals"] : []),
    "join",
  ];

  return (
    <main>
      <LilyViewer />
      <PixieCursor />
      <SectionDots ids={sectionIds} />

      <section id="hero" className="relative z-10 min-h-dvh">
        <div className="mx-auto grid min-h-dvh max-w-[1400px] grid-cols-1 pt-16 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-center py-10 pb-24 pl-12 pr-6 md:pl-16 md:pr-10">
            <div className="absolute inset-y-0 left-0 flex w-8 items-center justify-center border-r border-line">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent [writing-mode:vertical-rl] rotate-180">
                {t("home.hero.side")}
              </span>
            </div>

            <p className="font-mono text-[11px] text-accent">/01</p>
            <h1 className="mt-3 font-display text-[length:var(--hero-title-size)] uppercase leading-[0.92] text-ink">
              <span className="block">{t("home.hero.line1")}</span>
              <span className="block">{t("home.hero.line2")}</span>
              <span className="block">{t("home.hero.line3")}</span>
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

      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-20 px-4 pb-20 pt-8 md:px-6">
        {popular.length > 0 && (
          <section id="popular" className="scroll-mt-20" aria-label={t('home.popularAria')}>
            <SectionHeading label={t('home.trending')} title={t('home.popular')} href="/gallery" />
            <PopularCarousel models={popular} />
          </section>
        )}

        <section id="categories" className="scroll-mt-20" aria-label={t('home.categories')}>
          <SectionHeading label={t('home.browse')} title={t('home.categories')} />
          <Categories />
        </section>

        {arrivals.length > 0 && (
          <section id="arrivals" className="scroll-mt-20" aria-label={t('home.arrivals')}>
            <SectionHeading label={t('home.fresh')} title={t('home.arrivals')} href="/gallery" />
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {arrivals.map((m) => (
                <li key={m.id}>
                  <ModelCard model={m} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          id="join"
          aria-label={t('home.joinAria')}
          className="scroll-mt-20 border border-accent/40 bg-card/70 p-6 backdrop-blur-sm md:p-10"
          style={{ clipPath: HUD_CLIP }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent/70">
                {t('home.joinLabel')}
              </p>
              <h2 className="mt-3 font-display text-[clamp(20px,2.6vw,30px)] uppercase leading-snug text-ink">
                {t('home.joinTitle')}
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
                {t('home.joinBody')}
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-ink px-3.5 py-1.5 text-[15px] font-medium text-canvas transition-opacity hover:opacity-85 md:self-auto"
            >
              {t('home.getStarted')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
