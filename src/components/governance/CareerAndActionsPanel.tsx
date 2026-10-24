'use client';
import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowUpRight, Award, Compass, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function CareerAndActionsPanel() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/hr/action-recommendations')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRecommendations(json.data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat rekomendasi aksi dan panduan karir...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Action Recommendation Section */}
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
                      rec.priority === 'HIGH'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {rec.type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{rec.priority}</span>
                </div>
                <h4 className="font-semibold text-xs text-slate-900 mb-1">{rec.title}</h4>
                <p className="text-[11px] text-slate-600 mb-3">{rec.description}</p>
                <Link
                  href={rec.actionUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {rec.actionLabel}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Career Ladder Guidance Info Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Compass className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-indigo-950">
              Penuntun Jalur Jenjang Karir & Matriks Suksesi
            </h4>
            <p className="text-xs text-indigo-800 leading-relaxed">
              HRD menuntun pegawai ke jenjang karir berikutnya dengan mencocokkan masa kerja minimal,
              capaian nilai GPA/KPI, serta keterampilan wajib (`career_path_levels`). Evaluasi ini
              otomatis disinkronkan ke 9-Box Talent Matrix untuk promosi berkeadilan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
