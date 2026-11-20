'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart, Bell, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { useT } from '@/lib/i18n/client';
import { getSocket } from '@/lib/socket';
import { SESSION_UPDATED_EVENT } from '@/lib/session';

interface RealtimeNotice {
  id: string;
  type: string;
  title: string;
  message: string;
  modelId?: string;
  createdAt?: string;
}

export default function RealtimeNotificationToast() {
  const t = useT();
  const [notices, setNotices] = useState<RealtimeNotice[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let boundSocket: Socket | null = null;
    const timers = timersRef.current;

    const handleNotification = (data: any) => {
      if (!data || !data.title) return;
      const newNotice: RealtimeNotice = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: data.type || 'info',
        title: data.title,
        message: data.message || '',
        modelId: data.modelId,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      setNotices((prev) => [newNotice, ...prev.slice(0, 4)]);

      // Auto remove after 6 seconds
      const timer = setTimeout(() => {
        timers.delete(newNotice.id);
        setNotices((prev) => prev.filter((n) => n.id !== newNotice.id));
      }, 6000);
      timers.set(newNotice.id, timer);
    };

    const bind = () => {
      try {
        const socket = getSocket();
        if (!socket || socket === boundSocket) return;
        if (boundSocket) boundSocket.off('notification', handleNotification);
        socket.on('notification', handleNotification);
        boundSocket = socket;
      } catch {
        // Ignore if socket not available
      }
    };

    bind();
    window.addEventListener('storage', bind);
    window.addEventListener(SESSION_UPDATED_EVENT, bind);

    return () => {
      window.removeEventListener('storage', bind);
      window.removeEventListener(SESSION_UPDATED_EVENT, bind);
      if (boundSocket) boundSocket.off('notification', handleNotification);
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const dismiss = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  if (notices.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex max-w-sm flex-col gap-2.5 pointer-events-auto"
    >
      {notices.map((n) => (
        <div
          key={n.id}
          className="relative flex items-start gap-3 rounded-xl border border-white/20 bg-black/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300"
          style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px rgba(143, 211, 255, 0.15)' }}
        >
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            {n.type === 'like' ? (
              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            ) : (
              <Bell className="h-4 w-4 text-hud" />
            )}
          </div>
          <div className="flex-1 pr-4">
            <h4 className="font-sans text-[13px] font-semibold text-white tracking-wide">
              {n.title}
            </h4>
            <p className="mt-0.5 font-sans text-xs text-white/70 leading-relaxed">
              {n.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            className="rounded p-1 text-white/40 hover:text-white transition-colors"
            aria-label={t('modal.close')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
