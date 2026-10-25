'use client';
import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Target, PieChart, Award, AlertTriangle } from 'lucide-react';
import GaussianCurve from '@/components/charts/GaussianCurve';
import NineBoxGrid from '@/components/charts/NineBoxGrid';

interface Bucket {
  label: string;
  count: number;
  percentage: number;
}

interface WorkforceProfile {
  headcount: { total: number; active: number; probation: number; pkwt: number; permanent: number };
  byDepartment: Bucket[];
  byGender: Bucket[];
  byAgeBand: Bucket[];
  byJobGrade: Bucket[];
  kpiAchievement: { averagePercentage: number; belowTargetCount: number; totalKpi: number };
  mppFulfillment: { quota: number; hired: number; percentage: number };
}

interface ExecutiveSummary {
  headcount: { total: number; probation: number; resigned: number };
  appraisal: { total_appraised: number; average_gpa: number; high_potential_count: number };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

function DistributionList({
  title,
  icon,
  buckets,
}: {
  title: string;
  icon: React.ReactNode;
  buckets: Bucket[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-700">
        {icon}
        {title}
      </div>
      {buckets.length === 0 ? (
        <p className="text-xs text-slate-400">Belum ada data.</p>
      ) : (
        <ul className="space-y-2">
          {buckets.map((b) => (
            <li key={b.label}>
              <div className="flex items-center justify-between text-[11px] text-slate-600 mb-0.5">
                <span className="truncate pr-2">{b.label}</span>
                <span className="font-semibold text-slate-800 whitespace-nowrap">
                  {b.count} ({b.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HrOverviewAnalyticsPanel() {
  const [profile, setProfile] = useState<WorkforceProfile | null>(null);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson('/api/v1/hr/workforce-profile'),
      fetchJson('/api/v1/analytics/executive-summary'),
    ])
      .then(([profileJson, summaryJson]) => {
        if (!active) return;
        if (profileJson?.status === 'success') setProfile(profileJson.data);
        if (summaryJson?.status === 'success') setSummary(summaryJson.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat analitik kepegawaian...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat analitik kepegawaian: {error}
      </div>
    );
  }

  const hc = profile?.headcount;
  const mpp = profile?.mppFulfillment;
  const kpi = profile?.kpiAchievement;

  return (
    <div className="space-y-6">
      {/* Metrik utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Users className="w-4 h-4 text-indigo-600" /> Headcount Aktif
          </div>
          <div className="text-2xl font-bold text-slate-800">{hc?.active ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            dari {hc?.total ?? 0} total &bull; PKWT {hc?.pkwt ?? 0} &bull; Probation{' '}
            {hc?.probation ?? 0}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Award className="w-4 h-4 text-emerald-600" /> Rata-rata GPA
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {summary?.appraisal.average_gpa ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {summary?.appraisal.total_appraised ?? 0} karyawan dinilai
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Capaian KPI
          </div>
          <div className="text-2xl font-bold text-slate-800">{kpi?.averagePercentage ?? 0}%</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpi?.belowTargetCount ?? 0} dari {kpi?.totalKpi ?? 0} KPI di bawah target
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Target className="w-4 h-4 text-violet-600" /> Pemenuhan MPP
          </div>
          <div className="text-2xl font-bold text-slate-800">{mpp?.percentage ?? 0}%</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {mpp?.hired ?? 0} terisi dari kuota {mpp?.quota ?? 0}
          </div>
        </div>
      </div>

      {/* Talent signal */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
        <AlertTriangle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-900 leading-relaxed">
          <span className="font-semibold">{summary?.appraisal.high_potential_count ?? 0} karyawan</span>{' '}
          berada di kuadran potensi tinggi (Future Leader / Growth Star / Enigma), dihitung dari
          appraisal terbaru. Matriks 9-Box di bawah menampilkan sebaran lengkap beserta daftar
          pegawai per kuadran.
        </p>
      </div>

      {/* Distribusi performa & 9-box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-700">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Distribusi Nilai Performa (Kurva Gaussian)
          </div>
          <GaussianCurve />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-700">
            <Award className="w-4 h-4 text-emerald-600" /> Matriks Talenta 9-Box
          </div>
          <NineBoxGrid />
        </div>
      </div>

      {/* Sebaran */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DistributionList
          title="Sebaran per Departemen"
          icon={<Users className="w-4 h-4 text-indigo-600" />}
          buckets={profile?.byDepartment ?? []}
        />
        <DistributionList
          title="Rasio Gender"
          icon={<PieChart className="w-4 h-4 text-emerald-600" />}
          buckets={profile?.byGender ?? []}
        />
        <DistributionList
          title="Sebaran Usia"
          icon={<PieChart className="w-4 h-4 text-amber-600" />}
          buckets={profile?.byAgeBand ?? []}
        />
        <DistributionList
          title="Sebaran Job Grade"
          icon={<PieChart className="w-4 h-4 text-slate-600" />}
          buckets={profile?.byJobGrade ?? []}
        />
      </div>
    </div>
  );
}