'use client';

import { useEffect, useState } from 'react';
import { Heart, Bell, X } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { readSession } from '@/lib/session';

interface RealtimeNotice {
  id: string;
  type: string;
  title: string;
  message: string;
  modelId?: string;
  createdAt?: string;
}

export default function RealtimeNotificationToast() {
  const [notices, setNotices] = useState<RealtimeNotice[]>([]);

  useEffect(() => {
    let socket: any = null;

    try {
      socket = getSocket();
      if (!socket) return;

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
        setTimeout(() => {
          setNotices((prev) => prev.filter((n) => n.id !== newNotice.id));
        }, 6000);
      };

      socket.on('notification', handleNotification);

      return () => {
        socket.off('notification', handleNotification);
      };
    } catch {
      // Ignore if socket not available
    }
  }, []);

  const dismiss = (id: string) => {
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
            aria-label="Close notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
