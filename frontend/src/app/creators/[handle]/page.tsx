// Creator profile — VGen-inspired layout with cover banner, left sidebar, underline tabs
// (Models + owner-only Seller Dashboard & Wallet), and Donate section at the bottom.
import type { Metadata } from 'next';
import CreatorProfileClient from '@/components/profile/CreatorProfileClient';
import { fetchCreator } from '@/lib/api';

type Props = { params: Promise<{ handle: string }> };

function decodeHandle(raw: string): string {
  try {
    return decodeURIComponent(raw).normalize('NFC');
  } catch {
    return raw.normalize('NFC');
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeHandle((await params).handle);
  const creator = await fetchCreator(handle);
  return { title: creator ? `${creator.name} — Lixyte` : `@${handle} — Lixyte` };
}

export default async function CreatorProfilePage({ params }: Props) {
  const handle = decodeHandle((await params).handle);
  const creator = await fetchCreator(handle);

  return <CreatorProfileClient handle={handle} initialCreator={creator} />;
}
