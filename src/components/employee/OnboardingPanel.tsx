'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { GraduationCap, CheckCircle2, Circle, Award, RefreshCw, Play } from 'lucide-react';

interface OnboardingItem {
  courseId: number;
  courseCode: string;
  title: string;
  isMandatory: boolean;
  enrolled: boolean;
  completionPct: number;
  completionState: string | null;
  certified: boolean;
}
interface OnboardingStatus {
  employeeId: string;
  programId: string | null;
  positionTitle: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
  totalMandatory: number;
  completedMandatory: number;
  progressPct: number;
  items: OnboardingItem[];
}

/**
 * Panel Onboarding LMS (WS-8) — program onboarding per-posisi untuk karyawan.
 * Menampilkan kurikulum, progress, dan aksi mulai/segarkan/selesaikan kursus.
 * Data dari /api/v1/learning/onboarding & /api/v1/learning/enrollments.
 */
export default function OnboardingPanel() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/learning/onboarding');
      const j = await res.json().catch(() => ({}));
      setStatus(res.ok ? (j.data as OnboardingStatus) : null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/v1/learning/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }),
    });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Program onboarding dibuat (${j.data.enrolled ?? 0} kursus didaftarkan).` : (j?.detail || 'Gagal membuat program.'));
    setBusy(false); await load();
  };

  const refresh = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/v1/learning/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      const issued = j.data.issuedCertificates?.length ?? 0;
      setMsg(issued > 0 ? `Onboarding selesai! ${issued} e-sertifikat diterbitkan.` : 'Status diperbarui.');
    } else setMsg(j?.detail || 'Gagal memperbarui status.');
    setBusy(false); await load();
  };

  const toggleCourse = async (item: OnboardingItem) => {
    setBusy(true); setMsg(null);
    const done = item.completionState === 'COMPLETE';
    const res = await fetch(`/api/v1/learning/enrollments/${item.courseId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(done ? { progressPct: 0 } : { complete: true }),
    });
    if (res.ok) {
      setMsg(done ? 'Progres kursus direset.' : `Kursus "${item.title}" ditandai selesai.`);
      if (!done) await fetch('/api/v1/learning/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }),
      });
    } else setMsg('Gagal memperbarui kursus.');
    setBusy(false); await load();
  };

  if (loading) return <div className="stitch-card-white p-6 text-xs text-[#64748b]">Memuat onboarding…</div>;

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap className="h-4 w-4 text-[#007a5a]" />
          <h2 className="text-base font-extrabold text-[#0f172a]">Onboarding</h2>
          {status?.status === 'COMPLETED' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333]">Selesai</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={busy} onClick={refresh}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[#334155] text-[11px] font-semibold hover:bg-slate-200 disabled:opacity-50">
            <RefreshCw className="h-3 w-3" /> Segarkan
          </button>
          {!status?.programId && (
            <button disabled={busy} onClick={generate}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0f172a] text-white text-[11px] font-semibold hover:bg-[#1e293b] disabled:opacity-50">
              <Play className="h-3 w-3" /> Mulai Program
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-[11px] font-semibold text-[#047857]">{msg}</p>}

      {!status || status.items.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada kurikulum onboarding untuk posisi Anda. Klik &quot;Mulai Program&quot; atau hubungi HR.</p>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748b]">{status.positionTitle} · {status.completedMandatory}/{status.totalMandatory} kursus wajib selesai</span>
              <span className="font-bold text-[#0f172a]">{status.progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
              <div className="h-full bg-[#007a5a] transition-all" style={{ width: `${status.progressPct}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {status.items.map((item) => {
              const done = item.completionState === 'COMPLETE';
              return (
                <div key={item.courseId} className="flex items-center justify-between p-3 rounded-xl border border-[#e2e8f0]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> : <Circle className="h-4 w-4 text-[#cbd5e1] flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0f172a] truncate">{item.title}</p>
                      <p className="text-[10px] text-[#64748b]">
                        {item.courseCode}
                        {item.isMandatory ? ' · Wajib' : ' · Opsional'}
                        {item.certified && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600">
                            <Award className="h-3 w-3" /> Bersertifikat
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button disabled={busy || !item.enrolled} onClick={() => toggleCourse(item)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 ${done ? 'bg-slate-100 text-[#334155] hover:bg-slate-200' : 'bg-[#007a5a] text-white hover:bg-[#006347]'}`}>
                    {done ? 'Reset' : item.enrolled ? 'Tandai Selesai' : 'Belum Terdaftar'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
