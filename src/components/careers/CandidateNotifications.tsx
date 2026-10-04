'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  stage: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Panel notifikasi progress lamaran kandidat (WS-13). */
export default function CandidateNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/careers/notifications');
      if (res.status === 401 || res.status === 403) { setItems([]); return; }
      const j = await res.json().catch(() => ({}));
      setItems(j?.data?.notifications ?? []);
    } catch { /* abaikan */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unread = items.filter((n) => !n.isRead).length;

  const markRead = async () => {
    setOpen((o) => !o);
    if (unread > 0) {
      await fetch('/api/v1/careers/notifications', { method: 'POST' }).catch(() => {});
      setItems((arr) => arr.map((n) => ({ ...n, isRead: true })));
    }
  };

  return (
    <div className="relative">
      <button onClick={markRead}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white">
        <Bell className="h-3.5 w-3.5" /> Notifikasi
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white shadow-2xl z-50">
          <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-xs font-bold text-[#0f172a]">Notifikasi Progress</div>
          {loading ? (
            <p className="px-4 py-3 text-[11px] text-[#64748b]">Memuat…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-[#64748b]">Belum ada notifikasi.</p>
          ) : items.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b border-[#f8fafc] last:border-0 ${n.isRead ? '' : 'bg-[#f0fdf9]'}`}>
              <p className="text-[11px] font-bold text-[#0f172a]">{n.title}</p>
              <p className="text-[10px] text-[#475569] mt-0.5">{n.body}</p>
              <p className="text-[9px] text-[#94a3b8] mt-1">{new Date(n.createdAt).toLocaleString('id-ID')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
