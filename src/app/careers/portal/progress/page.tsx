'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CandidateTopBar from '@/components/careers/CandidateTopBar';

interface TimelineEntry {
  stage: string;
  label: string;
  status: string;
  state: 'DONE' | 'CURRENT' | 'UPCOMING' | 'FAILED' | 'SKIPPED';
  note?: string | null;
  at?: string | null;
  meetingUrl?: string | null;
  scheduledAt?: string | null;
  interviewerName?: string | null;
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
  CURRENT: { dot: 'bg-[#007a5a] border-[#007a5a] animate-pulse', ring: 'bg-[#e6f4ea] text-[#137333] border-[#b7e1cd]', text: 'text-[#137333]' },
  UPCOMING: { dot: 'bg-white border-slate-300', ring: 'bg-slate-50 text-slate-500 border-slate-200', text: 'text-slate-500' },
  FAILED: { dot: 'bg-rose-500 border-rose-500', ring: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700' },
  SKIPPED: { dot: 'bg-amber-400 border-amber-400', ring: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700' },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu', IN_PROGRESS: 'Sedang Berjalan', PASSED: 'Selesai',
  FAILED: 'Tidak Lolos', SCHEDULED: 'Dijadwalkan', SKIPPED: 'Dilewati',
};

export default function CareersProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tl, setTl] = useState<TimelineView | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/careers/timeline/me');
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.status === 401) { router.replace('/careers/login'); return; }
        if (!res.ok) { setError(j?.detail || 'Belum ada lamaran pada akun Anda.'); return; }
        setTl(j.data as TimelineView);
      } catch {
        if (alive) setError('Terjadi kesalahan saat memuat progres.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  const overallText = tl
    ? tl.overallState === 'ACCEPTED' ? 'Selamat! Anda diterima.'
    : tl.overallState === 'REJECTED' ? 'Lamaran Anda belum berhasil saat ini.'
    : 'Lamaran Anda sedang diproses.'
    : '';
  const overallColor = tl
    ? tl.overallState === 'ACCEPTED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : tl.overallState === 'REJECTED' ? 'text-rose-700 bg-rose-50 border-rose-200'
    : 'text-[#137333] bg-[#e6f4ea] border-[#b7e1cd]'
    : '';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans">
      <CandidateTopBar />
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <h1 className="text-lg font-extrabold">Progress Tahapan</h1>
        <p className="text-xs text-slate-300">Alur lengkap tahapan seleksi lamaran Anda.</p>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {loading ? (
          <p className="text-xs text-[#64748b]">Memuat…</p>
        ) : error ? (
          <section className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
            <p className="text-xs text-[#64748b]">{error}</p>
          </section>
        ) : tl && (
          <section className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-5">
            <div>
              <p className="text-sm font-extrabold">{tl.postingTitle}</p>
              <p className="text-[11px] text-[#64748b]">
                {tl.candidateName} · <span className="font-mono">{tl.applicationNo}</span>
              </p>
            </div>

            <div className={`p-3 rounded-xl border text-xs font-semibold ${overallColor}`}>{overallText}</div>

            <ol className="relative pl-2">
              {tl.entries.map((e, i) => {
                const s = STATE_STYLE[e.state];
                const isLast = i === tl.entries.length - 1;
                return (
                  <li key={e.stage} className="relative pl-8 pb-5 last:pb-0">
                    {!isLast && (
                      <span className={`absolute left-[11px] top-5 h-full w-0.5 ${e.state === 'DONE' ? 'bg-emerald-300' : 'bg-slate-200'}`} aria-hidden="true" />
                    )}
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

                    {e.stage === 'INTERVIEW' && e.state !== 'UPCOMING' && (
                      <div className="mt-2 rounded-lg border border-[#d4ecdd] bg-[#e6f4ea]/70 px-3 py-2">
                        {e.scheduledAt ? (
                          <p className="text-[11px] text-[#0d3b2e] font-semibold">
                            Jadwal: {new Date(e.scheduledAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                            {e.interviewerName ? ` · Pewawancara: ${e.interviewerName}` : ''}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#137333] font-semibold">Jadwal wawancara menyusul.</p>
                        )}
                        {e.meetingUrl ? (
                          <a
                            href={e.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#007a5a] rounded-lg px-3 py-1.5 hover:bg-[#00684a]"
                          >
                            🎥 Bergabung ke Ruang Wawancara
                          </a>
                        ) : (
                          <p className="text-[10px] text-[#4b8f76] mt-1">Tautan ruang wawancara akan dibagikan menjelang jadwal.</p>
                        )}
                      </div>
                    )}
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
