// Landing — intro text over the rotating 3D lily (the lily is the page background)
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LilyViewer from "@/components/viewer/LilyViewer";

export default function HomePage() {
  return (
    <main>
      <LilyViewer />
      <section className="relative z-10 mx-auto max-w-[1400px] px-4 pt-24 md:px-6">
        <div className="max-w-[560px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">
            [ 3D asset repository &amp; CDN ]
          </p>
          <h1 className="mt-4 font-display text-[clamp(30px,4.6vw,66px)] uppercase leading-[1.02] text-white">
            Broken
            <br />
            by{" "}
            <span className="bg-gradient-to-r from-hud via-violet to-amber bg-clip-text text-transparent">
              design
            </span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/65">
            Lorem ipsum dolor sit, amet consectetur adipisicing elit. Aperiam
            consectetur quasi voluptates repellat officiis quos dicta suscipit,
            tempore explicabo, modi esse laudantium inventore fugit officia fuga
            tenetur commodi et est.
          </p>
        </div>
      </section>

      <section
        aria-label="Get started"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 pb-6"
      >
        <div className="mx-auto flex max-w-[1400px] justify-end px-4 md:px-6">
          <div
            className="pointer-events-auto w-full max-w-[340px] border border-hud/40 bg-[rgba(4,8,18,0.66)] p-5 backdrop-blur-sm"
            style={{
              clipPath:
                "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))",
            }}
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
                href="/login?mode=signup"
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
      </section>
    </main>
  );
}
