'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (periodId) params.set('period_id', periodId);
      if (selectedDept) params.set('department_id', selectedDept);
      if (employeeId) params.set('employee_id', employeeId);

      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/v1/performance/target-achievement${q}`);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.detail || 'Gagal memuat indikator pencapaian target.');
      }
      setData(json.data as TargetAchievementResult);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat data target.');
    } finally {
      setLoading(false);
    }
  }, [periodId, selectedDept, employeeId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
  // tanpa ini, satu field hilang membuat seluruh dashboard crash.
  const summary = data.summary ?? { exceededCount: 0, onTrackCount: 0, atRiskCount: 0, criticalCount: 0 };
  const individualKpis = data.individualKpis ?? [];
  const teamMembers = data.teamMembers ?? [];
  const perspectives = data.perspectives ?? [];
  const departments = data.departments ?? [];

  // Paginasi: 5 departemen per halaman, nomor halaman maksimal 5.
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

  const pct = data.overallPercentage ?? 0;
  const barWidth = Math.min(100, Math.max(0, pct));
  // API lama/mock bisa tidak mengirim statusColor; jangan sampai crash seluruh dashboard.
  const statusColor = data.statusColor ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    bar: 'bg-slate-400',
  };
  const statusLabel = data.statusLabel ?? 'Belum dievaluasi';
  /** Format persentase yang tahan nilai kosong (API lama/mock bisa tak mengirim angka). */
  const fmt = (value: unknown): string =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '0,0';

  const getSubTitle = () => {
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

  return (
    <div className={`rounded-2xl bg-white border border-[#e2e8f0] shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-[#f1f5f9] bg-gradient-to-r from-slate-50/70 via-white to-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[#007a5a]">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#0f172a]">
                  {title || 'Indikator Pencapaian Target'}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                  {statusLabel}
                </span>
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
              className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] disabled:opacity-50 transition-colors"
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
          {data.scopeLevel === 'INDIVIDUAL' && 'Rincian Sasaran Kerja (KPI) Individu'}
          {data.scopeLevel === 'TEAM' && 'Rincian Kinerja Anggota Tim & Manajer'}
          {data.scopeLevel === 'ORGANIZATION' && 'Perbandingan Capaian per Departemen'}
          {data.scopeLevel === 'CORPORATE' && 'Pencapaian 4 Perspektif Balanced Scorecard & Divisi'}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 font-semibold text-[#007a5a] hover:text-[#006347]"
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
                      <div className="flex items-center gap-2">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                <div className="space-y-2">
                  {(!teamMembers || teamMembers.length === 0) ? (
                    <p className="text-xs text-[#64748b] text-center py-4">Belum ada anggota tim terdaftar.</p>
                  ) : (
                    teamMembers.map((m) => (
                      <div key={m.employeeId} className="p-3 rounded-xl border border-[#e2e8f0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-[#0f172a]">{m.fullName}</p>
                          <p className="text-[11px] text-[#64748b]">
                            {m.position || '—'} {m.department ? `· ${m.department}` : ''} ({m.kpiCount} KPI)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-28 sm:w-36 h-2 bg-slate-100 rounded-full overflow-hidden">
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

          {/* ==================== ORGANIZATION VIEW (HR / BOD / BOD / ADMIN) ==================== */}
          {(data.scopeLevel === 'ORGANIZATION' || data.scopeLevel === 'CORPORATE') && data.departments && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#007a5a]" />
                  Perbandingan Capaian per Departemen / Divisi
                </p>
                {departments.length > 0 && (
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="text-[11px] rounded-lg border border-[#cbd5e1] px-2 py-1 bg-white font-medium text-[#334155]"
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
                      className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
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
                        className={`min-w-[26px] h-[26px] rounded-lg border text-[11px] font-semibold transition-colors ${
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
                      className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}

              {/* Bantuan analisis AI: rekomendasi tindakan berdasarkan capaian. */}
              <AnalisisCapaianAi periodId={periodId} />

              {/* Rincian Karyawan di Departemen Terpilih */}
              {selectedDept && teamMembers && teamMembers.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#f1f5f9] space-y-2">
                  <p className="text-xs font-bold text-[#0f172a]">Karyawan di Departemen Terpilih ({teamMembers.length})</p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {teamMembers.map((m) => (
                      <div key={m.employeeId} className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[#0f172a]">{m.fullName}</p>
                          <p className="text-[10px] text-[#64748b]">{m.position || '—'}</p>
                        </div>
                        <span className="font-mono font-bold text-[#007a5a]">{fmt(m.achievementPercentage)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

