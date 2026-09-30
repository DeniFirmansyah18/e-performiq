'use client';

import React, { useEffect, useState } from 'react';
import { Inbox, AlertCircle, Check, X } from 'lucide-react';

interface ReviewItem {
  id: string;
  status: string;
  screeningScore: number;
  screeningSummary: string;
  coverLetter: string;
  createdAt: string;
  applicantName: string;
  postingTitle: string;
}

/**
 * Kotak 3 — Peninjauan lamaran internal untuk Manager Cockpit.
 * Memakai GET/PATCH /api/v1/talent-acquisition/applications.
 */
export default function InternalApplicationReview() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/talent-acquisition/applications', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.detail ?? json.message ?? 'Gagal memuat lamaran.');
      }
      setItems(json.data.items ?? []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setActingId(id);
    setErrorMsg('');
    setNotice('');
    try {
      const res = await fetch('/api/v1/talent-acquisition/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ applicationId: id, action }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        // Pesan penolakan kuota ditampilkan apa adanya dari server
        throw new Error(json.detail ?? json.message ?? 'Gagal memproses lamaran.');
      }
      setNotice(json.message ?? (action === 'APPROVE' ? 'Lamaran disetujui.' : 'Lamaran ditolak.'));
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Peninjauan Lamaran Internal
            </h3>
            <p className="text-[11px] text-slate-500">Kotak 3: Job Board & Mobilitas Internal</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
          {items.length} Menunggu
        </span>
      </div>

      {loading && <p className="text-xs text-slate-500">Memuat lamaran masuk…</p>}

      {notice && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
      {errorMsg && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && items.length === 0 && (
        <p className="text-xs text-slate-500">Tidak ada lamaran yang menunggu peninjauan.</p>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div
            key={it.id}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">{it.applicantName}</p>
                <p className="text-[11px] text-slate-500">Melamar: {it.postingTitle}</p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">
                Skor: {it.screeningScore}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 italic">"{it.coverLetter}"</p>
            <p className="text-[11px] text-slate-500">{it.screeningSummary}</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => decide(it.id, 'APPROVE')}
                disabled={actingId === it.id}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> Setujui
              </button>
              <button
                onClick={() => decide(it.id, 'REJECT')}
                disabled={actingId === it.id}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Tolak
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
