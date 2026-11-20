// Category tiles — one per gallery tag. Links go to the gallery (tag filtering there is UI only for now).
import Link from "next/link";
import {
  Box,
  Building2,
  Car,
  Leaf,
  PawPrint,
  Rocket,
  Shapes,
  User,
  type LucideIcon,
} from "lucide-react";
import { tagLabel } from "@/lib/i18n/tag";
import { getT } from "@/lib/i18n/server";
import { GALLERY_TAGS } from "@/lib/types";

const ICONS: Record<(typeof GALLERY_TAGS)[number], LucideIcon> = {
  character: User,
  vehicle: Car,
  architecture: Building2,
  nature: Leaf,
  "sci-fi": Rocket,
  props: Box,
  abstract: Shapes,
  animal: PawPrint,
};

export default async function Categories() {
  const { t } = await getT();
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {GALLERY_TAGS.map((tag) => {
        const Icon = ICONS[tag];
        return (
          <li key={tag}>
            <Link
              href={`/gallery?tag=${tag}`}
              className="group flex items-center gap-3 border border-line bg-card p-4 transition-colors hover:border-ink/40"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-accent/30 text-accent transition-colors group-hover:border-accent/70">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink">
                {tagLabel(t, tag)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
