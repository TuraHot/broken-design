import { HudLoader } from '@/components/ui/HudLoader';

export default function AppLoading() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <HudLoader />
    </main>
  );
}
