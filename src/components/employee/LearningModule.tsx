'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface CourseRow {
  courseId: number;
  title: string;
  completionPct: number;
  completionState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  timeSpentMinutes: number;
}
interface BadgeRow { code: string; name: string; earned: boolean }
interface CatalogItem { id: number; courseCode: string; title: string; targetPhase: string; isMandatory: boolean; defaultHours: number }

/**
 * Modul Learning & Development (integrasi model Moodle).
 * Menampilkan kursus, progress, training hours, badge, dan aksi enroll.
 * Semua data berasal dari /api/v1/learning/*.
 */
export default function LearningModule() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [trainingHours, setTrainingHours] = useState(0);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ml, cat] = await Promise.all([
        fetch('/api/v1/learning/my-learning').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/v1/learning/courses').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (ml?.data) {
        setCourses(ml.data.courses ?? []);
        setBadges(ml.data.badges ?? []);
        setTrainingHours(Number(ml.data.trainingHours ?? 0));
      }
      if (cat?.data) setCatalog(cat.data.courses ?? []);
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enroll = async (courseId: number) => {
    try {
      const res = await fetch('/api/v1/learning/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      if (res.ok) {
        setMsg('Berhasil mendaftar kursus.');
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j?.detail || 'Gagal mendaftar kursus.');
      }
    } catch {
      setMsg('Gagal mendaftar kursus.');
    }
  };

  const totalHoursTarget = 24;
  const hoursPct = Math.min(100, Math.round((trainingHours / totalHoursTarget) * 100));

  return (
    <div className="stitch-card-white p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-extrabold text-[#0f172a]">Learning &amp; Development</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ecfdf5] text-[#047857]">Moodle Model</span>
        </div>
        {msg && <span className="text-[11px] font-semibold text-[#047857]">{msg}</span>}
      </div>

      {/* Summary: training hours + badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Training Hours (YTD)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#0f172a]">{trainingHours}</span>
            <span className="text-xs font-bold text-[#64748b]">/ {totalHoursTarget} jam</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
            <div className="h-full bg-[#007a5a]" style={{ width: `${hoursPct}%` }} />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Kursus Aktif</span>
          <div className="text-2xl font-black text-[#0f172a] mt-1">{courses.length}</div>
          <span className="text-[11px] text-[#64748b]">{courses.filter((c) => c.completionState === 'COMPLETE').length} selesai</span>
        </div>
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Badge Diraih</span>
          <div className="text-2xl font-black text-[#007a5a] mt-1">{badges.filter((b) => b.earned).length} / {badges.length}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {badges.map((b) => (
              <span key={b.code} title={b.name}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.earned ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#f1f5f9] text-[#94a3b8]'}`}>
                {b.earned ? '★' : '☆'} {b.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Enrolled courses with progress */}
      <div>
        <h3 className="text-xs font-bold text-[#334155] mb-2">Kursus Saya</h3>
        {loading ? (
          <p className="text-xs text-[#64748b]">Memuat…</p>
        ) : courses.length === 0 ? (
          <p className="text-xs text-[#64748b]">Belum ada kursus. Pilih dari katalog di bawah.</p>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.courseId} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#e2e8f0] bg-white">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0f172a] truncate">{c.title}</p>
                  <span className="text-[10px] text-[#64748b]">{c.completionState} · {c.timeSpentMinutes} menit</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
                    <div className="h-full bg-[#007a5a]" style={{ width: `${c.completionPct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#0f172a] font-mono w-9 text-right">{c.completionPct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog (enroll) */}
      <div>
        <h3 className="text-xs font-bold text-[#334155] mb-2">Katalog Kursus</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {catalog.map((c) => {
            const enrolled = courses.some((x) => x.courseId === c.id);
            return (
              <div key={c.id} className="p-3 rounded-lg border border-[#e2e8f0] bg-white flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8]">{c.targetPhase}</span>
                    {c.isMandatory && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#b45309]">Wajib</span>}
                  </div>
                  <p className="text-xs font-bold text-[#0f172a] mt-1.5">{c.title}</p>
                  <span className="text-[10px] text-[#64748b]">{c.defaultHours} jam</span>
                </div>
                <button
                  disabled={enrolled}
                  onClick={() => enroll(c.id)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${enrolled ? 'bg-[#f1f5f9] text-[#94a3b8]' : 'bg-[#007a5a] text-white hover:bg-[#006347]'}`}
                >
                  {enrolled ? 'Terdaftar' : 'Daftar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
