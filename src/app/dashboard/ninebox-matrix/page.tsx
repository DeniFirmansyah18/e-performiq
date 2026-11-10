'use client';

import { createPortal } from 'react-dom';
import { nineBoxCopy } from '@/lib/employee/nineBoxLabels';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
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
  readinessBadge: ReadinessLevel;
  targetRole: string;
  compositeIndex: string;
  competencyReadiness: string;
  competencyGap: string;
  idp: string;
  avatarUrl: string;
}

/** Tingkat kesiapan seorang kandidat untuk naik ke posisi berikutnya. */
export type ReadinessLevel = 'SIAP_SEKARANG' | 'SIAP_1_2_TAHUN' | 'SIAP_LEBIH_2_TAHUN' | 'PERLU_PEMANTAUAN';

/** Label yang ditampilkan ke pengguna (bahasa Indonesia). */
const READINESS_LABEL: Record<ReadinessLevel, string> = {
  SIAP_SEKARANG: 'Siap sekarang',
  SIAP_1_2_TAHUN: 'Siap 1–2 tahun lagi',
  SIAP_LEBIH_2_TAHUN: 'Siap lebih dari 2 tahun',
  PERLU_PEMANTAUAN: 'Perlu dipantau',
};

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
  // Halaman daftar pegawai pada panel inspeksi (5 per halaman).
  const [halamanPegawai, setHalamanPegawai] = useState(1);
  const [activeDirectorate, setActiveDirectorate] = useState('Semua Direktorat (Holding)');
  const [activeDepartment, setActiveDepartment] = useState('Semua Departemen');
  const [isReloading, setIsReloading] = useState(false);
  const [reloadOk, setReloadOk] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; byQuadrant: Record<string, number>; talent_quadrants?: any[] } | null>(null);

  // Pegawai per kuadran dari API — dipakai panel inspeksi (data nyata, bukan contoh).
  const [pegawaiPerKotak, setPegawaiPerKotak] = useState<Record<string, any[]>>({});

