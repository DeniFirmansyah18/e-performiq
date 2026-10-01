'use client';

import React, { useEffect, useState } from 'react';
import { Compass, GraduationCap, CheckCircle2, ExternalLink, X, AlertCircle } from 'lucide-react';

interface CareerLevel {
id: string;
targetPositionTitle: string;
minGpa: number;
minServiceMonths: number;
requiredSkills: string[];
}

interface CareerPathModalProps {
isOpen: boolean;
onClose: () => void;
}

export default function CareerPathModal({ isOpen, onClose }: CareerPathModalProps) {
const [levels, setLevels] = useState<CareerLevel[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [enrollMsg, setEnrollMsg] = useState<string | null>(null);
const [enrolling, setEnrolling] = useState(false);

const handleEnroll = async () => {
try {
setEnrolling(true);
setEnrollMsg(null);
// Cari kursus CLOUD-ARCH dari katalog, lalu daftar via API native (bukan alert stub).
const catRes = await fetch('/api/v1/learning/courses?phase=DURING');
const cat = catRes.ok ? await catRes.json() : null;
const course = (cat?.data?.courses ?? []).find((c: any) => c.courseCode === 'CLOUD-ARCH')
  ?? (cat?.data?.courses ?? [])[0];
if (!course) {
setEnrollMsg('Katalog kursus belum tersedia.');
return;
}
const res = await fetch('/api/v1/learning/enrollments', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ courseId: course.id }),
});
setEnrollMsg(res.ok ? `Berhasil mendaftar: ${course.title}.` : 'Gagal mendaftar kursus.');
} catch {
setEnrollMsg('Gagal mendaftar kursus.');
} finally {
setEnrolling(false);
}
};

useEffect(() => {
if (!isOpen) return;
let cancelled = false;
(async () => {
setLoading(true);
setError('');
try {
const res = await fetch('/api/v1/learning/career-path');
const json = await res.json();
if (!res.ok) {
throw new Error(json.detail || json.message || 'Gagal memuat peta karir.');
}
if (!cancelled) setLevels(json.data?.items ?? []);
} catch (err: any) {
if (!cancelled) setError(err.message || 'Terjadi kesalahan sistem.');
} finally {
if (!cancelled) setLoading(false);
}
})();
return () => {
cancelled = true;
};
}, [isOpen]);

if (!isOpen) return null;

return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
    <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-emerald-600 text-white">
          <Compass className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Peta Jenjang Karir & Akademi Pelatihan</h3>
          <p className="text-[11px] text-slate-400">SUBPeta Jenjang Karir & Akademi Pelatihan</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
      {/* Career Path Steps — live dari database */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Tangga Kemajuan Karir (Job Grade Progression)
        </h4>

        {loading && (
          <p className="text-xs text-slate-500 p-4 rounded-xl bg-slate-50 border border-slate-200">
            Memuat peta jenjang karir dari database...
          </p>
        )}

        {!loading && error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && levels.length === 0 && (
          <p className="text-xs text-slate-500 p-4 rounded-xl bg-slate-50 border border-slate-200">
            Belum ada jenjang karir terdaftar untuk posisi jabatan Anda.
          </p>
        )}

        {!loading && !error && levels.length > 0 && (
          <div className="space-y-3">
            {levels.map((level) => (
              <div
                key={level.id}
                className="p-4 rounded-xl border text-xs bg-white border-slate-200 shadow-xs"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-800">{level.targetPositionTitle}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    Target Berikutnya
                  </span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                  <span className="font-bold text-slate-700 block text-[11px]">
                    Syarat Kelayakan Promosi:
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>Minimal Composite GPA: {Number(level.minGpa).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>Masa kerja posisi saat ini: Minimal {level.minServiceMonths} bulan</span>
                  </div>
                  {level.requiredSkills.length > 0 && (
                    <div className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>Kompetensi wajib: {level.requiredSkills.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Moodle LMS Module Self-Enrollment Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            <h5 className="font-bold text-xs text-slate-800">Modul Rekomendasi Moodle SSO</h5>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            Target 24 Jam/Tahun (ISO 30414)
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Daftar mandiri ke modul pelatihan untuk menutup celah kompetensi dan mempercepat kenaikan pangkat Anda.
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-slate-700">Course #101: Enterprise Cloud Architecture</span>
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {enrolling ? 'Mendaftar…' : 'Daftar Mandiri'}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        {enrollMsg && <p className="text-[11px] font-semibold text-emerald-700 pt-1">{enrollMsg}</p>}
      </div>
    </div>
  </div>
</div>
);
}
