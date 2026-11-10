'use client';

import { createPortal } from 'react-dom';
import { nineBoxCopy } from '@/lib/employee/nineBoxLabels';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Filter,
  Calendar,
  Users,
  Target,
  Network,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Shuffle,
  Award,
  Plus,
  Compass,
  X,
  Grid3X3,
  ListOrdered,
} from 'lucide-react';
import FeatureGrid from '@/components/ui/FeatureGrid';
import FeatureCard from '@/components/ui/FeatureCard';

import ExpandablePanel from '@/components/ui/ExpandablePanel';
import AiAnalyzePanel from '@/components/ai/AiAnalyzePanel';

type NineboxFeature = 'distribusi' | 'inspection' | 'simulasi';

interface CandidateProfile {
  id: string;
  name: string;
  nip: string;
  tenure: string;
  currentRole: string;
  readinessBadge: 'Ready Now' | 'Ready 1-2 Yrs' | 'Ready > 2 Yrs' | 'Under Observation';
  targetRole: string;
  compositeIndex: string;
  competencyReadiness: string;
  competencyGap: string;
  idp: string;
  avatarUrl: string;
}

interface QuadrantData {
  id: number;
  boxNumber: number;
  quadrantKey: string;
  name: string;
  employeeCount: number;
  badgeType: 'top' | 'standard' | 'risk';
  actionLabel: string;
  actionType: 'primary' | 'secondary' | 'danger';
  description: string;
  candidates: CandidateProfile[];
}

const QUADRANTS: QuadrantData[] = [
  {
    id: 7,
    boxNumber: 7,
    quadrantKey: 'ENIGMA',
    name: 'Enigma',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Role Re-alignment',
    actionType: 'secondary',
    description: 'Karyawan dengan potensi kepemimpinan tinggi namun kinerja saat ini belum optimal karena misalignment peran atau beban adaptasi.',
    candidates: [],
  },
  {
    id: 8,
    boxNumber: 8,
    quadrantKey: 'GROWTH_STAR',
    name: 'Growth Star',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Mentoring & Stretch',
    actionType: 'secondary',
    description: 'Talenta berkemampuan tinggi dengan kinerja stabil yang siap diasah melalui penugasan strategis dan rotasi lintas divisi.',
    candidates: [],
  },
  {
    id: 9,
    boxNumber: 9,
    quadrantKey: 'FUTURE_LEADER',
    name: 'Future Leader',
    employeeCount: 0,
    badgeType: 'top',
    actionLabel: 'Fast-Track Leadership',
    actionType: 'primary',
    description: 'Daftar suksesor tier-1 dengan performa tinggi & kapabilitas kepemimpinan strategis terverifikasi untuk jabatan struktural VP dan Director.',
    candidates: [],
  },
  {
    id: 4,
    boxNumber: 4,
    quadrantKey: 'DILEMMA',
    name: 'Dilemma',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Skill Upskilling',
    actionType: 'secondary',
    description: 'Karyawan dengan potensi sedang yang memerlukan reskilling kompetensi dasar agar dapat mencapai target output divisi.',
    candidates: [],
  },
  {
    id: 5,
    boxNumber: 5,
    quadrantKey: 'CORE_PLAYER',
    name: 'Core Player',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Lateral Enrichment',
    actionType: 'secondary',
    description: 'Tulang punggung operasional korporat dengan kinerja konsisten dan kontribusi berkelanjutan terhadap target divisi.',
    candidates: [],
  },
  {
    id: 6,
    boxNumber: 6,
    quadrantKey: 'HIGH_IMPACT',
    name: 'High Impact',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Retention & Incentives',
    actionType: 'secondary',
    description: 'Tenaga ahli spesialis berkinerja unggul yang memerlukan paket retensi, insentif jangka panjang, dan pengakuan performa.',
    candidates: [],
  },
  {
    id: 1,
    boxNumber: 1,
    quadrantKey: 'UNDERPERFORMER',
    name: 'Underperformer',
    employeeCount: 0,
    badgeType: 'risk',
    actionLabel: 'PIP Plan (60 Days)',
    actionType: 'danger',
    description: 'Karyawan di kuadran risiko yang membutuhkan intervensi mendesak Performance Improvement Plan (PIP) selama 60 hari kalender.',
    candidates: [],
  },
  {
    id: 2,
    boxNumber: 2,
    quadrantKey: 'EFFECTIVE_PRO',
    name: 'Effective Pro',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Skill Specialization',
    actionType: 'secondary',
    description: 'Pekerja operasional terampil dengan output kerja memenuhi target harian tanpa tuntutan kepemimpinan struktural.',
    candidates: [],
  },
  {
    id: 3,
    boxNumber: 3,
    quadrantKey: 'TRUSTED_PRO',
    name: 'Trusted Pro',
    employeeCount: 0,
    badgeType: 'standard',
    actionLabel: 'Key SME Retention',
    actionType: 'secondary',
    description: 'Subject Matter Expert (SME) dengan keandalan tinggi dan rekam jejak kerja bersih yang menjaga kelangsungan sistem vital perusahaan.',
    candidates: [],
  },
];

