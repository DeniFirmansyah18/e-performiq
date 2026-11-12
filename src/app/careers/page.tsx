'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  Briefcase,
  MapPin,
  GraduationCap,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import ApplicationForm from '@/components/careers/ApplicationForm';
import CandidateTopBar from '@/components/careers/CandidateTopBar';

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
  const router = useRouter();
  const [postings, setPostings] = useState<Posting[]>([]);
  const [selectedPosting, setSelectedPosting] = useState<string>('');

  const [submitted, setSubmitted] = useState<string | null>(null);
  const [ats, setAts] = useState<AtsResult | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [statusQuery, setStatusQuery] = useState('');
  const [statusResult, setStatusResult] = useState<string | null>(null);

  // Filter & Pencarian Lowongan
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');

  const departmentList = useMemo(() => {
    const s = new Set<string>();
    postings.forEach((p) => {
      if (p.department) s.add(p.department);
    });
    return Array.from(s).sort();
  }, [postings]);

  const filteredPostings = useMemo(() => {
    return postings.filter((p) => {
      if (selectedDeptFilter !== 'ALL' && p.department !== selectedDeptFilter) return false;
      if (selectedTypeFilter !== 'ALL' && p.employmentType !== selectedTypeFilter) return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const skills = skillsList(p.requiredSkills).join(' ').toLowerCase();
        const matchTitle = p.postingTitle?.toLowerCase().includes(q);
        const matchDept = p.department?.toLowerCase().includes(q);
        const matchPos = p.position?.toLowerCase().includes(q);
        const matchLoc = p.workLocation?.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        const matchSkill = skills.includes(q);
        if (!matchTitle && !matchDept && !matchPos && !matchLoc && !matchDesc && !matchSkill) {
          return false;
        }
      }
      return true;
    });
  }, [postings, searchKeyword, selectedDeptFilter, selectedTypeFilter]);

  const hasActiveJobFilters = searchKeyword.trim() !== '' || selectedDeptFilter !== 'ALL' || selectedTypeFilter !== 'ALL';

  const resetJobFilters = () => {
    setSearchKeyword('');
    setSelectedDeptFilter('ALL');
    setSelectedTypeFilter('ALL');
  };

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

  const reset = () => { setSubmitted(null); setAts(null); setRedirecting(false); };

  const scoreColor = (s: number) => (s >= 75 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-rose-600');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans">
      <CandidateTopBar />
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <h1 className="text-lg font-extrabold">Karier di HR Command Center</h1>
        <p className="text-xs text-slate-300">Bergabunglah membangun ekosistem kinerja SDM kelas dunia.</p>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#0f172a]">Lowongan Terbuka</h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#007a5a]">
                  {filteredPostings.length} Posisi
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Jelajahi berbagai posisi strategis di bidang teknologi, human capital, audit, dan tata kelola perusahaan.
              </p>
            </div>
          </div>

          {/* Toolbar Filter & Pencarian */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              {/* Quick Search */}
              <div className="sm:col-span-5 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Cari posisi, divisi, skill, atau kata kunci..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] transition-colors"
                />
              </div>

              {/* Filter Departemen */}
              <div className="sm:col-span-4 relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="w-full h-9 pl-9 pr-7 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] cursor-pointer"
                  title="Filter per departemen"
                >
                  <option value="ALL">Semua Departemen ({postings.length})</option>
                  {departmentList.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tipe Pekerjaan */}
              <div className="sm:col-span-3 relative flex items-center gap-1.5">
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] cursor-pointer"
                  title="Filter tipe pekerjaan"
                >
                  <option value="ALL">Semua Tipe Kerja</option>
                  <option value="TETAP (PKWTT)">Tetap (PKWTT)</option>
                  <option value="KONTRAK (PKWT)">Kontrak (PKWT)</option>
                  <option value="MAGANG (INTERNSHIP)">Magang</option>
                </select>

                {hasActiveJobFilters && (
                  <button
                    type="button"
                    onClick={resetJobFilters}
                    className="h-9 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                    title="Reset seluruh filter pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredPostings.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-slate-200 bg-white">
              <p className="text-sm font-bold text-slate-700">Tidak ada lowongan yang sesuai kriteria pencarian.</p>
              <p className="text-xs text-slate-500 mt-1">Coba ubah kata kunci atau reset filter pencarian di atas.</p>
              {hasActiveJobFilters && (
                <button
                  type="button"
                  onClick={resetJobFilters}
                  className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#007a5a] bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredPostings.map((p) => {
                const avail = p.availability ?? 'AVAILABLE';
                const skillArr = skillsList(p.requiredSkills);
                const quota = p.quota ?? 0;
                const remaining = p.remaining ?? quota;
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-emerald-300 hover:shadow-xs transition-all space-y-2.5 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#0f172a] hover:text-[#007a5a] transition-colors">{p.postingTitle}</p>
                        <p className="text-[11px] text-[#64748b] mt-0.5">{p.department} · {p.position}</p>
                      </div>
                      {avail === 'AVAILABLE' ? (
                        <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Tersedia
                        </span>
                      ) : avail === 'FILLED' ? (
                        <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Kuota Terisi
                        </span>
                      ) : (
                        <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Ditutup
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#334155] line-clamp-3 leading-relaxed">{p.description}</p>

                    {skillArr.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {skillArr.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#64748b] pt-1 border-t border-slate-100">
                      {p.minEducation && (
                        <span>
                          Pendidikan: <strong className="text-[#334155]">{p.minEducation}</strong>
                        </span>
                      )}
                      {p.minExperienceYears != null && (
                        <span>
                          Pengalaman: <strong className="text-[#334155]">{p.minExperienceYears} thn</strong>
                        </span>
                      )}
                      {p.workLocation && (
                        <span>
                          Lokasi: <strong className="text-[#334155]">{p.workLocation}</strong>
                        </span>
                      )}
                      {p.employmentType && (
                        <span className="font-semibold text-emerald-700">{p.employmentType}</span>
                      )}
                    </div>

                    {quota > 0 && (
                      <p className="text-[10px] text-[#64748b]">
                        Kuota: <strong className="text-[#0f172a]">{p.hired ?? 0}/{quota}</strong> terisi · Sisa{' '}
                        <strong className="text-[#007a5a]">{remaining}</strong>
                      </p>
                    )}

                    <div className="pt-2 mt-auto">
                      <button
                        disabled={avail !== 'AVAILABLE'}
                        onClick={() => {
                          setSelectedPosting(p.id);
                          document.getElementById('form-lamaran')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full px-3 py-2 text-[11px] font-bold text-white bg-[#007a5a] hover:bg-[#006347] rounded-lg transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
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
              {redirecting && (
                <p className="text-[11px] font-semibold text-[#137333]">
                  Mengalihkan ke halaman progres tahapan lamaran…{' '}
                  <a href={`/careers/status?no=${encodeURIComponent(submitted)}`} className="underline">Buka sekarang</a>
                </p>
              )}
            </div>
          ) : (
            <ApplicationForm
              postings={postings.map((p) => ({ id: p.id, postingTitle: p.postingTitle }))}
              selectedPosting={selectedPosting}
              onSelectPosting={setSelectedPosting}
              onSubmitted={(no, atsRes) => {
                setSubmitted(no);
                setAts(atsRes);
                // Langsung pindah ke halaman progres tahapan memakai nomor
                // lamaran yang baru dibuat. Jeda dibuat pendek agar tidak
                // terasa macet; nomor lamaran tetap tampil di halaman tujuan.
                setRedirecting(true);
                setTimeout(() => router.push(`/careers/status?no=${encodeURIComponent(no)}`), 700);
              }}
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
