// Landing — hero over the 3D lily (page background, bursts apart as you scroll), then popular models, categories, new arrivals and a closing call to action
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Categories from "@/components/landing/Categories";
import PopularCarousel from "@/components/landing/PopularCarousel";
import SectionHeading from "@/components/landing/SectionHeading";
import ModelCard from "@/components/gallery/ModelCard";
import PixieCursor from "@/components/PixieCursor";
import LilyViewer from "@/components/viewer/LilyViewer";
import { fetchModels } from "@/lib/api";

const HUD_CLIP =
  "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))";

export default async function HomePage() {
  // Popular = top of the popularity-sorted list. The API has no "recent" sort yet, so new arrivals take the
  // next models in that list as a stand-in.
  const { items } = await fetchModels({ page: 1 });
  const popular = items.slice(0, 8);
  const arrivals = items.slice(8, 14);

  return (
    <main>
      <LilyViewer />
      <PixieCursor />

      <section className="relative z-10 h-dvh min-h-[600px]">
        <div className="mx-auto max-w-[1400px] px-4 pt-24 md:px-6">
          <div className="max-w-[850px]">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">
              [ 3D asset repository &amp; CDN ]
            </p>
            <h1 className="mt-4 font-display text-[clamp(30px,4.6vw,66px)] uppercase leading-[1.02] text-white">
              Broken &nbsp;
              {/* <br /> */}
              <span className="bg-gradient-to-r from-hud via-violet to-amber bg-clip-text text-transparent">
                design
              </span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/65">
              Lorem ipsum dolor sit, amet consectetur adipisicing elit. Aperiam
              consectetur quasi voluptates repellat officiis quos dicta
              suscipit, tempore explicabo, modi esse laudantium inventore fugit
              officia fuga tenetur commodi et est.
            </p>
          </div>
        </div>

        <div
          aria-label="Get started"
          role="region"
          className="pointer-events-none absolute inset-x-0 bottom-0 pb-6"
        >
          <div className="mx-auto flex max-w-[1400px] justify-end px-4 md:px-6">
            <div
              className="pointer-events-auto w-full max-w-[340px] border border-hud/40 bg-[rgba(4,8,18,0.66)] p-5 backdrop-blur-sm"
              style={{ clipPath: HUD_CLIP }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">
                [ Get started ]
              </p>
              <h2 className="mt-3 font-display text-lg uppercase leading-snug text-white">
                Drop a model.
                <br />
                Ship it in 3D.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/65">
                Pick a .glb, copy one line of code, and it&apos;s live on your
                site.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
                >
                  Get started
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
                <Link
                  href="/gallery"
                  className="border border-white px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black"
                >
                  Explore gallery
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-20 px-4 pb-20 pt-8 md:px-6">
        {popular.length > 0 && (
          <section aria-label="Popular models">
            <SectionHeading label="Trending" title="Popular models" href="/gallery" />
            <PopularCarousel models={popular} />
          </section>
        )}

        <section aria-label="Categories">
          <SectionHeading label="Browse" title="Categories" />
          <Categories />
        </section>

        {arrivals.length > 0 && (
          <section aria-label="New arrivals">
            <SectionHeading label="Fresh" title="New arrivals" href="/gallery" />
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
          aria-label="Join Broken Design"
          className="border border-hud/40 bg-[rgba(4,8,18,0.66)] p-6 backdrop-blur-sm md:p-10"
          style={{ clipPath: HUD_CLIP }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">
                [ Join ]
              </p>
              <h2 className="mt-3 font-display text-[clamp(20px,2.6vw,30px)] uppercase leading-snug text-white">
                Publish your first model
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-white/65">
                Free account, one line of code to embed. Bring your own .glb and
                it&apos;s live on your site.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-white px-3.5 py-1.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85 md:self-auto"
            >
              Get started
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
