'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, Inbox } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { formatDateTimeWib } from '@/lib/utils/wibDate';

interface NotifItem {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  category: string | null;
  severity: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

const SEVERITY_DOT: Record<string, string> = {
  SUCCESS: 'bg-emerald-500',
  INFO: 'bg-sky-500',
  WARNING: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
};

/**
 * Bel notifikasi lintas-role. Polling ringan (DB-persisted) tiap 15 dtk —
 * andal di serverless tanpa broker pub/sub. Panel di-render lewat portal
 * supaya backdrop penuh & tak terpotong ancestor ber-transform.
 */
export default function NotificationBell() {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications?limit=30', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const payload = json?.data ?? json;
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setUnread(Number(payload?.unreadCount ?? 0));
    } catch { /* diamkan */ }
  }, []);

  // Poll tiap 15 dtk; muat ulang saat tab kembali aktif.
  useEffect(() => {
    if (!currentUser) return;
    load();
    const id = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [currentUser, load]);

  // Tutup saat klik di luar / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open]);

  const markAll = async () => {
    try {
      await fetch('/api/v1/notifications/read', { method: 'POST' });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* diamkan */ }
  };

  const openItem = async (n: NotifItem) => {
    if (!n.isRead) {
      try { await fetch(`/api/v1/notifications/read?id=${n.id}`, { method: 'POST' }); } catch { /* diamkan */ }
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    if (n.actionUrl) { setOpen(false); window.location.href = n.actionUrl; }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        title="Notifikasi"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-[#0d131f]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && mounted && createPortal(
        <>
          <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 z-[100] w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col rounded-xl bg-[#111827] border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <p className="text-xs font-bold text-white">Notifikasi</p>
              {unread > 0 && (
                <button onClick={markAll} className="text-[10px] font-semibold text-[#0ea5a4] hover:underline">
                  Tandai semua dibaca
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
                  <Inbox className="h-6 w-6" />
                  <p className="text-[11px]">Belum ada notifikasi</p>
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                      n.isRead ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[n.severity ?? 'INFO'] ?? 'bg-slate-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] font-bold text-white truncate">{n.title}</p>
                          {!n.isRead && <Check className="h-3 w-3 text-[#0ea5a4] shrink-0" />}
                        </div>
                        {n.body && <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-2">{n.body}</p>}
                        <p className="mt-1 text-[9px] text-slate-500 uppercase tracking-wide">
                          {n.category ?? 'UMUM'} · {formatDateTimeWib(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
