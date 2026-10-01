'use client';

import React, { useEffect, useState } from 'react';

interface PhaseRow { phase: string; enrolled: number; completed: number; completionRate: number }
interface Summary { byPhase: PhaseRow[]; totalTrainingHours: number; badgesIssued: number }

/**
 * Panel Learning & Certification untuk HR Command Center.
 * Aggregate dari /api/v1/learning/training-summary (permission learning:manage).
 */
export default function LearningCertificationPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/learning/training-summary');
        if (!res.ok) {
          if (active) setErr(res.status === 403 ? 'Anda tidak berwenang melihat ringkasan LMS.' : 'Gagal memuat ringkasan LMS.');
          return;
        }
        const json = await res.json();
        if (active) setSummary(json.data);
      } catch {
        if (active) setErr('Gagal memuat ringkasan LMS.');
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <h2 className="text-base font-extrabold text-[#0f172a]">Learning &amp; Certification</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ecfdf5] text-[#047857]">Moodle Model</span>
      </div>

      {err ? (
        <p className="text-xs text-[#64748b]">{err}</p>
      ) : !summary ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Total Training Hours</span>
              <div className="text-2xl font-black text-[#0f172a] mt-1">{summary.totalTrainingHours}</div>
            </div>
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Badge Issued</span>
              <div className="text-2xl font-black text-[#007a5a] mt-1">{summary.badgesIssued}</div>
            </div>
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Fase Aktif</span>
              <div className="text-2xl font-black text-[#0f172a] mt-1">{summary.byPhase.length}</div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#334155] mb-2">Completion Rate per Fase Lifecycle</h3>
            <div className="space-y-2">
              {summary.byPhase.map((p) => (
                <div key={p.phase} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold text-[#0f172a] w-20">{p.phase}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
                    <div className="h-full bg-[#007a5a]" style={{ width: `${p.completionRate}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-[#64748b] w-24 text-right">{p.completed}/{p.enrolled} ({p.completionRate}%)</span>
                </div>
              ))}
              {summary.byPhase.length === 0 && <p className="text-xs text-[#64748b]">Belum ada enrollment.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
