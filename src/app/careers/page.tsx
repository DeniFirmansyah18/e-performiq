'use client';

import React, { useEffect, useState } from 'react';
import ApplicationForm from '@/components/careers/ApplicationForm';

interface Posting {
  id: string; postingTitle: string; description: string; department: string; position: string;
  requiredSkills?: unknown; minEducation?: string | null; minExperienceYears?: number | null;
  workLocation?: string | null; employmentType?: string | null;
  quota?: number; hired?: number; remaining?: number; availability?: 'AVAILABLE' | 'FILLED' | 'CLOSED';
}
interface AtsResult { score: number; matched: string[]; missing: string[] }

function skillsList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => (typeof s === 'string' ? s : (s as any)?.name ?? '')).filter(Boolean);
  if (typeof v === 'string') { try { return skillsList(JSON.parse(v)); } catch { return []; } }
  return [];
}

/** Portal Karier publik (tanpa login). Memakai /api/v1/careers/*. */
export default function CareersPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [selectedPosting, setSelectedPosting] = useState<string>('');

  const [submitted, setSubmitted] = useState<string | null>(null);
  const [ats, setAts] = useState<AtsResult | null>(null);
  const [statusQuery, setStatusQuery] = useState('');
  const [statusResult, setStatusResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/careers/postings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) { setPostings(j.data.postings ?? []); setSelectedPosting(j.data.postings?.[0]?.id ?? ''); } })
      .catch(() => {});
  }, []);

  // Deep-link: /careers?posting=<id> → pilih & gulir ke form lamaran.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('posting');
    if (id) {
      setSelectedPosting(id);
      setTimeout(() => document.getElementById('form-lamaran')?.scrollIntoView({ behavior: 'smooth' }), 300);
    }
  }, []);

  const checkStatus = async () => {
    setStatusResult(null);
    const res = await fetch(`/api/v1/careers/status/${statusQuery}`);
    const j = await res.json().catch(() => ({}));
    setStatusResult(res.ok ? `Status: ${j.data.status} (${j.data.postingTitle})` : 'Nomor lamaran tidak ditemukan.');
  };

  const reset = () => { setSubmitted(null); setAts(null); };

  const scoreColor = (s: number) => (s >= 75 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-rose-600');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans">
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <h1 className="text-lg font-extrabold">Karier di E-PerformIQ</h1>
        <p className="text-xs text-slate-300">Bergabunglah membangun ekosistem kinerja SDM kelas dunia.</p>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <section>
          <h2 className="text-sm font-extrabold mb-2">Lowongan Terbuka</h2>
          {postings.length === 0 ? (
            <p className="text-xs text-[#64748b]">Belum ada lowongan publik saat ini.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {postings.map((p) => {
                const avail = p.availability ?? 'AVAILABLE';
                const skillArr = skillsList(p.requiredSkills);
                const quota = p.quota ?? 0;
                const remaining = p.remaining ?? quota;
                return (
                  <div key={p.id} className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">{p.postingTitle}</p>
                        <p className="text-[11px] text-[#64748b]">{p.department} · {p.position}</p>
                      </div>
                      {avail === 'AVAILABLE' ? (
                        <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Tersedia</span>
                      ) : avail === 'FILLED' ? (
                        <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Kuota Terisi</span>
                      ) : (
                        <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Ditutup</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#334155] line-clamp-3">{p.description}</p>

                    {skillArr.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skillArr.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#64748b]">
                      {p.minEducation && <span>Pendidikan: <strong className="text-[#334155]">{p.minEducation}</strong></span>}
                      {p.minExperienceYears != null && <span>Pengalaman: <strong className="text-[#334155]">{p.minExperienceYears} thn</strong></span>}
                      {p.workLocation && <span>Lokasi: <strong className="text-[#334155]">{p.workLocation}</strong></span>}
                      {p.employmentType && <span>{p.employmentType}</span>}
                    </div>

                    {quota > 0 && (
                      <p className="text-[10px] text-[#64748b]">
                        Kuota: <strong className="text-[#0f172a]">{p.hired ?? 0}/{quota}</strong> terisi · Sisa <strong className="text-[#007a5a]">{remaining}</strong>
                      </p>
                    )}

                    <div className="pt-1 mt-auto">
                      <button
                        disabled={avail !== 'AVAILABLE'}
                        onClick={() => { setSelectedPosting(p.id); document.getElementById('form-lamaran')?.scrollIntoView({ behavior: 'smooth' }); }}
                        className="w-full px-3 py-2 text-[11px] font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-40 disabled:cursor-not-allowed">
                        {avail === 'AVAILABLE' ? 'Lamar Posisi Ini' : 'Tidak Tersedia'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="form-lamaran" className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <h2 className="text-sm font-extrabold mb-3">Ajukan Lamaran</h2>
          {submitted ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#137333]">Lamaran terkirim! Simpan nomor lamaran Anda:</p>
                <p className="text-sm font-black font-mono text-[#0f172a]">{submitted}</p>
              </div>

              {ats && (
                <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Skor Kesesuaian CV (ATS)</span>
                    <span className={`text-lg font-black ${scoreColor(ats.score)}`}>
                      {ats.score.toFixed(0)}<span className="text-[10px] text-slate-400">/100</span>
                    </span>
                  </div>
                  {ats.matched.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-700 mb-1">Kualifikasi terpenuhi</p>
                      <div className="flex flex-wrap gap-1">
                        {ats.matched.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ats.missing.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-700 mb-1">Kualifikasi yang belum terlihat</p>
                      <div className="flex flex-wrap gap-1">
                        {ats.missing.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={reset} className="text-[11px] font-bold text-[#007a5a] underline">Kirim lamaran lain</button>
            </div>
          ) : (
            <ApplicationForm
              postings={postings.map((p) => ({ id: p.id, postingTitle: p.postingTitle }))}
              selectedPosting={selectedPosting}
              onSelectPosting={setSelectedPosting}
              onSubmitted={(no, atsRes) => { setSubmitted(no); setAts(atsRes); }}
            />
          )}
        </section>

        <section className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <h2 className="text-sm font-extrabold mb-3">Cek Status Lamaran</h2>
          <div className="flex gap-2">
            <input value={statusQuery} onChange={(e) => setStatusQuery(e.target.value)} placeholder="APP-YYYYMMDD-XXXXX"
              className="flex-1 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs font-mono" />
            <button onClick={checkStatus} className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f172a] rounded-lg">Cek</button>
          </div>
          {statusResult && <p className="text-[11px] font-semibold text-[#334155] mt-2">{statusResult}</p>}
          <a href={`/careers/status${statusQuery ? `?no=${encodeURIComponent(statusQuery)}` : ''}`}
            className="inline-block mt-2 text-[11px] font-bold text-[#007a5a] underline">
            Lihat progres tahapan lengkap →
          </a>
        </section>
      </main>
    </div>
  );
}
