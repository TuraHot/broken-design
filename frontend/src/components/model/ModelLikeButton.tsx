'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { CORE_API_URL } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { readSession } from '@/lib/session';
import { getSocket } from '@/lib/socket';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ModelLikeButton({
  modelId,
  initialCount,
}: {
  modelId: string;
  initialCount: number;
}) {
  const router = useRouter();
  const t = useT();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const isRealModel = UUID_RE.test(modelId);

  useEffect(() => {
    let cancelled = false;

    const loadLikeState = async () => {
      const session = readSession();
      if (!session) {
        if (!cancelled) {
          setLiked(false);
          setCount(initialCount);
        }
        return;
      }

      if (!isRealModel) {
        const accountId = session.user.id || session.user.email;
        const saved = localStorage.getItem(`lixyte:like:${accountId}:${modelId}`) === '1';
        if (!cancelled) {
          setLiked(saved);
          setCount(initialCount + (saved ? 1 : 0));
        }
        return;
      }

      try {
        const res = await fetch(`${CORE_API_URL}/api/models/${encodeURIComponent(modelId)}/like`, {
          headers: { Authorization: `Bearer ${session.token}` },
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { liked?: boolean; likeCount?: number };
        if (!cancelled) {
          setLiked(Boolean(data.liked));
          if (typeof data.likeCount === 'number') setCount(data.likeCount);
        }
      } catch {
        // Keep initial count if status fetch fails.
      }
    };

    void loadLikeState();
    window.addEventListener('storage', loadLikeState);

    // Real-time live update for like counts via Socket.IO
    let cleanupSocket: (() => void) | undefined;
    try {
      const socket = getSocket();
      if (socket) {
        const onLikeUpdated = (data: { modelId: string; likeCount: number }) => {
          if (data && data.modelId === modelId && typeof data.likeCount === 'number') {
            setCount(data.likeCount);
          }
        };

        socket.on('model:like_updated', onLikeUpdated);
        socket.emit('join:model', modelId);

        cleanupSocket = () => {
          socket.off('model:like_updated', onLikeUpdated);
          socket.emit('leave:model', modelId);
        };
      }
    } catch {
      // Socket optional fallback
    }

    return () => {
      cancelled = true;
      window.removeEventListener('storage', loadLikeState);
      if (cleanupSocket) cleanupSocket();
    };
  }, [modelId, initialCount, isRealModel]);

  const toggleLike = async () => {
    if (busyRef.current) return;

    const session = readSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    setLiked(nextLiked);
    setCount(nextCount);

    if (!isRealModel) {
      const accountId = session.user.id || session.user.email;
      const key = `lixyte:like:${accountId}:${modelId}`;
      try {
        if (nextLiked) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
      } catch {
        // Ignore storage quota / private mode issues.
      }
      return;
    }

    try {
      busyRef.current = true;
      setBusy(true);
      const res = await fetch(`${CORE_API_URL}/api/models/${encodeURIComponent(modelId)}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!res.ok) throw new Error(`Like toggle failed (${res.status})`);
      const data = (await res.json()) as { liked?: boolean; likeCount?: number };
      setLiked(Boolean(data.liked));
      if (typeof data.likeCount === 'number') setCount(data.likeCount);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={toggleLike}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? t('model.unlike') : t('model.like')}
        className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${
          liked ? 'text-ink hover:text-danger' : 'text-ink-soft hover:text-ink'
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
