'use client';

import { Heart } from 'lucide-react';
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { useModelLike } from '@/lib/likes-store';

export default function ModelLikeButton({
  modelId,
  initialCount,
}: {
  modelId: string;
  initialCount: number;
}) {
  const t = useT();
  const { liked, count, busy, isRealModel, toggleLike } = useModelLike(modelId, initialCount);

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => void toggleLike()}
        disabled={busy || !isRealModel}
        aria-pressed={liked}
        aria-label={liked ? t('model.unlike') : t('model.like')}
        className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-hud disabled:opacity-60 ${
          liked ? 'text-white hover:text-red-400' : 'text-white/65 hover:text-white'
        }`}
      >
        <Heart
          aria-hidden
          className={`h-4 w-4 transition-transform ${
            liked ? 'scale-110 fill-red-500 text-red-500' : 'fill-none'
          }`}
        />
        <dt className="sr-only">{t('model.likes')}</dt>
        <dd>{formatCount(count)}</dd>
      </button>
    </div>
  );
}
