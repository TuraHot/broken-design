'use client';

// WebGL cannot render on the server, so the scene is loaded client-side only. It fills its positioned parent
// (the hero frame).
import dynamic from 'next/dynamic';

const LilyScene = dynamic(() => import('./LilyScene'), { ssr: false });

export default function LilyViewer() {
  return <LilyScene />;
}