export default function NineBoxMatrixPage() {
  const [openFeature, setOpenFeature] = useState<NineboxFeature | null>(null);
  const [selectedBox, setSelectedBox] = useState<number>(9);
  const [activeDirectorate, setActiveDirectorate] = useState('Semua Direktorat (Holding)');
  const [activeDepartment, setActiveDepartment] = useState('Semua Departemen');
  const [isReloading, setIsReloading] = useState(false);
  const [reloadOk, setReloadOk] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; byQuadrant: Record<string, number> } | null>(null);

  // Task 8: jumlah per kuadran dari DB (bukan konstanta 1,240/42/180/12).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/performance/nine-box-summary');
        if (!res.ok) return;
        const json = await res.json();
        if (active) setSummary(json?.data ?? null);
      } catch {
        /* biarkan nilai demo bila API tidak tersedia */
      }
    })();
    return () => { active = false; };
  }, []);


  // Preferensi tampilan penjelasan. Default tampil; HRD berpengalaman bisa menyembunyikan.
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('epq:ninebox:showHelp') === 'false') setShowHelp(false);
    } catch {
      /* localStorage tidak tersedia */
    }
  }, []);

  const toggleHelp = () => {
    setShowHelp((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('epq:ninebox:showHelp', next ? 'true' : 'false');
      } catch {
        /* abaikan */
      }
      return next;
    });
  };

  const currentQuadrant = QUADRANTS.find((q) => q.boxNumber === selectedBox) || QUADRANTS[2];;

  /** Jumlah karyawan per kotak; "—" bila ringkasan belum dimuat (0 berarti kosong, beda arti). */
  const boxCount = (code: string): string => {
    if (!summary) return '—';
    return String(summary.byQuadrant?.[code] ?? 0);
  };

  /** Persentase kotak dari data nyata; "—" bila belum dimuat atau total nol. */
  const boxPercent = (code: string): string => {
    if (!summary || !summary.total) return '—';
    const n = summary.byQuadrant?.[code] ?? 0;
    const pct = (n / summary.total) * 100;
    return `${pct.toFixed(1).replace('.', ',')}%`;
  };


  // Ringkasan pemula: tiga kelompok kotak yang ditanyakan HRD.
  const sumBoxes = (codes: string[]) =>
    codes.reduce((acc, x) => acc + (summary?.byQuadrant?.[x] ?? 0), 0);
  const summaryPerhatian = sumBoxes(['UNDERPERFORMER', 'EFFECTIVE_PRO', 'TRUSTED_PRO']);
  const summaryPromosi = sumBoxes(['ENIGMA', 'GROWTH_STAR', 'FUTURE_LEADER']);
  const summaryDijaga = sumBoxes(['DILEMMA', 'CORE_PLAYER', 'HIGH_IMPACT']);

  const handleRunAi = async () => {
    setIsReloading(true);
    setReloadError(null);
    try {
      // Task 8: segarkan distribusi 9-Box dari DB (bukan simulasi setTimeout).
      const res = await fetch('/api/v1/performance/nine-box-summary');
      if (!res.ok) {
        setReloadError('Gagal memuat ulang data. Silakan coba lagi.');
        return;
      }
      const json = await res.json();
      setSummary(json?.data ?? null);
      setReloadOk(true);
      setTimeout(() => setReloadOk(false), 4000);
    } catch {
      /* no-op */
    } finally {
      setIsReloading(false);
    }
  };


  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb & GCG Tag */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
            <span className="font-semibold tracking-wider text-[#64748b]">GAMBARAN TALENTA & KADERISASI</span>
            <span>/</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
              GCG Compliant Cycle
            </span>
          </div>

          {/* Page Title */}
          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
            Matriks 9-Box: Hasil Kerja dan Kemampuan Naik Level
          </h1>
          <p className="text-xs text-[#64748b] mt-1 max-w-3xl">
            Pemetaan analitik suksesi manajerial, kesiapan talent pipeline 2026-2028, dan standardisasi intervensi human capital berbasis Good Corporate Governance.
          </p>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Directorate Filter */}
          <div className="relative">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-medium text-[#334155]">
              <Building2 className="w-3.5 h-3.5 text-[#64748b]" />
              <span>{activeDirectorate}</span>
            </span>
          </div>

          {/* Department Filter */}
          <div className="relative">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-medium text-[#334155]">
              <Filter className="w-3.5 h-3.5 text-[#64748b]" />
              <span>{activeDepartment}</span>
            </span>
          </div>

          {/* Period Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#64748b]" />
            <span>2026-Q3</span>
          </div>

          {/* Tampilkan / sembunyikan penjelasan untuk pemula */}
          <button
            type="button"
            onClick={toggleHelp}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]"
          >
            <span>{showHelp ? 'Sembunyikan penjelasan' : 'Tampilkan penjelasan'}</span>
          </button>

          {/* Muat ulang data 9-Box */}
          <button 
            onClick={handleRunAi}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#007a5a] text-white text-xs font-semibold shadow-xs hover:bg-[#00664b] transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Muat ulang data</span>
          </button>
        </div>
      </div>

      {/* Pemberitahuan muat ulang — di level halaman agar terlihat dari tombol mana pun */}
      {reloadError && (
        <div role="alert" className="p-3.5 rounded-xl bg-[#fce8e6] border border-[#f5c6c0] text-xs font-semibold text-[#c5221f] flex items-center justify-between shadow-xs animate-fadeIn">
          <span>{reloadError}</span>
          <button onClick={() => setReloadError(null)} className="font-bold underline text-[#c5221f]">
            Tutup
          </button>
        </div>
      )}
      {reloadOk && (
        <div role="status" className="p-3.5 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd] text-xs font-semibold text-[#137333] shadow-xs animate-fadeIn">
          Data 9-Box berhasil dimuat ulang.
        </div>
      )}

      {/* 2. Feature Card Grid (click to open) */}
      <FeatureGrid>
        <FeatureCard
          icon={Users}
          title="Distribusi Kinerja"
          metric={summary ? summary.total.toLocaleString('id-ID') : '—'}
          tag="100% Sensus"
          description="Sebaran populasi talenta pada kotak potensi-kinerja: Pemimpin Masa Depan, Penggerak Inti, dan Perlu Pembinaan."
          onOpen={() => setOpenFeature('distribusi')}
        />
        <FeatureCard
          icon={Grid3X3}
          title="Matriks 9-Box & Inspeksi"
          metric="3 × 3"
          tag="Talenta"
          description="Matriks visual 9 kuadran dengan panel inspeksi kandidat, analisis kesenjangan kompetensi, dan IDP."
          onOpen={() => setOpenFeature('inspection')}
        />
        <FeatureCard
          icon={ListOrdered}
          title="Kesiapan Suksesi"
          metric="Bench Strength"
          tag="Suksesi"
          description="Ringkasan kekuatan cadangan suksesi untuk posisi kritis dan Pencocokan Kaderisasi Otomatis."
          onOpen={() => setOpenFeature('simulasi')}
        />
      </FeatureGrid>

      {/* Ringkasan pemula — selalu terlihat, bukan di dalam panel yang harus dibuka */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#f5c6c0] p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#c5221f]">Perlu perhatian</span>
          <div data-testid="summary-perhatian" className="text-2xl font-black text-[#c5221f] mt-1">
            {summary ? `${summaryPerhatian} orang` : 'Data belum tersedia'}
          </div>
          <p className="text-[11px] text-[#64748b]">Kotak 1–3 · hasil kerja di bawah target</p>
        </div>

        <div className="bg-white rounded-xl border border-[#b7e1cd] p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333]">Siap naik level</span>
          <div data-testid="summary-promosi" className="text-2xl font-black text-[#137333] mt-1">
            {summary ? `${summaryPromosi} orang` : 'Data belum tersedia'}
          </div>
          <p className="text-[11px] text-[#64748b]">Kotak 7–9 · perlu dikembangkan dulu</p>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#334155]">Perlu dijaga</span>
          <div data-testid="summary-dijaga" className="text-2xl font-black text-[#0f172a] mt-1">
            {summary ? `${summaryDijaga} orang` : 'Data belum tersedia'}
          </div>
          <p className="text-[11px] text-[#64748b]">Kotak 4–6 · hasil kerja stabil</p>
        </div>
      </div>

      {/* Panel: Distribusi */}
      <ExpandablePanel open={openFeature === 'distribusi'} title="Distribusi Kinerja Talenta" onClose={() => setOpenFeature(null)}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Dinilai */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">TOTAL DINILAI</span>
            <div className="w-7 h-7 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#64748b]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#0f172a]">{summary ? summary.total.toLocaleString('id-ID') : 'Data belum tersedia'}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e6f4ea] text-[#137333]">
              100% Sensus
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Audit trail terverifikasi komite GCG</p>
        </div>

        {/* Metric 2: Future Leaders (Box 9) */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Pemimpin Masa Depan (Kotak 9)</span>
            <div className="w-7 h-7 rounded-full bg-[#dcfce7] flex items-center justify-center text-[#007a5a]">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#007a5a]">{summary ? (summary.byQuadrant?.FUTURE_LEADER ?? 0) : 'Data belum tersedia'}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#dcfce7] text-[#166534]">
              3.4% Populasi
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Calon kuat untuk posisi pimpinan puncak</p>
        </div>

        {/* Metric 3: Core Backbone (Box 5) */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Penggerak Inti (Kotak 5)</span>
            <div className="w-7 h-7 rounded-full bg-[#e0f2fe] flex items-center justify-center text-[#0284c7]">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#0f172a]">{summary ? (summary.byQuadrant?.CORE_PLAYER ?? 0) : 'Data belum tersedia'}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#475569]">
              14.5% Populasi
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Stabilitas performa operasional stabil</p>
        </div>

        {/* Metric 4: Underperformer (Box 1) */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Perlu Pembinaan (Kotak 1)</span>
            <div className="w-7 h-7 rounded-full bg-[#fee2e2] flex items-center justify-center text-[#dc2626]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#dc2626]">{summary ? (summary.byQuadrant?.UNDERPERFORMER ?? 0) : 'Data belum tersedia'}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#dc2626]">
              1.0% Mandat PIP
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Intervensi mitigasi risiko human capital</p>
        </div>

      </div>
        <AiAnalyzePanel feature="ninebox" />
      </ExpandablePanel>

      {/* Panel: Matriks 9-Box & Inspeksi */}
      <ExpandablePanel open={openFeature === 'inspection'} title="Matriks 9-Box & Panel Inspeksi" onClose={() => setOpenFeature(null)}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: 9-Box Matrix Grid (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-xs">
          
          {/* Header Row & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#f1f5f9]">
            <div>
              <h2 className="text-sm font-bold text-[#0f172a]">
                Distribusi 9-Box Talent Placement
              </h2>
              <p className="text-[11px] text-[#64748b] mt-0.5">
                Klik kuadran untuk menginspeksi rincian pegawai, readiness gap, dan aksi intervensi HR.
              </p>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-[#475569]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#007a5a]"></span>
                <span>Top Tier Successor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#94a3b8]"></span>
                <span>Standard Intervensi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#dc2626]"></span>
                <span>At Risk</span>
              </div>
            </div>
          </div>

          {/* Grid Layout with Y-Axis and X-Axis */}
          <div className="mt-4 flex">
            
            {/* Y-Axis Labeling — memakai bahasa sehari-hari, bukan istilah teknis */}
            <div className="w-12 flex-shrink-0 flex flex-col justify-between py-6 text-[10px] font-bold text-[#64748b] tracking-wider select-none pr-2 text-right">
              <div className="flex items-center justify-end gap-0.5 text-[#007a5a]">
                <span className="text-xs">↑</span>
                <span className="writing-vertical -rotate-90 origin-center translate-y-3 whitespace-nowrap">SIAP NAIK LEVEL</span>
              </div>
              <div className="flex items-center justify-end">
                <span className="writing-vertical -rotate-90 origin-center whitespace-nowrap">CUKUP SIAP</span>
              </div>
              <div className="flex items-center justify-end gap-0.5 text-[#dc2626]">
                <span className="text-xs">↓</span>
                <span className="writing-vertical -rotate-90 origin-center -translate-y-3 whitespace-nowrap">BELUM SIAP</span>
              </div>
            </div>

            {/* The 3x3 Grid */}
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-2.5">
                {QUADRANTS.map((quad) => {
                  const isSelected = selectedBox === quad.boxNumber;
                  const isBox9 = quad.boxNumber === 9;
                  const isBox1 = quad.boxNumber === 1;

                  return (
                    <div
                      key={quad.id}
                      onClick={() => setSelectedBox(quad.boxNumber)}
                      className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none min-h-[125px] flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#007a5a] ring-2 ring-[#007a5a]/20 bg-[#f8fdfa] shadow-xs'
                          : 'border-[#e2e8f0] bg-[#f8fafc]/60 hover:bg-white hover:border-[#cbd5e1]'
                      } ${isBox9 && !isSelected ? 'border-[#bbf7d0] bg-[#f0fdf4]' : ''} ${
                        isBox1 && !isSelected ? 'border-[#fecaca] bg-[#fff5f5]' : ''
                      }`}
                    >
                      {/* Top Row: Name & Percentage */}
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-xs font-bold ${
                          isBox9 ? 'text-[#007a5a]' : isBox1 ? 'text-[#dc2626]' : 'text-[#1e293b]'
                        }`}>
                          {nineBoxCopy(quad.quadrantKey).name}
                        </span>

{isBox9 ? (
                <span data-testid="box-percent" className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#007a5a] text-white">
                  {boxPercent(quad.quadrantKey)}
                </span>
              ) : isBox1 ? (
                <span data-testid="box-percent" className="text-[10px] font-bold text-[#dc2626]">
                  {boxPercent(quad.quadrantKey)}
                </span>
              ) : (
                <span data-testid="box-percent" className="text-[10px] font-medium text-[#64748b]">
                  {boxPercent(quad.quadrantKey)}
                </span>
              )}
                      </div>

                      {/* Middle: Count */}
                      <div className="my-1.5">
                        <span data-testid="box-count" className="text-xl font-black text-[#0f172a]">
                          {boxCount(quad.quadrantKey)}
                        </span>
                        <span className="text-[11px] text-[#64748b] ml-1">karyawan</span>
                      </div>

                      {/* Kalimat singkat untuk pemula — bisa disembunyikan */}
                      {showHelp && (
                        <p data-testid="quad-short" className="text-[10px] text-[#475569] leading-snug mb-1.5">
                          {nineBoxCopy(quad.quadrantKey).short}
                        </p>
                      )}

                      {/* Bottom Action Pill */}
                      <div>
                        {quad.actionType === 'primary' ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-[#007a5a] text-white shadow-xs">
                            <Award className="w-3 h-3 text-white" />
                            <span>{nineBoxCopy(quad.quadrantKey).shortAction}</span>
                          </div>
                        ) : quad.actionType === 'danger' ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-[#dc2626] text-white shadow-xs">
                            <AlertTriangle className="w-3 h-3 text-white" />
                            <span>{nineBoxCopy(quad.quadrantKey).shortAction}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#e2e8f0] text-[#475569]">
                            {quad.boxNumber === 7 && <RefreshCw className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 8 && <TrendingUp className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 4 && <Target className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 5 && <Shuffle className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 6 && <Award className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 2 && <Target className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 3 && <ShieldCheck className="w-2.5 h-2.5 text-[#64748b]" />}
                            <span>{nineBoxCopy(quad.quadrantKey).shortAction}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labeling */}
              <div className="grid grid-cols-3 gap-2.5 mt-3 text-center text-[10px] font-bold text-[#64748b] tracking-wider select-none">
                <div className="text-left text-[#dc2626] pl-1">
                  ← HASIL KERJA RENDAH
                </div>
                <div className="text-center text-[#64748b]">
                  HASIL KERJA SEDANG
                </div>
                <div className="text-right text-[#007a5a] pr-1">
                  HASIL KERJA TINGGI →
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Right Column: Inspection Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-xs flex flex-col justify-between min-h-[500px]">
          
          <div>
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                  RINCIAN KOTAK
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534]">
                  Kotak {selectedBox} dipilih
                </span>
              </div>
            </div>

            {/* Title & Description */}
            <div className="mt-3">
              <h3 className="text-sm font-extrabold text-[#0f172a]">
                {nineBoxCopy(currentQuadrant.quadrantKey).name} ({boxCount(currentQuadrant.quadrantKey)} karyawan)
              </h3>
              <p className="text-[11px] text-[#64748b] mt-0.5">
                {nineBoxCopy(currentQuadrant.quadrantKey).position}
              </p>
            </div>

            {/* Panduan untuk HRD pemula */}
            {showHelp && (
              <div className="mt-3 space-y-2.5">
                {/* Cara sistem menilai — penempatan otomatis, bukan penilaian manual */}
                <div className="p-3 rounded-xl bg-[#eff6ff] border border-[#bfdbfe]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d4ed8] mb-1">
                    Bagaimana kotak ini ditentukan
                  </p>
                  <p className="text-[11px] text-[#334155] leading-relaxed mb-2">
                    Kotak diisi <strong>otomatis oleh sistem</strong>, bukan dipilih oleh HRD. Sistem melihat dua hal
                    pada setiap karyawan, lalu menempatkannya ke salah satu dari sembilan kotak.
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-[#334155] leading-relaxed">
                    <li>
                      <strong>Hasil kerja</strong> — seberapa jauh target kerja tercapai. Dihitung dari nilai
                      kinerja keseluruhan karyawan.
                      <span className="block text-[10px] text-[#64748b]">
                        Rendah: di bawah 75 · Sedang: 75 sampai 89 · Tinggi: 90 ke atas
                      </span>
                    </li>
                    <li>
                      <strong>Kemampuan naik level</strong> — kesiapan memegang tanggung jawab yang lebih besar.
                      Dinilai oleh atasan pada skala 1 sampai 5.
                      <span className="block text-[10px] text-[#64748b]">
                        Rendah: di bawah 3 · Sedang: 3 sampai 3,9 · Tinggi: 4 ke atas
                      </span>
                    </li>
                  </ul>
                  <p className="mt-2 text-[10px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-2 py-1.5">
                    Bila kemampuan naik level belum pernah dinilai, sistem memakai nilai tengah (3,5). Karyawan itu
                    akan tampil di kolom <strong>sedang</strong> — bukan karena dinilai sedang, tetapi karena datanya
                    belum ada.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Sedang terjadi</p>
                  <p className="text-[11px] text-[#334155] leading-relaxed">
                    {nineBoxCopy(currentQuadrant.quadrantKey).happening}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#137333] mb-1">Langkah pertama</p>
                  <p className="text-[11px] text-[#334155] leading-relaxed">
                    {nineBoxCopy(currentQuadrant.quadrantKey).firstStep}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] mb-1">Yang perlu dicek dulu</p>
                  <p className="text-[11px] text-[#334155] leading-relaxed">
                    {nineBoxCopy(currentQuadrant.quadrantKey).checkFirst}
                  </p>
                </div>
              </div>
            )}

            {/* Candidate Cards List */}
            <div className="mt-4 space-y-3">
              {currentQuadrant.candidates.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc]/50 text-center">
                  <p className="text-[11px] text-[#64748b]">
                    Detail kandidat per kuadran belum tersedia. Skor 9-Box dihitung dari hasil penilaianrasi
                    penilaian kinerja; daftar kandidat akan tampil setelah penilaian tersimpan.
                  </p>
                </div>
              )}
              {currentQuadrant.candidates.map((cand) => (
                <div 
                  key={cand.id} 
                  className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/50 hover:bg-white hover:border-[#cbd5e1] hover:shadow-xs transition-all space-y-2.5"
                >
                  {/* Avatar & Top Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={cand.avatarUrl}
                        alt={cand.name}
                        className="w-9 h-9 rounded-full object-cover border border-[#e2e8f0] shadow-xs"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0f172a]">{cand.name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                            cand.readinessBadge === 'Ready Now'
                              ? 'bg-[#dcfce7] text-[#166534]'
                              : cand.readinessBadge === 'Ready 1-2 Yrs'
                              ? 'bg-[#e0f2fe] text-[#0369a1]'
                              : 'bg-[#fee2e2] text-[#dc2626]'
                          }`}>
                            {cand.readinessBadge}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#64748b]">
                          NIP: {cand.nip} • Masa Kerja: {cand.tenure}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Target Succession & Score */}
                  <div className="text-[11px] grid grid-cols-2 gap-2 pt-1 border-t border-[#f1f5f9]">
                    <div>
                      <span className="text-[#64748b] text-[10px] block">Target Jabatan Suksesi:</span>
                      <span className="font-bold text-[#1e293b] text-[11px]">{cand.targetRole}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#64748b] text-[10px] block">Composite Performance:</span>
                      <span className="font-bold text-[#007a5a] text-[11px]">{cand.compositeIndex}</span>
                    </div>
                  </div>

                  {/* Competency Gap Analysis */}
                  <div className="text-[11px] bg-white rounded-lg p-2 border border-[#f1f5f9]">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-[#64748b]">Kesiapan Kompetensi (Gap Analysis):</span>
                      <span className="font-bold text-[#0f172a]">{cand.competencyReadiness}</span>
                    </div>
                    <p className="text-[10px] text-[#b45309] font-medium">
                      Gap: {cand.competencyGap}
                    </p>
                  </div>

                  {/* IDP & Detail Link */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <div className="text-[10px] text-[#64748b]">
                      <span className="font-medium text-[#334155]">IDP:</span> {cand.idp}
                    </div>
                    <Link
                      href="/dashboard/employee-portal"
                      className="text-[10px] font-bold text-[#007a5a] hover:underline inline-flex items-center gap-0.5"
                    >
                      Detail Dossier <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Pencocokan Kaderisasi Otomatis Card (Bottom of panel) */}
          <div className="mt-4 pt-3 border-t border-[#f1f5f9]">
            <div className="bg-[#f1f5f9] rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-center text-[#007a5a] shadow-xs">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0f172a]">Pencocokan Kaderisasi Otomatis</h4>
                  <p className="text-[10px] text-[#64748b]">Mengikuti hasil penilaian yang tersimpan</p>
                </div>
              </div>
              <button
                onClick={handleRunAi}
                disabled={isReloading}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] hover:bg-[#f8fafc] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isReloading ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-[#007a5a]" />
                    <span>Memetakan...</span>
                  </>
                ) : (
                  <>
                    <span>Muat ulang data</span>
                  </>
                )}
              </button>
            </div>
            {reloadError && (
              <p role="alert" className="text-[10px] text-[#c5221f] font-semibold bg-[#fce8e6] rounded-md px-2 py-1 mt-2 text-center">
                {reloadError}
              </p>
            )}
            {reloadOk && (
              <p className="text-[10px] text-[#166534] font-semibold bg-[#dcfce7] rounded-md px-2 py-1 mt-2 text-center animate-fade-in">
                Data 9-Box berhasil dimuat ulang.
              </p>
            )}
          </div>

        </div>

      </div>
        <AiAnalyzePanel feature="ninebox" />
      </ExpandablePanel>

      {/* Panel: Kesiapan Suksesi (Bench Strength Table) */}
      <ExpandablePanel open={openFeature === 'simulasi'} title="Kesiapan Suksesi" onClose={() => setOpenFeature(null)}>
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs space-y-4">
        
        {/* Table Title & Target note */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              Succession Bench Strength Summary
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Kesiapan suksesi posisi kunci organ perusahaan sesuai regulasi Kementerian BUMN / OJK GCG.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-[#007a5a] bg-[#e6f4ea] px-3 py-1 rounded-md">
            Target Coverage: &gt; 2 Ready Successors per Key Position
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">POSISI KUNCI</th>
                <th className="py-3 px-4">PEMEGANG SAAT INI</th>
                <th className="py-3 px-4">PERKIRAAN PENSIUN</th>
                <th className="py-3 px-4">CALON PENGGANTI (SIAP SEKARANG)</th>
                <th className="py-3 px-4">CALON PENGGANTI (SIAP 1-2 TAHUN)</th>
                <th className="py-3 px-4 text-center">STATUS KETERSEDIAAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              
              {/* Row 1: CTO */}
              <tr className="hover:bg-[#f8fafc] transition-colors">
                <td className="py-3.5 px-4 font-bold text-[#0f172a]">
                  Chief Technology Officer (CTO)
                </td>
                <td className="py-3.5 px-4 text-[#334155]">
                  Ir. Hendra Wijaya (Pensiun 2027)
                </td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#475569] font-medium text-[11px]">
                    &lt; 14 Bulan
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-semibold text-[#007a5a]">
                    <span className="w-2 h-2 rounded-full bg-[#007a5a]"></span>
                    <span>Budi Pratama</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-[#475569]">
                  Dimas Prasetyo, Kevin Wardhana
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#dcfce7] text-[#166534]">
                    Robust (3:1)
                  </span>
                </td>

              </tr>

              {/* Row 2: VP Enterprise Commercial */}
              <tr className="hover:bg-[#f8fafc] transition-colors">
                <td className="py-3.5 px-4 font-bold text-[#0f172a]">
                  VP of Enterprise Commercial
                </td>
                <td className="py-3.5 px-4 text-[#334155]">
                  Raden Mas Aditya
                </td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#475569] font-medium text-[11px]">
                    24 Bulan
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-semibold text-[#007a5a]">
                    <span className="w-2 h-2 rounded-full bg-[#007a5a]"></span>
                    <span>Siti Rahmawati</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-[#475569]">
                  Amanda Kusumo, Reza Fauzi
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e0f2fe] text-[#0369a1]">
                    Adequate (3:1)
                  </span>
                </td>

              </tr>

              {/* Row 3: Head of Internal Audit & Risk */}
              <tr className="hover:bg-[#fff5f5] transition-colors">
                <td className="py-3.5 px-4 font-bold text-[#0f172a]">
                  Head of Internal Audit &amp; Risk
                </td>
                <td className="py-3.5 px-4 text-[#334155]">
                  Dewi Lestari, Ak., CA
                </td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#dc2626] font-bold text-[11px]">
                    &lt; 6 Bulan
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 font-bold text-[#dc2626]">
                    <span className="w-2 h-2 rounded-full bg-[#dc2626]"></span>
                    <span>Belum Ada (Gap Suksesi)</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-[#475569]">
                  Farhan Hakim (Readiness 72%)
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fee2e2] text-[#dc2626]">
                    Vulnerable (0:1)
                  </span>
                </td>

              </tr>

            </tbody>
          </table>
        </div>

      </div>
        <AiAnalyzePanel feature="ninebox" />
      </ExpandablePanel>


    </div>
  );
}
