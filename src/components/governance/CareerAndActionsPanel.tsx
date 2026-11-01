'use client';
import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Compass, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface HrActionRecommendation {
  id: string;
  type: 'CONTRACT_EXPIRY' | 'OVERWORK_INTERVENTION' | 'PROMOTION_READINESS' | 'DOCUMENT_PENDING';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  actionUrl: string;
  actionLabel: string;
}

interface CareerLadderStep {
  targetPositionId: string;
  targetPositionTitle: string;
  targetJobGrade: string;
  minServiceMonths: number;
  currentServiceMonths: number;
  isServiceMet: boolean;
  minGpa: number;
  currentGpa: number | null;
  isGpaMet: boolean;
  isSkillsMet: boolean;
  requiredSkills: string[];
  verifiedSkills: string[];
  missingSkills: string[];
  unverifiedSkills: string[];
  readinessPercentage: number;
  isEligibleForPromotion: boolean;
}

interface CareerGuidance {
  employeeId: string;
  fullName: string;
  currentPositionTitle: string;
  currentJobGrade: string;
  serviceMonths: number;
  currentGpa: number | null;
  nextCareerPaths: CareerLadderStep[];
}

const TYPE_META: Record<HrActionRecommendation['type'], { label: string; className: string }> = {
  CONTRACT_EXPIRY: { label: 'Kontrak PKWT', className: 'bg-red-100 text-red-700' },
  OVERWORK_INTERVENTION: { label: 'Beban Kerja', className: 'bg-amber-100 text-amber-700' },
  PROMOTION_READINESS: { label: 'Jenjang Karir', className: 'bg-emerald-100 text-emerald-700' },
  DOCUMENT_PENDING: { label: 'Verifikasi Berkas', className: 'bg-sky-100 text-sky-700' },
};

const PRIORITY_META: Record<HrActionRecommendation['priority'], { label: string; className: string }> = {
  HIGH: { label: 'Prioritas Tinggi', className: 'text-red-600' },
  MEDIUM: { label: 'Prioritas Sedang', className: 'text-amber-600' },
  LOW: { label: 'Prioritas Rendah', className: 'text-slate-500' },
};

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

export default function CareerAndActionsPanel({ employeeId }: { employeeId?: string }) {
  const [recommendations, setRecommendations] = useState<HrActionRecommendation[]>([]);
  const [guidance, setGuidance] = useState<CareerGuidance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const tasks: Promise<void>[] = [
      fetchJson('/api/v1/hr/action-recommendations').then((json) => {
        if (active && json?.status === 'success') setRecommendations(json.data ?? []);
      }),
    ];

    if (employeeId) {
      tasks.push(
        fetchJson(`/api/v1/hr/career-guidance/${employeeId}`).then((json) => {
          if (active && json?.status === 'success') setGuidance(json.data);
        })
      );
    } else {
      setGuidance(null);
    }

    Promise.all(tasks)
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500 animate-pulse">
        Memuat rekomendasi aksi dan panduan karir...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat rekomendasi tindakan: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-sm text-slate-800">
              Rekomendasi Tindakan Cerdas HRD
            </h3>
          </div>
          <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            {recommendations.length} Rekomendasi Terbuka
          </span>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Tidak ada aksi kritis yang memerlukan tindakan segera.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`p-4 rounded-xl border transition-all ${
                  rec.priority === 'HIGH'
                    ? 'border-red-200 bg-red-50/40'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      TYPE_META[rec.type]?.className ?? 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {TYPE_META[rec.type]?.label ?? rec.type}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      PRIORITY_META[rec.priority]?.className ?? 'text-slate-500'
                    }`}
                  >
                    {PRIORITY_META[rec.priority]?.label ?? rec.priority}
                  </span>
                </div>
                <h4 className="font-semibold text-xs text-slate-900 mb-1">{rec.title}</h4>
                <p className="text-[11px] text-slate-600 mb-3">{rec.description}</p>
                <Link
                  href={rec.actionUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007a5a] hover:text-[#005f47]"
                >
                  {rec.actionLabel}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {guidance && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-semibold text-sm text-slate-800">
                Panduan Jenjang Karir: {guidance.fullName}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Posisi saat ini {guidance.currentPositionTitle} ({guidance.currentJobGrade}) &bull;
                masa kerja {guidance.serviceMonths} bulan &bull; GPA{' '}
                {guidance.currentGpa ?? 'belum ada appraisal'}
              </p>
            </div>
          </div>

          {guidance.nextCareerPaths.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              Belum ada jenjang karir lanjutan terdaftar untuk posisi ini (kemungkinan posisi puncak).
            </div>
          ) : (
            <div className="space-y-3">
              {guidance.nextCareerPaths.map((path) => (
                <div key={path.targetPositionId} className="p-4 rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold text-xs text-slate-900">
                      {path.targetPositionTitle}{' '}
                      <span className="text-slate-400 font-normal">({path.targetJobGrade})</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        path.isEligibleForPromotion
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      Kesiapan {path.readinessPercentage}%
                    </span>
                  </div>

                  <ul className="text-[11px] text-slate-600 space-y-1">
                    <li className="flex items-center gap-1.5">
                      {path.isServiceMet ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      Masa kerja {path.currentServiceMonths} bulan (minimal {path.minServiceMonths})
                    </li>
                    <li className="flex items-center gap-1.5">
                      {path.isGpaMet ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      GPA {path.currentGpa ?? '-'} (minimal {path.minGpa})
                    </li>
                    <li className="flex items-center gap-1.5">
                      {path.isSkillsMet ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      Skill wajib terverifikasi {path.verifiedSkills.length}/{path.requiredSkills.length}
                    </li>
                    {path.missingSkills.length > 0 && (
                      <li className="text-red-600">
                        Skill belum memenuhi syarat: {path.missingSkills.join(', ')}
                      </li>
                    )}
                    {path.unverifiedSkills.length > 0 && (
                      <li className="text-amber-700">
                        Belum diasesmen (wajib dinilai dulu): {path.unverifiedSkills.join(', ')}
                      </li>
                    )}
                    {path.verifiedSkills.length > 0 && (
                      <li className="text-emerald-700">
                        Skill terpenuhi: {path.verifiedSkills.join(', ')}
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Compass className="w-6 h-6 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-emerald-950">
              Penuntun Jalur Jenjang Karir & Matriks Suksesi
            </h4>
            <p className="text-xs text-emerald-900 leading-relaxed">
              Kesiapan promosi dihitung dari tiga syarat yang bobotnya setara: masa kerja,
              GPA appraisal terakhir (<code>performance_appraisals.composite_gpa</code>), dan
              keterampilan wajib pada <code>career_path_levels.required_skills</code>. Syarat
              keterampilan diambil dari <code>competency_scores</code> periode terakhir: skill
              yang sudah dinilai tetapi belum memenuhi level syarat dilaporkan sebagai gap,
              sedangkan skill yang belum pernah diasesmen dihitung <strong>belum terpenuhi</strong>
              sampai ada bukti penilaian. Promosi baru direkomendasikan ketika ketiga syarat
              terpenuhi sekaligus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
