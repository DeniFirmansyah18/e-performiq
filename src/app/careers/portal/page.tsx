'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers, LogOut, Briefcase, Search, Users, CheckCircle2, XCircle, Calendar, Video,
} from 'lucide-react';
import CandidateNotifications from '@/components/careers/CandidateNotifications';

interface InterviewInfo {
  stageStatus: string;
  scheduledAt: string | null;
  meetingUrl: string | null;
  interviewerName: string | null;
}

interface Posting {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: unknown;
  department: string;
  position: string;
  status: string;
  quota: number;
  hired: number;
  remaining: number;
  availability: 'AVAILABLE' | 'FILLED' | 'CLOSED';
}

function skills(p: unknown): string[] {
  if (Array.isArray(p)) return p.map((s) => (typeof s === 'string' ? s : (s?.name ?? ''))).filter(Boolean);
  if (typeof p === 'string') { try { return skills(JSON.parse(p)); } catch { return []; } }
  return [];
}

export default function CandidatePortalPage() {
  const router = useRouter();
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [search, setSearch] = useState('');
  const [interview, setInterview] = useState<InterviewInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/careers/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data?.account) setAccount(j.data.account); else router.replace('/careers/login'); })
      .catch(() => router.replace('/careers/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const load = useCallback(async () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/v1/careers/portal/postings${q}`);
    const j = await res.json().catch(() => ({}));
    setPostings(j?.data?.postings ?? []);
  }, [search]);

  useEffect(() => { if (account) load(); }, [account, load]);

  // Jadwal wawancara (bila HR telah membuatkan tautan).
  useEffect(() => {
    if (!account) return;
    fetch('/api/v1/careers/interview')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setInterview(j?.data?.interview ?? null))
      .catch(() => setInterview(null));
  }, [account]);

  const logout = async () => {
    await fetch('/api/v1/careers/auth/me', { method: 'POST' });
    router.push('/careers/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#64748b]">Memuat…</div>;
  if (!account) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="h-14 bg-[#0d131f] px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007a5a]">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">Portal Kandidat</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300 hidden sm:inline">{account.name}</span>
          <CandidateNotifications />
          <Link href="/careers/portal/assessments"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#006347] text-xs font-semibold text-white transition-colors">
            Asesmen
          </Link>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors">
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-5">
        {interview && (
          <section className="rounded-2xl bg-white border border-[#b7e1cd] p-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#007a5a]" />
              <h2 className="text-sm font-extrabold text-[#0f172a]">Jadwal Wawancara</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                {interview.stageStatus === 'PASSED' ? 'Selesai' : interview.stageStatus === 'SCHEDULED' ? 'Terjadwal' : interview.stageStatus}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#334155]">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Waktu</p>
                <p className="font-semibold text-[#0f172a]">
                  {interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString('id-ID') : 'Belum dijadwalkan'}
                </p>
              </div>
              {interview.interviewerName && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Pewawancara</p>
                  <p className="font-semibold text-[#0f172a]">{interview.interviewerName}</p>
                </div>
              )}
            </div>
            {interview.meetingUrl && (
              <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold transition-colors">
                <Video className="h-3.5 w-3.5" /> Gabung Wawancara
              </a>
            )}
          </section>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#0f172a]">Lowongan Tersedia</h1>
            <p className="text-xs text-[#64748b] mt-0.5">Pilih posisi dan lamar dengan profil terbaik Anda.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari posisi / divisi…"
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
            />
          </div>
        </div>

        {postings.length === 0 ? (
          <div className="rounded-2xl bg-white border border-dashed border-[#cbd5e1] p-8 text-center">
            <Briefcase className="h-5 w-5 text-[#94a3b8] mx-auto" />
            <p className="mt-2 text-xs text-[#64748b]">Belum ada lowongan yang dipublikasikan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {postings.map((p) => {
              const isAvailable = p.availability === 'AVAILABLE';
              return (
                <div key={p.id} className="rounded-2xl bg-white border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-[#0f172a]">{p.postingTitle}</h2>
                      <p className="text-xs text-[#64748b]">{p.department} &bull; {p.position}</p>
                      <p className="text-xs text-[#334155] mt-2 line-clamp-2">{p.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                          <CheckCircle2 className="h-3 w-3" /> Tersedia
                        </span>
                      ) : p.availability === 'FILLED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                          <Users className="h-3 w-3" /> Kuota Terisi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fce8e6] text-[#c5221f] border border-[#f5c2c7]">
                          <XCircle className="h-3 w-3" /> Ditutup
                        </span>
                      )}
                    </div>
                  </div>

                  {skills(p.requiredSkills).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skills(p.requiredSkills).map((s, i) => (
                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569]">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-[11px] text-[#64748b]">
                      <span>Kuota: <strong className="text-[#0f172a]">{p.quota}</strong></span>
                      <span>Terisi: <strong className="text-[#0f172a]">{p.hired}</strong></span>
                      <span>Sisa: <strong className={p.remaining > 0 ? 'text-[#007a5a]' : 'text-[#c5221f]'}>{p.remaining}</strong></span>
                    </div>
                    {isAvailable ? (
                      <Link href={`/careers?posting=${p.id}`} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#007a5a] hover:bg-[#00684a] text-white transition-colors">
                        Lamar Posisi Ini
                      </Link>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#94a3b8]">
                        Tidak Tersedia
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
