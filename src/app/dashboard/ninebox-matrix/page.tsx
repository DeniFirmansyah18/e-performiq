'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Filter,
  Calendar,
  Download,
  Users,
  Target,
  Network,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  MoreHorizontal,
  Cpu,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Shuffle,
  Award,
  Plus,
  Compass,
} from 'lucide-react';

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
  name: string;
  populationPct: string;
  employeeCount: number;
  badgeType: 'top' | 'standard' | 'risk';
  actionLabel: string;
  actionType: 'primary' | 'secondary' | 'danger';
  description: string;
  candidates: CandidateProfile[];
}

const QUADRANTS: QuadrantData[] = [
  // Row 1 (Potensi Tinggi)
  {
    id: 7,
    boxNumber: 7,
    name: 'Enigma',
    populationPct: '0.6%',
    employeeCount: 8,
    badgeType: 'standard',
    actionLabel: 'Role Re-alignment',
    actionType: 'secondary',
    description: 'Karyawan dengan potensi kepemimpinan tinggi namun kinerja saat ini belum optimal karena misalignment peran atau beban adaptasi.',
    candidates: [
      {
        id: 'c-enigma-1',
        name: 'Aris Munandar, S.T.',
        nip: '91203411',
        tenure: '2 Thn',
        currentRole: 'Backend Security Engineer',
        readinessBadge: 'Ready 1-2 Yrs',
        targetRole: 'Lead Security Operations',
        compositeIndex: '3.45 / 5.00',
        competencyReadiness: '82%',
        competencyGap: 'Cloud DevSecOps Automation',
        idp: 'DevSecOps Specialist Immersion',
        avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 8,
    boxNumber: 8,
    name: 'Growth Star',
    populationPct: '2.7%',
    employeeCount: 34,
    badgeType: 'standard',
    actionLabel: 'Mentoring & Stretch',
    actionType: 'secondary',
    description: 'Talenta berkemampuan tinggi dengan kinerja stabil yang siap diasah melalui penugasan strategis dan rotasi lintas divisi.',
    candidates: [
      {
        id: 'c-growth-1',
        name: 'Farhan Hakim, M.M.',
        nip: '89104523',
        tenure: '5 Thn',
        currentRole: 'Senior Risk Governance Specialist',
        readinessBadge: 'Ready 1-2 Yrs',
        targetRole: 'Head of Risk & Governance',
        compositeIndex: '4.20 / 5.00',
        competencyReadiness: '86%',
        competencyGap: 'Regulatory FinTech Compliance',
        idp: 'Executive Risk Certification Series',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 9,
    boxNumber: 9,
    name: 'Future Leader',
    populationPct: 'Top 3.4%',
    employeeCount: 42,
    badgeType: 'top',
    actionLabel: 'Fast-Track Leadership',
    actionType: 'primary',
    description: 'Daftar suksesor tier-1 dengan performa tinggi & kapabilitas kepemimpinan strategis terverifikasi untuk jabatan struktural VP dan Director.',
    candidates: [
      {
        id: 'c-fl-1',
        name: 'Budi Pratama',
        nip: '89201942',
        tenure: '6 Thn',
        currentRole: 'Lead Enterprise Solutions Architecture',
        readinessBadge: 'Ready Now',
        targetRole: 'VP of Enterprise Architecture',
        compositeIndex: '4.88 / 5.00',
        competencyReadiness: '94%',
        competencyGap: 'Strategic Budgeting',
        idp: 'Executive Mentoring Series',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
      {
        id: 'c-fl-2',
        name: 'Siti Rahmawati',
        nip: '87192081',
        tenure: '8 Thn',
        currentRole: 'Head of Commercial Product Strategy',
        readinessBadge: 'Ready 1-2 Yrs',
        targetRole: 'Director of Commercial & Strategy',
        compositeIndex: '4.75 / 5.00',
        competencyReadiness: '88%',
        competencyGap: 'Cross-Border M&A',
        idp: 'Global Leadership Immersion',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },

  // Row 2 (Potensi Sedang)
  {
    id: 4,
    boxNumber: 4,
    name: 'Dilemma',
    populationPct: '1.1%',
    employeeCount: 14,
    badgeType: 'standard',
    actionLabel: 'Skill Upskilling',
    actionType: 'secondary',
    description: 'Karyawan dengan potensi sedang yang memerlukan reskilling kompetensi dasar agar dapat mencapai target output divisi.',
    candidates: [
      {
        id: 'c-dil-1',
        name: 'Eko Prasetyo, S.Kom.',
        nip: '92109482',
        tenure: '3 Thn',
        currentRole: 'Junior IT Support Lead',
        readinessBadge: 'Ready > 2 Yrs',
        targetRole: 'IT Systems Administrator',
        compositeIndex: '3.12 / 5.00',
        competencyReadiness: '71%',
        competencyGap: 'Linux Kernel Management',
        idp: 'Core Infrastructure Boot Camp',
        avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 5,
    boxNumber: 5,
    name: 'Core Player',
    populationPct: '14.5%',
    employeeCount: 180,
    badgeType: 'standard',
    actionLabel: 'Lateral Enrichment',
    actionType: 'secondary',
    description: 'Tulang punggung operasional korporat dengan kinerja konsisten dan kontribusi berkelanjutan terhadap target divisi.',
    candidates: [
      {
        id: 'c-core-1',
        name: 'Dian Safitri, S.T.',
        nip: '88201944',
        tenure: '5 Thn',
        currentRole: 'QA Engineering Lead',
        readinessBadge: 'Ready 1-2 Yrs',
        targetRole: 'Manager of Quality Assurance',
        compositeIndex: '3.88 / 5.00',
        competencyReadiness: '84%',
        competencyGap: 'Automated Load Testing Strategy',
        idp: 'Enterprise QA Governance Program',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 6,
    boxNumber: 6,
    name: 'High Impact',
    populationPct: '7.6%',
    employeeCount: 95,
    badgeType: 'standard',
    actionLabel: 'Retention & Incentives',
    actionType: 'secondary',
    description: 'Tenaga ahli spesialis berkinerja unggul yang memerlukan paket retensi, insentif jangka panjang, dan pengakuan performa.',
    candidates: [
      {
        id: 'c-hi-1',
        name: 'Agus Setiawan, S.Si.',
        nip: '87103941',
        tenure: '7 Thn',
        currentRole: 'Principal Database Administrator',
        readinessBadge: 'Ready Now',
        targetRole: 'VP of Data Infrastructure',
        compositeIndex: '4.55 / 5.00',
        competencyReadiness: '91%',
        competencyGap: 'Cloud Data Warehouse Cost Optimization',
        idp: 'Strategic FinOps Accreditation',
        avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },

  // Row 3 (Potensi Rendah)
  {
    id: 1,
    boxNumber: 1,
    name: 'Underperformer',
    populationPct: '1.0%',
    employeeCount: 12,
    badgeType: 'risk',
    actionLabel: 'PIP Plan (60 Days)',
    actionType: 'danger',
    description: 'Karyawan di kuadran risiko yang membutuhkan intervensi mendesak Performance Improvement Plan (PIP) selama 60 hari kalender.',
    candidates: [
      {
        id: 'c-risk-1',
        name: 'Andika Wijaya',
        nip: '93108422',
        tenure: '1.5 Thn',
        currentRole: 'Operations Infrastructure Specialist',
        readinessBadge: 'Under Observation',
        targetRole: 'N/A (Evaluation in Progress)',
        compositeIndex: '2.40 / 5.00',
        competencyReadiness: '52%',
        competencyGap: 'SLA Resolusi Insiden Data Center',
        idp: 'Mandatory 60-Day SLA Recovery Mentorship',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 2,
    boxNumber: 2,
    name: 'Effective Pro',
    populationPct: '7.1%',
    employeeCount: 88,
    badgeType: 'standard',
    actionLabel: 'Skill Specialization',
    actionType: 'secondary',
    description: 'Pekerja operasional terampil dengan output kerja memenuhi target harian tanpa tuntutan kepemimpinan struktural.',
    candidates: [
      {
        id: 'c-eff-1',
        name: 'Rian Kurnia, A.Md.',
        nip: '90102938',
        tenure: '4 Thn',
        currentRole: 'Network Cabling Specialist',
        readinessBadge: 'Ready > 2 Yrs',
        targetRole: 'Senior Datacenter Technician',
        compositeIndex: '3.35 / 5.00',
        competencyReadiness: '79%',
        competencyGap: 'Optical Fiber Splicing Certification',
        idp: 'Structured Cabling Masterclass',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    id: 3,
    boxNumber: 3,
    name: 'Trusted Pro',
    populationPct: '4.2%',
    employeeCount: 52,
    badgeType: 'standard',
    actionLabel: 'Key SME Retention',
    actionType: 'secondary',
    description: 'Subject Matter Expert (SME) dengan keandalan tinggi dan rekam jejak kerja bersih yang menjaga kelangsungan sistem vital perusahaan.',
    candidates: [
      {
        id: 'c-trust-1',
        name: 'Haryanto Sudirman, S.T.',
        nip: '86102940',
        tenure: '9 Thn',
        currentRole: 'Core Banking Architect Specialist',
        readinessBadge: 'Ready Now',
        targetRole: 'Chief Specialist Core Systems',
        compositeIndex: '4.60 / 5.00',
        competencyReadiness: '95%',
        competencyGap: 'High-Level Strategic Succession',
        idp: 'Knowledge Preservation & Legacy Transfer',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      },
    ],
  },
];

export default function NineBoxMatrixPage() {
  const [selectedBox, setSelectedBox] = useState<number>(9);
  const [activeDirectorate, setActiveDirectorate] = useState('Semua Direktorat (Holding)');
  const [activeDepartment, setActiveDepartment] = useState('Semua Departemen');
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState(false);

  const currentQuadrant = QUADRANTS.find((q) => q.boxNumber === selectedBox) || QUADRANTS[2];

  const handleRunAi = () => {
    setIsAiRunning(true);
    setTimeout(() => {
      setIsAiRunning(false);
      setAiSuccessMsg(true);
      setTimeout(() => setAiSuccessMsg(false), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb & GCG Tag */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
            <span className="font-semibold tracking-wider text-[#64748b]">TALENT INTELLIGENCE & SUCCESSION</span>
            <span>/</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
              GCG Compliant Cycle
            </span>
          </div>

          {/* Page Title */}
          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
            9-Box Potential vs Performance Matrix
          </h1>
          <p className="text-xs text-[#64748b] mt-1 max-w-3xl">
            Pemetaan analitik suksesi manajerial, kesiapan talent pipeline 2026-2028, dan standardisasi intervensi human capital berbasis Good Corporate Governance.
          </p>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Directorate Dropdown */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <Building2 className="w-3.5 h-3.5 text-[#64748b]" />
              <span>{activeDirectorate}</span>
              <ChevronDown className="w-3 h-3 text-[#94a3b8]" />
            </button>
          </div>

          {/* Department Dropdown */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <Filter className="w-3.5 h-3.5 text-[#64748b]" />
              <span>{activeDepartment}</span>
              <ChevronDown className="w-3 h-3 text-[#94a3b8]" />
            </button>
          </div>

          {/* Period Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#64748b]" />
            <span>2026-Q3</span>
          </div>

          {/* Download Matrix PDF */}
          <button 
            onClick={() => alert('Mengunduh Laporan Matriks 9-Box & Talent Readiness 2026-Q3 (PDF Resmi Direksi)...')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]"
          >
            <Download className="w-3.5 h-3.5 text-[#64748b]" />
            <span>Download Matriks PDF</span>
          </button>

          {/* Simulasi Talent Pool Suksesi */}
          <button 
            onClick={handleRunAi}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#007a5a] text-white text-xs font-semibold shadow-xs hover:bg-[#00664b] transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Simulasi Talent Pool Suksesi</span>
          </button>
        </div>
      </div>

      {/* 2. Four Summary Metrics */}
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
            <span className="text-2xl font-black text-[#0f172a]">1,240</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e6f4ea] text-[#137333]">
              100% Sensus
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Audit trail terverifikasi komite GCG</p>
        </div>

        {/* Metric 2: Future Leaders (Box 9) */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">FUTURE LEADERS (BOX 9)</span>
            <div className="w-7 h-7 rounded-full bg-[#dcfce7] flex items-center justify-center text-[#007a5a]">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#007a5a]">42</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#dcfce7] text-[#166534]">
              3.4% Populasi
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Kandidat VP & Director succession bench</p>
        </div>

        {/* Metric 3: Core Backbone (Box 5) */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">CORE BACKBONE (BOX 5)</span>
            <div className="w-7 h-7 rounded-full bg-[#e0f2fe] flex items-center justify-center text-[#0284c7]">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#0f172a]">180</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#475569]">
              14.5% Populasi
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Stabilitas performa operasional stabil</p>
        </div>

        {/* Metric 4: Underperformer (Box 1) */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">UNDERPERFORMER (BOX 1)</span>
            <div className="w-7 h-7 rounded-full bg-[#fee2e2] flex items-center justify-center text-[#dc2626]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-[#dc2626]">12</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#dc2626]">
              1.0% Mandat PIP
            </span>
          </div>
          <p className="text-[11px] text-[#64748b]">Intervensi mitigasi risiko human capital</p>
        </div>

      </div>

      {/* 3. Middle Section: Two Columns (9-Box Grid & Inspection Panel) */}
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
            
            {/* Y-Axis Labeling */}
            <div className="w-12 flex-shrink-0 flex flex-col justify-between py-6 text-[10px] font-bold text-[#64748b] tracking-wider select-none pr-2 text-right">
              <div className="flex items-center justify-end gap-0.5 text-[#007a5a]">
                <span className="text-xs">↑</span>
                <span className="writing-vertical -rotate-90 origin-center translate-y-3 whitespace-nowrap">POTENSI TINGGI</span>
              </div>
              <div className="flex items-center justify-end">
                <span className="writing-vertical -rotate-90 origin-center whitespace-nowrap">POTENSI SEDANG</span>
              </div>
              <div className="flex items-center justify-end gap-0.5 text-[#dc2626]">
                <span className="text-xs">↓</span>
                <span className="writing-vertical -rotate-90 origin-center -translate-y-3 whitespace-nowrap">POTENSI RENDAH</span>
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
                          {quad.name}
                        </span>

                        {isBox9 ? (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#007a5a] text-white">
                            {quad.populationPct}
                          </span>
                        ) : isBox1 ? (
                          <span className="text-[10px] font-bold text-[#dc2626]">
                            {quad.populationPct}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[#64748b]">
                            {quad.populationPct}
                          </span>
                        )}
                      </div>

                      {/* Middle: Count */}
                      <div className="my-1.5">
                        <span className="text-xl font-black text-[#0f172a]">
                          {quad.employeeCount}
                        </span>
                        <span className="text-[11px] text-[#64748b] ml-1">karyawan</span>
                      </div>

                      {/* Bottom Action Pill */}
                      <div>
                        {quad.actionType === 'primary' ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-[#007a5a] text-white shadow-xs">
                            <Sparkles className="w-3 h-3 text-white" />
                            <span>{quad.actionLabel}</span>
                          </div>
                        ) : quad.actionType === 'danger' ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-[#dc2626] text-white shadow-xs">
                            <AlertTriangle className="w-3 h-3 text-white" />
                            <span>{quad.actionLabel}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#e2e8f0] text-[#475569]">
                            {quad.boxNumber === 7 && <RefreshCw className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 8 && <Sparkles className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 4 && <Target className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 5 && <Shuffle className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 6 && <Award className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 2 && <Target className="w-2.5 h-2.5 text-[#64748b]" />}
                            {quad.boxNumber === 3 && <ShieldCheck className="w-2.5 h-2.5 text-[#64748b]" />}
                            <span>{quad.actionLabel}</span>
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
                  ← KINERJA RENDAH
                </div>
                <div className="text-center text-[#64748b]">
                  KINERJA SEDANG
                </div>
                <div className="text-right text-[#007a5a] pr-1">
                  KINERJA TINGGI →
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
                  PANEL INSPEKSI
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534]">
                  Box {selectedBox} Selected
                </span>
              </div>
              <button 
                title="Buka detail kuadran lengkap"
                onClick={() => alert(`Membuka audit dossier lengkap seluruh talent di Box ${selectedBox} (${currentQuadrant.name}).`)}
                className="text-[#94a3b8] hover:text-[#0f172a] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Description */}
            <div className="mt-3">
              <h3 className="text-sm font-extrabold text-[#0f172a]">
                {currentQuadrant.name} (Top {currentQuadrant.employeeCount})
              </h3>
              <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">
                {currentQuadrant.description}
              </p>
            </div>

            {/* Candidate Cards List */}
            <div className="mt-4 space-y-3">
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

          {/* AI Succession Matcher Card (Bottom of panel) */}
          <div className="mt-4 pt-3 border-t border-[#f1f5f9]">
            <div className="bg-[#f1f5f9] rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-center text-[#007a5a] shadow-xs">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0f172a]">AI Succession Matcher</h4>
                  <p className="text-[10px] text-[#64748b]">Simulasi 12 kursi C-Suite kosong</p>
                </div>
              </div>
              <button
                onClick={handleRunAi}
                disabled={isAiRunning}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-xs font-semibold text-[#0f172a] hover:bg-[#f8fafc] shadow-xs transition-all flex items-center gap-1.5"
              >
                {isAiRunning ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-[#007a5a]" />
                    <span>Matching...</span>
                  </>
                ) : (
                  <>
                    <span>Run AI</span>
                  </>
                )}
              </button>
            </div>
            {aiSuccessMsg && (
              <p className="text-[10px] text-[#166534] font-semibold bg-[#dcfce7] rounded-md px-2 py-1 mt-2 text-center animate-fade-in">
                ✓ Simulasi selesai: 12 kursi terpetakan dengan rasio koverasi suksesi 3.2 : 1!
              </p>
            )}
          </div>

        </div>

      </div>

      {/* 4. Bottom Table: Succession Bench Strength Summary */}
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
                <th className="py-3 px-4">POSISI KUNCI (KEY ROLE)</th>
                <th className="py-3 px-4">INCUMBENT SAAT INI</th>
                <th className="py-3 px-4">RETIREMENT HORIZON</th>
                <th className="py-3 px-4">BENCH POOL (READY NOW)</th>
                <th className="py-3 px-4">BENCH POOL (READY 1-2 Y)</th>
                <th className="py-3 px-4 text-center">COVERAGE STATUS</th>
                <th className="py-3 px-4 text-right">OPSI TATA KELOLA</th>
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
                <td className="py-3.5 px-4 text-right">
                  <button 
                    onClick={() => alert('Opsi Tata Kelola CTO: Penjadwalan Wawancara Komite Remunerasi & Nominasi (KRN).')}
                    className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b] transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
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
                <td className="py-3.5 px-4 text-right">
                  <button 
                    onClick={() => alert('Opsi Tata Kelola VP Commercial: Rotasi penugasan ke unit bisnis strategis.')}
                    className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b] transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
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
                <td className="py-3.5 px-4 text-right">
                  <button 
                    onClick={() => alert('Opsi Tata Kelola Head Audit: Akselerasi Executive Mentoring Farhan Hakim atau rekrutmen pro-hire eksternal.')}
                    className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b] transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>

            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
