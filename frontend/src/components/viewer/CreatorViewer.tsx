'use client';

// WebGL cannot render on the server, so the scene is loaded client-side only.
// `CreatorScene` (the faceted solid) is kept for reference; the page currently shows the butterfly.
import dynamic from 'next/dynamic';
import type { ButterflyAnchors } from './ButterflyScene';

const ButterflyScene = dynamic(() => import('./ButterflyScene'), { ssr: false });

export default function CreatorViewer({ onProject }: { onProject?: (anchors: ButterflyAnchors) => void }) {
  return <ButterflyScene onProject={onProject} />;
}
