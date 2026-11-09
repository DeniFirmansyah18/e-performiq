'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, TrendingUp, Target, PieChart, Award, AlertTriangle, ArrowRight } from 'lucide-react';
import GaussianCurve from '@/components/charts/GaussianCurve';
import NineBoxGrid from '@/components/charts/NineBoxGrid';
import { useOptionalAuth } from '@/lib/context/AuthContext';

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
  ratingDistribution: Array<{ rating: string; count: number; percentage: number }>;
  mppFulfillment: { quota: number; hired: number; percentage: number };
}

/** Label & warna tiap rating, mengikuti skala performance_rating A/B/C/D. */
const RATING_META: Record<string, { label: string; range: string; color: string; bg: string }> = {
  A: { label: 'Rating A (Exceptional)', range: '>= 90%', color: 'text-[#137333]', bg: 'bg-[#007a5a]' },
  B: { label: 'Rating B (Solid/Meets)', range: '80% - 89.9%', color: 'text-[#0369a1]', bg: 'bg-[#0284c7]' },
  C: { label: 'Rating C (Acceptable)', range: '70% - 79.9%', color: 'text-[#b45309]', bg: 'bg-[#f59e0b]' },
  D: { label: 'Rating D (Unsatisfactory)', range: '< 70%', color: 'text-[#c5221f]', bg: 'bg-[#dc2626]' },
};

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
    <div className="stitch-card-white p-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#0f172a]">
        {icon}
        {title}
      </div>
      {buckets.length === 0 ? (
        <p className="text-xs text-[#94a3b8]">Belum ada data.</p>
      ) : (
        <ul className="space-y-2">
          {buckets.map((b) => (
            <li key={b.label}>
              <div className="flex items-center justify-between text-[11px] text-[#475569] mb-0.5">
                <span className="truncate pr-2">{b.label}</span>
                <span className="font-semibold text-[#0f172a] whitespace-nowrap">
                  {b.count} ({b.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#007a5a] rounded-full"
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
  // 9-Box kini diakses dari sini (bukan dari bilah atas); hanya untuk peran berhak.
  // `useOptionalAuth` aman bila komponen dirender tanpa AuthProvider (tes).
  const bolehBukaNineBox = ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN'].includes(
    useOptionalAuth()?.activeRole ?? ''
  );
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
    return <div className="p-6 text-sm text-[#64748b] animate-pulse">Memuat analitik kepegawaian...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-[#c5221f] bg-[#fce8e6] border border-[#f5c6c0] rounded-xl">
        Gagal memuat analitik kepegawaian: {error}
      </div>
    );
  }

  const hc = profile?.headcount;
  const mpp = profile?.mppFulfillment;
  const kpi = profile?.kpiAchievement;

  // Kurva Gaussian hanya dirender dari distribusi rating nyata. Tanpa data,
  // tampilkan keterangan jujur alih-alih angka contoh bawaan komponen.
  const ratings = (profile?.ratingDistribution ?? [])
    .filter((r) => RATING_META[r.rating])
    .map((r) => ({
      label: RATING_META[r.rating].label,
      range: RATING_META[r.rating].range,
      actual: r.percentage,
      target: 0,
      color: RATING_META[r.rating].color,
      bg: RATING_META[r.rating].bg,
    }));

  return (
    <div className="space-y-6">
      {/* Metrik utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 stitch-card-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b] mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e6f4ea]">
              <Users className="w-4 h-4 text-[#007a5a]" />
            </span>
            Headcount Aktif
          </div>
          <div className="text-2xl font-black text-[#0f172a]">{hc?.active ?? 0}</div>
          <div className="text-[11px] text-[#64748b] mt-1">
            dari {hc?.total ?? 0} total &bull; PKWT {hc?.pkwt ?? 0} &bull; Probation{' '}
            {hc?.probation ?? 0}
          </div>
        </div>

        <div className="p-4 stitch-card-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b] mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e6f4ea]">
              <Award className="w-4 h-4 text-[#007a5a]" />
            </span>
            Rata-rata GPA
          </div>
          <div className="text-2xl font-black text-[#0f172a]">
            {summary?.appraisal.average_gpa ?? 0}
          </div>
          <div className="text-[11px] text-[#64748b] mt-1">
            {summary?.appraisal.total_appraised ?? 0} karyawan dinilai
          </div>
        </div>

        <div className="p-4 stitch-card-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b] mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e6f4ea]">
              <TrendingUp className="w-4 h-4 text-[#007a5a]" />
            </span>
            Capaian KPI
          </div>
          <div className="text-2xl font-black text-[#0f172a]">{kpi?.averagePercentage ?? 0}%</div>
          <div className="text-[11px] text-[#64748b] mt-1">
            {kpi?.belowTargetCount ?? 0} dari {kpi?.totalKpi ?? 0} KPI di bawah target
          </div>
        </div>

        <div className="p-4 stitch-card-white">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b] mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e6f4ea]">
              <Target className="w-4 h-4 text-[#007a5a]" />
            </span>
            Pemenuhan MPP
          </div>
          <div className="text-2xl font-black text-[#0f172a]">{mpp?.percentage ?? 0}%</div>
          <div className="text-[11px] text-[#64748b] mt-1">
            {mpp?.hired ?? 0} terisi dari kuota {mpp?.quota ?? 0}
          </div>
        </div>
      </div>

      {/* Talent signal */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-[#b7e1cd] bg-[#e6f4ea]/60">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007a5a] flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-white" />
        </span>
        <p className="text-[11px] text-[#0d3b2e] leading-relaxed">
          <span className="font-semibold">{summary?.appraisal.high_potential_count ?? 0} karyawan</span>{' '}
          berada di kotak potensi tinggi (Pemimpin Masa Depan / Bintang Berkembang / Potensi Tinggi, Kinerja Rendah), dihitung dari
          appraisal terbaru. Matriks 9-Box di bawah menampilkan sebaran lengkap beserta daftar
          pegawai per kuadran.
        </p>
      </div>

      {/* Distribusi performa & 9-box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stitch-card-white p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#0f172a]">
            <TrendingUp className="w-4 h-4 text-[#007a5a]" /> Distribusi Nilai Performa (Kurva Gaussian)
          </div>
          {ratings.length === 0 ? (
            <p className="text-xs text-[#94a3b8]">
              Belum ada data appraisal untuk menggambarkan distribusi nilai.
            </p>
          ) : (
            <GaussianCurve ratings={ratings} />
          )}
        </div>
        <div className="stitch-card-white p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#0f172a]">
            <Award className="w-4 h-4 text-[#007a5a]" /> Matriks Talenta 9-Box
          </div>
          <NineBoxGrid />
          {bolehBukaNineBox && (
            <Link
              href="/dashboard/ninebox-matrix"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#007a5a] hover:underline"
            >
              Buka Matriks 9-Box <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Sebaran */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DistributionList
          title="Sebaran per Departemen"
          icon={<Users className="w-4 h-4 text-[#007a5a]" />}
          buckets={profile?.byDepartment ?? []}
        />
        <DistributionList
          title="Rasio Gender"
          icon={<PieChart className="w-4 h-4 text-[#007a5a]" />}
          buckets={profile?.byGender ?? []}
        />
        <DistributionList
          title="Sebaran Usia"
          icon={<PieChart className="w-4 h-4 text-[#007a5a]" />}
          buckets={profile?.byAgeBand ?? []}
        />
        <DistributionList
          title="Sebaran Job Grade"
          icon={<PieChart className="w-4 h-4 text-[#007a5a]" />}
          buckets={profile?.byJobGrade ?? []}
        />
      </div>
    </div>
  );
}