'use client';

// Shared client store for liked model IDs and live like counts across /gallery, /, /creators/[handle], and /models/[id].
// Fetches GET /api/me/likes ONCE per session token (zero N+1 requests on gallery grids) and shares one Socket.IO listener.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CORE_API_URL } from './api';
import { readSession, SESSION_UPDATED_EVENT } from './session';
import { getSocket } from './socket';
import type { Socket } from 'socket.io-client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Listener = () => void;

let loadedToken: string | null = null;
let inFlightToken: string | null = null;
let likedIds = new Set<string>();
const countOverrides = new Map<string, number>();
const listeners = new Set<Listener>();
let globalsBound = false;
let boundSocket: Socket | null = null;

function onLikeUpdated(data: { modelId?: string; likeCount?: number }) {
  if (data && typeof data.modelId === 'string' && typeof data.likeCount === 'number') {
    countOverrides.set(data.modelId, data.likeCount);
    emitChange();
  }
}

function bindSocket() {
  try {
    const socket = getSocket();
    if (!socket || socket === boundSocket) return;
    if (boundSocket) {
      boundSocket.off('model:like_updated', onLikeUpdated);
    }
    socket.on('model:like_updated', onLikeUpdated);
    boundSocket = socket;
  } catch {
    // Socket.IO is optional; HTTP toggle still works without it.
  }
}

function emitChange() {
  listeners.forEach((fn) => fn());
}

async function syncLikedIds(force = false) {
  if (typeof window === 'undefined') return;
  const session = readSession();
  const token = session?.token ?? null;

  if (!token) {
    if (loadedToken !== null || likedIds.size > 0) {
      loadedToken = null;
      inFlightToken = null;
      likedIds = new Set();
      emitChange();
    }
    return;
  }

  if (!force && (loadedToken === token || inFlightToken === token)) return;
  inFlightToken = token;

  try {
    const res = await fetch(`${CORE_API_URL}/api/me/likes`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (inFlightToken === token) inFlightToken = null;
      return;
    }
    const data = (await res.json()) as { modelIds?: string[] };
    if (readSession()?.token !== token) return;
    likedIds = new Set(Array.isArray(data.modelIds) ? data.modelIds : []);
    loadedToken = token;
    inFlightToken = null;
    emitChange();
  } catch {
    if (inFlightToken === token) inFlightToken = null;
  }
}

function bindGlobalsOnce() {
  if (typeof window === 'undefined') return;
  bindSocket();
  if (globalsBound) return;
  globalsBound = true;

  const onSessionChange = () => {
    bindSocket();
    void syncLikedIds();
  };
  window.addEventListener('storage', onSessionChange);
  window.addEventListener(SESSION_UPDATED_EVENT, onSessionChange);
}

export function useModelLike(modelId: string, initialCount: number) {
  const router = useRouter();
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const isRealModel = UUID_RE.test(modelId);

  useEffect(() => {
    bindGlobalsOnce();
    const onChange = () => setTick((n) => n + 1);
    listeners.add(onChange);
    void syncLikedIds();
    return () => {
      listeners.delete(onChange);
    };
  }, [modelId]);

  const liked = isRealModel ? likedIds.has(modelId) : false;
  const count = countOverrides.has(modelId) ? countOverrides.get(modelId)! : initialCount;

  const toggleLike = useCallback(async () => {
    if (!isRealModel || busyRef.current) return;

    const session = readSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const prevLiked = likedIds.has(modelId);
    const prevCount = countOverrides.has(modelId) ? countOverrides.get(modelId)! : initialCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    // Optimistic update shared across all visible cards / detail buttons for this model
    const nextSet = new Set(likedIds);
    if (nextLiked) nextSet.add(modelId);
    else nextSet.delete(modelId);
    likedIds = nextSet;
    countOverrides.set(modelId, nextCount);
    emitChange();

    try {
      busyRef.current = true;
      setBusy(true);
      const res = await fetch(`${CORE_API_URL}/api/models/${encodeURIComponent(modelId)}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!res.ok) throw new Error(`Like toggle failed (${res.status})`);
      const data = (await res.json()) as { liked?: boolean; likeCount?: number };
      const syncedSet = new Set(likedIds);
      if (data.liked) syncedSet.add(modelId);
      else syncedSet.delete(modelId);
      likedIds = syncedSet;
      if (typeof data.likeCount === 'number') {
        countOverrides.set(modelId, data.likeCount);
      }
      emitChange();
    } catch {
      const rolledSet = new Set(likedIds);
      if (prevLiked) rolledSet.add(modelId);
      else rolledSet.delete(modelId);
      likedIds = rolledSet;
      countOverrides.set(modelId, prevCount);
      emitChange();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [isRealModel, modelId, initialCount, router]);

  return { liked, count, busy, isRealModel, toggleLike };
}