/** Mengubah respons API menjadi peta "kode kuadran" -> daftar pegawai. */
  const petakanPegawai = (data: any) => {
    const peta: Record<string, any[]> = {};
    const daftar: any[] = Array.isArray(data?.talent_quadrants) ? data.talent_quadrants : [];
    for (const q of daftar) {
      if (q && typeof q.quadrant === 'string' && Array.isArray(q.employees)) {
        peta[q.quadrant] = q.employees;
      }
    }
    return peta;
  };

  // Task 8: jumlah per kuadran dari DB (bukan konstanta 1,240/42/180/12).
  useEffect(() => {
    let active = true;
    // Daftar pegawai per kotak hanya ada di endpoint distribusi (bukan summary).
    (async () => {
      try {
        const res = await fetch('/api/v1/analytics/nine-box-distribution');
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (active) setPegawaiPerKotak(petakanPegawai(json?.data));
      } catch {
        /* panel tetap menampilkan keadaan kosong bila API tidak tersedia */
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/v1/performance/nine-box-summary');
        if (!res.ok) return;
        const json = await res.json();
        // Hanya ringkasan angka; daftar pegawai berasal dari endpoint distribusi
        // di atas agar tidak tertimpa peta kosong.
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

  const currentQuadrant = QUADRANTS.find((q) => q.boxNumber === selectedBox) || QUADRANTS[2];

  /** Daftar pegawai nyata untuk kotak yang sedang dipilih. */
  const pegawaiKotakIni: any[] = pegawaiPerKotak[currentQuadrant.quadrantKey] ?? [];

  // Paginasi daftar pegawai: 5 per halaman, nomor halaman maksimal 5.
  const UKURAN_HALAMAN_PEGAWAI = 5;
  const totalHalamanPegawai = Math.max(1, Math.ceil(pegawaiKotakIni.length / UKURAN_HALAMAN_PEGAWAI));
  const halamanPegawaiAman = Math.min(halamanPegawai, totalHalamanPegawai);
  const pegawaiTampil = pegawaiKotakIni.slice(
    (halamanPegawaiAman - 1) * UKURAN_HALAMAN_PEGAWAI,
    halamanPegawaiAman * UKURAN_HALAMAN_PEGAWAI
  );
  const jendelaPegawai = 5;
  const mulaiNomorPegawai = Math.max(
    1,
    Math.min(halamanPegawaiAman - Math.floor(jendelaPegawai / 2), totalHalamanPegawai - jendelaPegawai + 1)
  );
  const nomorPegawai = Array.from(
    { length: Math.min(jendelaPegawai, totalHalamanPegawai) },
    (_, i) => mulaiNomorPegawai + i
  );

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
          <Link
            href="/dashboard/hr-command"
            className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke HR Command Center
          </Link>
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
          title="Calon Pengganti Posisi Kunci"
          metric="Kesiapan"
          tag="Suksesi"
          description="Melihat siapa yang siap menggantikan pejabat pada posisi kunci bila berhenti atau pensiun."
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
                Klik kuadran untuk menginspeksi rincian pegawai, kesenjangan kesiapan, dan aksi intervensi HR.
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
                      onClick={() => {
                        setSelectedBox(quad.boxNumber);
                        // Kotak lain punya daftar berbeda: mulai dari halaman 1.
                        setHalamanPegawai(1);
                      }}
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

            {/* Daftar pegawai nyata pada kotak terpilih (dari API 9-Box) */}
            <div className="mt-4 space-y-3">
              {pegawaiKotakIni.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc]/50 text-center">
                  <p className="text-[11px] text-[#64748b]">
                    {summary ? 'Belum ada karyawan di kotak ini.' : 'Memuat data karyawan…'}
                  </p>
                </div>
              )}

              {pegawaiTampil.map((p) => (
                <div
                  key={String(p.employee_id)}
                  className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/50 hover:bg-white hover:border-[#cbd5e1] hover:shadow-xs transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">{p.full_name}</p>
                      <p className="text-[10px] text-[#64748b]">
                        NIP: {p.employee_code ?? '—'}
                        {p.position ? ` • ${p.position}` : ''}
                      </p>
                      {p.department && (
                        <p className="text-[10px] text-[#64748b]">{p.department}</p>
                      )}
                    </div>
                    {p.performance_rating && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333]">
                        Peringkat {p.performance_rating}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] flex items-center justify-between pt-2 border-t border-[#f1f5f9]">
                    <span className="text-[#64748b] text-[10px]">Nilai kinerja keseluruhan</span>
                    <span className="font-bold text-[#007a5a]">
                      {typeof p.composite_gpa === 'number' ? p.composite_gpa.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              ))}

              {/* Navigasi halaman daftar pegawai: nomor maksimal 5. */}
              {totalHalamanPegawai > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#64748b]">
                  <span>
                    Menampilkan {(halamanPegawaiAman - 1) * UKURAN_HALAMAN_PEGAWAI + 1}–
                    {Math.min(halamanPegawaiAman * UKURAN_HALAMAN_PEGAWAI, pegawaiKotakIni.length)} dari{' '}
                    {pegawaiKotakIni.length} pegawai
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHalamanPegawai(halamanPegawaiAman - 1)}
                      disabled={halamanPegawaiAman <= 1}
                      aria-label="Halaman pegawai sebelumnya"
                      className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
                    >
                      Sebelumnya
                    </button>
                    {nomorPegawai.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setHalamanPegawai(n)}
                        aria-label={`Halaman pegawai ${n}`}
                        aria-current={n === halamanPegawaiAman ? 'page' : undefined}
                        className={`min-w-[26px] h-[26px] rounded-lg border text-[11px] font-semibold transition-colors ${
                          n === halamanPegawaiAman
                            ? 'bg-[#007a5a] border-[#007a5a] text-white'
                            : 'bg-white border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setHalamanPegawai(halamanPegawaiAman + 1)}
                      disabled={halamanPegawaiAman >= totalHalamanPegawai}
                      aria-label="Halaman pegawai berikutnya"
                      className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
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
      {/* Panel: Calon Pengganti Posisi Kunci */}
      <ExpandablePanel open={openFeature === 'simulasi'} title="Calon Pengganti Posisi Kunci" onClose={() => setOpenFeature(null)}>
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-xs space-y-4">

        <div>
          <h3 className="text-sm font-bold text-[#0f172a]">Ringkasan Kesiapan Pengganti</h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Menunjukkan siapa yang siap menggantikan pejabat pada posisi kunci bila yang bersangkutan
            berhenti atau pensiun.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#334155]">
          <span className="font-semibold text-[#007a5a] bg-[#e6f4ea] px-3 py-1 rounded-md">
            Target: minimal 2 calon siap untuk setiap posisi kunci
          </span>
        </div>

        {/* Keadaan kosong yang jujur: fitur belum terhubung ke data kepegawaian. */}
        <div
          role="status"
          className="p-4 rounded-xl bg-[#f8fafc] border border-dashed border-[#cbd5e1] text-center space-y-1.5"
        >
          <p className="text-xs font-bold text-[#334155]">Data belum terhubung ke database</p>
          <p className="text-[11px] text-[#64748b] leading-relaxed max-w-2xl mx-auto">
            Daftar calon pengganti belum tersedia karena data posisi kunci, perkiraan pensiun, dan
            kesiapan kader belum diisi. Setelah data itu tersedia, tabel akan menampilkan posisi kunci,
            pemegang saat ini, perkiraan pensiun, calon pengganti yang siap sekarang, calon yang siap
            1–2 tahun lagi, serta status ketersediaannya.
          </p>
        </div>

      </div>
        <AiAnalyzePanel feature="ninebox" />
      </ExpandablePanel>


    </div>
  );
}
