'use client';

import React, { useEffect, useState } from 'react';

interface TimelineEntry {
  stage: string;
  label: string;
  status: string;
  state: 'DONE' | 'CURRENT' | 'UPCOMING' | 'FAILED' | 'SKIPPED';
  note?: string | null;
  at?: string | null;
}
interface TimelineView {
  applicationNo: string;
  applicationStatus: string;
  postingTitle: string;
  candidateName: string;
  overallState: 'IN_PROGRESS' | 'ACCEPTED' | 'REJECTED' | 'TALENT_POOL';
  currentStage: string;
  entries: TimelineEntry[];
}

const STATE_STYLE: Record<TimelineEntry['state'], { dot: string; ring: string; text: string }> = {
  DONE: { dot: 'bg-emerald-500 border-emerald-500', ring: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700' },
  CURRENT: { dot: 'bg-indigo-500 border-indigo-500 animate-pulse', ring: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: 'text-indigo-700' },
  UPCOMING: { dot: 'bg-white border-slate-300', ring: 'bg-slate-50 text-slate-500 border-slate-200', text: 'text-slate-500' },
  FAILED: { dot: 'bg-rose-500 border-rose-500', ring: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700' },
  SKIPPED: { dot: 'bg-amber-400 border-amber-400', ring: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700' },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', IN_PROGRESS: 'Sedang Berjalan', PASSED: 'Selesai',
  FAILED: 'Tidak Lolos', SCHEDULED: 'Dijadwalkan', SKIPPED: 'Dilewati',
};

export default function CareersStatusPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tl, setTl] = useState<TimelineView | null>(null);

  // Dukung deep-link ?no=APP-... dari halaman /careers.
  useEffect(() => {
    const no = new URLSearchParams(window.location.search).get('no');
    if (no) {
      setQuery(no);
      fetch(`/api/v1/careers/timeline/${encodeURIComponent(no)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j?.data) setTl(j.data as TimelineView); })
        .catch(() => {});
    }
  }, []);

  const check = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setTl(null);
    try {
      const res = await fetch(`/api/v1/careers/timeline/${encodeURIComponent(query.trim())}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.detail || 'Nomor lamaran tidak ditemukan.'); return; }
      setTl(j.data as TimelineView);
    } catch {
      setError('Terjadi kesalahan saat memuat status.');
    } finally {
      setLoading(false);
    }
  };

  const overallText = tl
    ? tl.overallState === 'ACCEPTED' ? 'Selamat! Anda diterima.'
    : tl.overallState === 'REJECTED' ? 'Lamaran Anda belum berhasil saat ini.'
    : 'Lamaran Anda sedang diproses.'
    : '';
  const overallColor = tl
    ? tl.overallState === 'ACCEPTED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : tl.overallState === 'REJECTED' ? 'text-rose-700 bg-rose-50 border-rose-200'
    : 'text-indigo-700 bg-indigo-50 border-indigo-200'
    : '';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans">
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <h1 className="text-lg font-extrabold">Status Lamaran</h1>
        <p className="text-xs text-slate-300">Lacak progres tahapan seleksi lamaran Anda.</p>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <section className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <label className="block text-xs font-semibold text-[#334155] mb-1">Nomor Lamaran</label>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
              placeholder="APP-YYYYMMDD-XXXXX"
              className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs font-mono" />
            <button onClick={check} disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-50">
              {loading ? 'Memuat…' : 'Lacak'}
            </button>
          </div>
          {error && <p className="text-[11px] font-semibold text-rose-600 mt-2">{error}</p>}
        </section>

        {tl && (
          <section className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold">{tl.postingTitle}</p>
                <p className="text-[11px] text-[#64748b]">
                  {tl.candidateName} · <span className="font-mono">{tl.applicationNo}</span>
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-xl border text-xs font-semibold ${overallColor}`}>{overallText}</div>

            {/* Stepper vertikal */}
            <ol className="relative pl-2">
              {tl.entries.map((e, i) => {
                const s = STATE_STYLE[e.state];
                const isLast = i === tl.entries.length - 1;
                return (
                  <li key={e.stage} className="relative pl-8 pb-5 last:pb-0">
                    {/* Garis penghubung */}
                    {!isLast && (
                      <span className={`absolute left-[11px] top-5 h-full w-0.5 ${e.state === 'DONE' ? 'bg-emerald-300' : 'bg-slate-200'}`} aria-hidden="true" />
                    )}
                    {/* Titik */}
                    <span className={`absolute left-0 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center ${s.dot}`} aria-hidden="true">
                      {e.state === 'DONE' && <span className="text-white text-[10px] font-black">✓</span>}
                      {e.state === 'FAILED' && <span className="text-white text-[10px] font-black">✕</span>}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${s.text}`}>{e.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.ring}`}>{STATUS_LABEL[e.status] ?? e.status}</span>
                    </div>
                    {e.note && <p className="text-[11px] text-[#475569] mt-1">{e.note}</p>}
                    {e.at && <p className="text-[10px] text-[#94a3b8] mt-0.5">{new Date(e.at).toLocaleString('id-ID')}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
