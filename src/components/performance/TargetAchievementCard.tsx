'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AnalisisCapaianAi from '@/components/performance/AnalisisCapaianAi';
import {
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Award,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  User as UserIcon,
  Search,
} from 'lucide-react';
import type { TargetAchievementResult, AchievementStatus } from '@/lib/services/targetAchievementService';

interface Props {
  periodId?: string;
  departmentId?: string;
  employeeId?: string;
  className?: string;
  title?: string;
  compact?: boolean;
}

export interface DrilledEmployee {
  id: string;
  name: string;
  position?: string | null;
  department?: string | null;
}

export default function TargetAchievementCard({
  periodId,
  departmentId: initialDeptId,
  employeeId,
  className = '',
  title,
  compact = false,
}: Props) {
  const [data, setData] = useState<TargetAchievementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [activeTab, setActiveTab] = useState<'TEAM' | 'MY_OWN'>('TEAM');
  const [selectedDept, setSelectedDept] = useState<string>(initialDeptId || '');
  // Paginasi daftar departemen (organisasi bisa punya puluhan divisi).
  const [halamanDept, setHalamanDept] = useState(1);

  // State navigasi drill-down karyawan spesifik untuk People Manager, HR, dan BOD
  const [drilledEmployee, setDrilledEmployee] = useState<DrilledEmployee | null>(null);
  const [drilledFromLabel, setDrilledFromLabel] = useState<string | null>(null);
  const [rootScopeLevel, setRootScopeLevel] = useState<string | null>(null);

  // Pencarian cepat anggota tim / karyawan departemen
  const [cariAnggota, setCariAnggota] = useState('');
  const [cariKaryawanDept, setCariKaryawanDept] = useState('');

  const targetEmpId = drilledEmployee?.id || employeeId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (periodId) params.set('period_id', periodId);
      // Ketika drill-down karyawan individu, filter department_id tidak perlu dikirim
      if (selectedDept && !drilledEmployee) params.set('department_id', selectedDept);
      if (targetEmpId) params.set('employee_id', targetEmpId);

      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/v1/performance/target-achievement${q}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.detail || 'Gagal memuat indikator pencapaian target.');
      }
      const fetchedData = json.data as TargetAchievementResult;
      setData(fetchedData);
      if (!drilledEmployee && fetchedData?.scopeLevel) {
        setRootScopeLevel(fetchedData.scopeLevel);
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat data target.');
    } finally {
      setLoading(false);
    }
  }, [periodId, selectedDept, targetEmpId, drilledEmployee]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Handler memilih karyawan untuk drill-down
  const handleDrillEmployee = (emp: DrilledEmployee) => {
    setDrilledEmployee(emp);
    setExpanded(true);
    if (rootScopeLevel === 'TEAM') {
      setDrilledFromLabel('Ikhtisar Tim');
    } else if (emp.department || selectedDeptName) {
      setDrilledFromLabel(`Dept. ${emp.department || selectedDeptName}`);
    } else {
      setDrilledFromLabel('Ikhtisar Organisasi');
    }
  };

  // Handler kembali dari drill-down ke tampilan tim / organisasi
  const handleKembaliDrill = () => {
    setDrilledEmployee(null);
  };

  if (loading && !data) {
    return (
      <div className={`p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-sm animate-pulse ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-48 bg-slate-200 rounded"></div>
          <div className="h-4 w-20 bg-slate-200 rounded"></div>
        </div>
        <div className="h-10 w-28 bg-slate-200 rounded mb-3"></div>
        <div className="h-3 w-full bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchData}
          className="px-2 py-1 bg-white rounded border border-rose-200 font-semibold hover:bg-rose-100"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Nilai aman untuk bentuk respons yang tidak lengkap (API lama/mock):
  const summary = data.summary ?? { exceededCount: 0, onTrackCount: 0, atRiskCount: 0, criticalCount: 0 };
  const individualKpis = data.individualKpis ?? [];
  const teamMembers = data.teamMembers ?? [];
  const perspectives = data.perspectives ?? [];
  const departments = data.departments ?? [];

  // Paginasi: 5 departemen per halaman
  const UKURAN_DEPT = 5;
  const totalHalamanDept = Math.max(1, Math.ceil(departments.length / UKURAN_DEPT));
  const halamanDeptAman = Math.min(halamanDept, totalHalamanDept);
  const deptTampil = departments.slice(
    (halamanDeptAman - 1) * UKURAN_DEPT,
    halamanDeptAman * UKURAN_DEPT
  );
  const jendelaDept = 5;
  const mulaiDept = Math.max(
    1,
    Math.min(halamanDeptAman - Math.floor(jendelaDept / 2), totalHalamanDept - jendelaDept + 1)
  );
  const nomorDept = Array.from(
    { length: Math.min(jendelaDept, totalHalamanDept) },
    (_, i) => mulaiDept + i
  );

  // Filter anggota tim (People Manager)
  const anggotaTimTampil = teamMembers.filter((m) => {
    if (!cariAnggota.trim()) return true;
    const q = cariAnggota.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      (m.position && m.position.toLowerCase().includes(q)) ||
      (m.department && m.department.toLowerCase().includes(q))
    );
  });

  // Filter karyawan di departemen terpilih (HR/BOD)
  const anggotaDeptTampil = teamMembers.filter((m) => {
    if (!cariKaryawanDept.trim()) return true;
    const q = cariKaryawanDept.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      (m.position && m.position.toLowerCase().includes(q))
    );
  });

  const selectedDeptObj = departments.find((d) => d.departmentId === selectedDept);
  const selectedDeptName = selectedDeptObj?.departmentName;

  const pct = data.overallPercentage ?? 0;
  const barWidth = Math.min(100, Math.max(0, pct));
  const statusColor = data.statusColor ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    bar: 'bg-slate-400',
  };
  const statusLabel = data.statusLabel ?? 'Belum dievaluasi';

  /** Format persentase yang tahan nilai kosong */
  const fmt = (value: unknown): string =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '0,0';

  const getSubTitle = () => {
    if (drilledEmployee) {
      return `Realisasi sasaran kerja & KPI individual: ${drilledEmployee.name}${
        drilledEmployee.position ? ` (${drilledEmployee.position})` : ''
      }`;
    }
    switch (data.scopeLevel) {
      case 'INDIVIDUAL':
        return 'Realisasi sasaran kerja & KPI individu Anda';
      case 'TEAM':
        return 'Rata-rata ketercapaian target tim & bawahan koordinasi';
      case 'ORGANIZATION':
        return 'Tingkat capaian target seluruh organisasi & divisi';
      case 'CORPORATE':
        return 'Indeks capaian target strategis korporasi (Balanced Scorecard)';
      default:
        return 'Persentase capaian target terhadap sasaran kerja';
    }
  };

  const displayTitle = drilledEmployee
    ? `Capaian Target: ${drilledEmployee.name}`
    : title || 'Indikator Pencapaian Target';

  return (
    <div className={`rounded-2xl bg-white border border-[#e2e8f0] shadow-sm overflow-hidden ${className}`}>
      {/* Breadcrumb Navigation Bar (aktif saat drill-down karyawan) */}
      {drilledEmployee && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200/80 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap text-[#475569]">
            <button
              type="button"
              onClick={handleKembaliDrill}
              className="inline-flex items-center gap-1 font-semibold text-[#007a5a] hover:underline cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>
                {drilledFromLabel ||
                  (rootScopeLevel === 'TEAM'
                    ? 'Ikhtisar Tim'
                    : selectedDeptName
                    ? `Dept. ${selectedDeptName}`
                    : 'Ikhtisar Organisasi')}
              </span>
            </button>
            <span className="text-slate-400">›</span>
            <span className="font-bold text-[#0f172a] inline-flex items-center gap-1">
              <UserIcon className="h-3.5 w-3.5 text-[#007a5a]" />
              {drilledEmployee.name}
              {drilledEmployee.position && (
                <span className="text-[11px] font-normal text-[#64748b]">
                  ({drilledEmployee.position})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/employees/${drilledEmployee.id}?tab=kinerja`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#cbd5e1] bg-white text-[11px] font-semibold text-[#007a5a] hover:bg-[#f8fafc] transition-colors"
            >
              <span>Profil Lengkap</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={handleKembaliDrill}
              className="text-[11px] font-semibold text-[#64748b] hover:text-[#0f172a] cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-5 border-b border-[#f1f5f9] bg-gradient-to-r from-slate-50/70 via-white to-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[#007a5a]">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-[#0f172a]">
                  {displayTitle}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                  {statusLabel}
                </span>
                {drilledEmployee && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Mode Individu
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748b]">{getSubTitle()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {data.periodCode && (
              <span className="px-2.5 py-1 rounded-lg bg-[#f1f5f9] border border-[#cbd5e1] font-mono text-[11px] text-[#334155] font-semibold">
                Periode: {data.periodCode}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              title="Perbarui data"
              className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Primary Metric & Visual Meter */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${statusColor.text}`}>
                {fmt(pct)}%
              </span>
              <span className="text-xs text-[#64748b] font-medium">
                capaian target {pct >= 100 ? '(melampaui target)' : 'terhadap sasaran'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#64748b]">
              <span>Target: <strong>{data.targetCount} sasaran</strong></span>
              <span>•</span>
              <span>Tercapai: <strong className="text-emerald-700">{data.achievedCount}</strong></span>
            </div>
          </div>

          {/* Visual Progress Bar with Threshold Markers */}
          <div className="relative pt-1">
            <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden border border-[#e2e8f0] relative">
              <div
                className={`h-full transition-all duration-700 ease-out rounded-full ${statusColor.bar}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Threshold Markers */}
            <div className="relative w-full flex justify-between text-[9px] text-[#94a3b8] font-mono mt-1 px-0.5">
              <span>0%</span>
              <span className="absolute left-[80%] -translate-x-1/2">
                <span className="inline-block w-px h-1.5 bg-slate-300 mr-0.5 align-middle"></span>
                80% (On Track)
              </span>
              <span className="absolute left-[100%] -translate-x-full font-bold text-[#64748b]">
                <span className="inline-block w-px h-1.5 bg-slate-400 mr-0.5 align-middle"></span>
                100% (Target)
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stat Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-[#f1f5f9]">
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-800 font-semibold">Tercapai (≥100%)</p>
              <p className="text-sm font-bold text-emerald-900 font-mono">{summary.exceededCount}</p>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-blue-800 font-semibold">On Track (80-99%)</p>
              <p className="text-sm font-bold text-blue-900 font-mono">{summary.onTrackCount}</p>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-amber-800 font-semibold">Perhatian (60-79%)</p>
              <p className="text-sm font-bold text-amber-900 font-mono">{summary.atRiskCount}</p>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-rose-800 font-semibold">Kritis (&lt;60%)</p>
              <p className="text-sm font-bold text-rose-900 font-mono">{summary.criticalCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Toggle */}
      <div className="px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9] flex items-center justify-between text-xs">
        <span className="font-semibold text-[#475569]">
          {data.scopeLevel === 'INDIVIDUAL' &&
            (drilledEmployee
              ? `Rincian Sasaran Kerja (KPI) Individual: ${drilledEmployee.name}`
              : 'Rincian Sasaran Kerja (KPI) Individu')}
          {data.scopeLevel === 'TEAM' && 'Rincian Kinerja Anggota Tim & Manajer'}
          {data.scopeLevel === 'ORGANIZATION' && 'Perbandingan Capaian per Departemen'}
          {data.scopeLevel === 'CORPORATE' && 'Pencapaian 4 Perspektif Balanced Scorecard & Divisi'}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 font-semibold text-[#007a5a] hover:text-[#006347] cursor-pointer"
        >
          {expanded ? 'Sembunyikan' : 'Lihat Rincian'}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded Content Area */}
      {expanded && (
        <div className="p-5 space-y-4">
          {/* ==================== INDIVIDUAL VIEW ==================== */}
          {data.scopeLevel === 'INDIVIDUAL' && data.individualKpis && (
            <div className="space-y-3">
              {individualKpis.length === 0 ? (
                <p className="text-xs text-[#64748b] text-center py-4">Belum ada KPI individu pada periode ini.</p>
              ) : (
                individualKpis.map((kpi) => (
                  <div key={kpi.id} className="p-3.5 rounded-xl border border-[#e2e8f0] bg-white space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[#0f172a]">{kpi.title}</p>
                        {kpi.pillarName && (
                          <p className="text-[10px] text-[#64748b]">Pilar: {kpi.pillarName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#334155]">
                          Target: {kpi.targetValue} {kpi.unit} | Realisasi: <strong>{kpi.actualValue} {kpi.unit}</strong>
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-[#475569]">
                          Bobot {kpi.weight}%
                        </span>
                        <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                          kpi.achievementPercentage >= 100
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : kpi.achievementPercentage >= 80
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {fmt(kpi.achievementPercentage)}%
                        </span>
                      </div>
                    </div>
                    {/* Item progress bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          kpi.achievementPercentage >= 100
                            ? 'bg-emerald-500'
                            : kpi.achievementPercentage >= 80
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, kpi.achievementPercentage))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}

              {/* Tautan ke halaman profil jika sedang dalam mode drill-down */}
              {drilledEmployee && (
                <div className="pt-2 flex items-center justify-between border-t border-[#f1f5f9] text-xs">
                  <span className="text-[11px] text-[#64748b]">
                    Menampilkan {individualKpis.length} sasaran kerja terverifikasi.
                  </span>
                  <Link
                    href={`/dashboard/employees/${drilledEmployee.id}?tab=kinerja`}
                    className="inline-flex items-center gap-1 font-semibold text-[#007a5a] hover:underline"
                  >
                    <span>Buka Lembar Kerja Pegawai Lengkap</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ==================== TEAM VIEW (PEOPLE MANAGER) ==================== */}
          {data.scopeLevel === 'TEAM' && (
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex gap-2 border-b border-[#f1f5f9] pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('TEAM')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'TEAM'
                      ? 'bg-[#007a5a] text-white'
                      : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" /> Capaian Anggota Tim ({teamMembers?.length || 0})
                </button>
                {data.myOwn && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('MY_OWN')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === 'MY_OWN'
                        ? 'bg-[#007a5a] text-white'
                        : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <Award className="h-3.5 w-3.5" /> Capaian KPI Pribadi Manajer
                  </button>
                )}
              </div>

              {activeTab === 'TEAM' ? (
                <div className="space-y-3">
                  {/* Kotak Filter Anggota Tim */}
                  {teamMembers.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama atau jabatan anggota tim..."
                        value={cariAnggota}
                        onChange={(e) => setCariAnggota(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#cbd5e1] text-xs text-[#0f172a] placeholder-slate-400 focus:outline-none focus:border-[#007a5a]"
                      />
                    </div>
                  )}

                  {(!teamMembers || teamMembers.length === 0) ? (
                    <p className="text-xs text-[#64748b] text-center py-4">Belum ada anggota tim terdaftar.</p>
                  ) : anggotaTimTampil.length === 0 ? (
                    <p className="text-xs text-[#64748b] text-center py-3">Tidak ada anggota tim yang cocok dengan kata kunci.</p>
                  ) : (
                    anggotaTimTampil.map((m) => (
                      <div
                        key={m.employeeId}
                        className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-[#0f172a]">{m.fullName}</p>
                          <p className="text-[11px] text-[#64748b]">
                            {m.position || '—'} {m.department ? `· ${m.department}` : ''} ({m.kpiCount} KPI)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 sm:w-36 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                m.achievementPercentage >= 100
                                  ? 'bg-emerald-500'
                                  : m.achievementPercentage >= 80
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, m.achievementPercentage))}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                            m.achievementPercentage >= 100
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.achievementPercentage >= 80
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {fmt(m.achievementPercentage)}%
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleDrillEmployee({
                                id: m.employeeId,
                                name: m.fullName,
                                position: m.position,
                                department: m.department,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#007a5a] text-[11px] font-semibold border border-emerald-200 transition-colors cursor-pointer"
                            title={`Lihat indikator target individual ${m.fullName}`}
                          >
                            <span>Lihat Target</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
                  <p className="text-xs font-bold text-indigo-900">Sasaran Kinerja Pribadi Anda</p>
                  <p className="text-[11px] text-[#475569]">
                    Sebagai Manajer, capaian KPI individual Anda berkontribusi pada evaluasi kinerja dan pembobotan komposit GPA.
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-2xl font-extrabold font-mono text-indigo-700">
                      {fmt(data.myOwn?.overallPercentage)}%
                    </span>
                    <span className="text-xs font-semibold text-[#64748b]">
                      ({data.myOwn?.kpiCount} KPI terdaftar)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== CORPORATE VIEW (BOD) ==================== */}
          {data.scopeLevel === 'CORPORATE' && data.perspectives && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-[#0f172a] mb-2 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Ketercapaian per Perspektif Balanced Scorecard (BSC)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {perspectives.map((p) => (
                    <div key={p.perspective} className="p-3.5 rounded-xl border border-[#e2e8f0] bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a]">{p.perspectiveLabel}</span>
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          p.averagePercentage >= 100
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.averagePercentage >= 80
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {fmt(p.averagePercentage)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            p.averagePercentage >= 100 ? 'bg-emerald-500' : p.averagePercentage >= 80 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, p.averagePercentage))}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#64748b]">{p.kpiCount} KPI korporat & divisi terhubung</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== ORGANIZATION VIEW (HR / BOD / ADMIN) ==================== */}
          {(data.scopeLevel === 'ORGANIZATION' || data.scopeLevel === 'CORPORATE') && data.departments && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#007a5a]" />
                  Perbandingan Capaian per Departemen / Divisi
                </p>
                {departments.length > 0 && (
                  <select
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setCariKaryawanDept('');
                    }}
                    className="text-[11px] rounded-lg border border-[#cbd5e1] px-2 py-1 bg-white font-medium text-[#334155] cursor-pointer"
                  >
                    <option value="">Semua Departemen</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                {deptTampil.map((d) => (
                  <div key={d.departmentId} className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-[#0f172a]">{d.departmentName}</p>
                      <p className="text-[11px] text-[#64748b]">
                        {d.employeeCount} karyawan aktif · {d.kpiCount} sasaran terukur
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-28 sm:w-44 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            d.averagePercentage >= 100
                              ? 'bg-emerald-500'
                              : d.averagePercentage >= 80
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, d.averagePercentage))}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        d.averagePercentage >= 100
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : d.averagePercentage >= 80
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {fmt(d.averagePercentage)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigasi halaman daftar departemen */}
              {totalHalamanDept > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#64748b]">
                  <span>
                    Menampilkan {(halamanDeptAman - 1) * UKURAN_DEPT + 1}–
                    {Math.min(halamanDeptAman * UKURAN_DEPT, departments.length)} dari {departments.length} departemen
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHalamanDept(halamanDeptAman - 1)}
                      disabled={halamanDeptAman <= 1}
                      aria-label="Halaman departemen sebelumnya"
                      className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc] cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    {nomorDept.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHalamanDept(n)}
                        aria-label={`Halaman departemen ${n}`}
                        aria-current={n === halamanDeptAman ? 'page' : undefined}
                        className={`min-w-[26px] h-[26px] rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          n === halamanDeptAman
                            ? 'bg-[#007a5a] border-[#007a5a] text-white'
                            : 'bg-white border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setHalamanDept(halamanDeptAman + 1)}
                      disabled={halamanDeptAman >= totalHalamanDept}
                      aria-label="Halaman departemen berikutnya"
                      className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc] cursor-pointer"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}

              {/* Bantuan analisis AI: rekomendasi tindakan berdasarkan capaian. */}
              <AnalisisCapaianAi periodId={periodId} />

              {/* Rincian Karyawan di Departemen Terpilih dengan Akses Target Individu */}
              {selectedDept && (
                <div className="mt-4 pt-3 border-t border-[#f1f5f9] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#0f172a]">
                      Karyawan di Departemen {selectedDeptName || 'Terpilih'} ({teamMembers.length})
                    </p>
                    {teamMembers.length > 0 && (
                      <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Cari nama karyawan di divisi..."
                          value={cariKaryawanDept}
                          onChange={(e) => setCariKaryawanDept(e.target.value)}
                          className="w-full h-7 pl-8 pr-2.5 rounded-lg border border-[#cbd5e1] text-[11px] text-[#0f172a] placeholder-slate-400 focus:outline-none focus:border-[#007a5a]"
                        />
                      </div>
                    )}
                  </div>

                  {(!teamMembers || teamMembers.length === 0) ? (
                    <p className="text-xs text-[#64748b] text-center py-3">Belum ada data karyawan pada departemen ini.</p>
                  ) : anggotaDeptTampil.length === 0 ? (
                    <p className="text-[11px] text-[#64748b] text-center py-3">Tidak ada karyawan yang cocok dengan pencarian.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {anggotaDeptTampil.map((m) => (
                        <div
                          key={m.employeeId}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs hover:border-emerald-300 transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-[#0f172a]">{m.fullName}</p>
                            <p className="text-[10px] text-[#64748b]">{m.position || '—'}</p>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-[#007a5a]">
                              {fmt(m.achievementPercentage)}%
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDrillEmployee({
                                  id: m.employeeId,
                                  name: m.fullName,
                                  position: m.position,
                                  department: m.department || selectedDeptName,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-[#007a5a] text-[11px] font-semibold transition-colors cursor-pointer"
                              title={`Lihat indikator target individual ${m.fullName}`}
                            >
                              <span>Lihat Target</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
