'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Building,
  Users,
  RotateCcw,
  AlertTriangle,
  Printer,
  Download,
  Calendar,
  ChevronDown,
  GraduationCap,
  Scale,
  UserCheck,
  Lightbulb,
  ArrowRight,
  Grid3X3,
  Lock,
} from 'lucide-react';

export default function ExecutiveBoardroomPage() {
  const [resolution, setResolution] = useState<'Bulanan' | 'Kuartalan' | 'Semester'>('Bulanan');

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Breadcrumb & Title Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-[#64748b] mb-1.5">
            <span>Dashboard Eksekutif</span>
            <span>&rsaquo;</span>
            <span>Tata Kelola & Strategi</span>
            <span>&rsaquo;</span>
            <span className="font-semibold text-[#007a5a] bg-[#e6f4ea] px-2 py-0.5 rounded">
              Q3-2026 Tinjauan Fiskal
            </span>
          </div>

          {/* Title & GCG Factor Pill */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
              Executive Boardroom & GCG Cockpit
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
              <span className="text-[10px] font-bold">GCG</span>
              <span>Terverifikasi: Faktor 1.00</span>
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Dropdown 1 */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <span>Semua Pilar Korporat (5 Pilar)</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" />
            </button>
          </div>

          {/* Filter Dropdown 2 */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <span>Tahun Buku 2026 (YTD)</span>
              <Calendar className="h-3.5 w-3.5 text-[#64748b]" />
            </button>
          </div>

          {/* Print Button */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
            <Printer className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Cetak Risalah BOD</span>
          </button>

          {/* Download Button */}
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors">
            <Download className="h-3.5 w-3.5 text-white" />
            <span>Unduh Ringkasan Eksekutif</span>
          </button>
        </div>
      </div>

      {/* 2. Five Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: VMAI Indeks Korporasi */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748b]">
              VMAI Indeks Korporasi
            </span>
            <ShieldCheck className="h-4 w-4 text-[#007a5a]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-[#0f172a] font-sans">
              89.4%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              +4.4%
            </span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-3 pt-2 border-t border-[#f1f5f9]">
            Tolok Ukur Industri: 85.0% (Unggul)
          </p>
        </div>

        {/* Card 2: Finansial */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748b]">
              Perspektif Finansial
            </span>
            <Building className="h-4 w-4 text-[#64748b]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-[#0f172a] font-sans">
              92.4%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              -1.8% MPP
            </span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-3 pt-2 border-t border-[#f1f5f9]">
            Realisasi Anggaran: Efisien & Terkendali
          </p>
        </div>

        {/* Card 3: Pelanggan */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748b]">
              Pelanggan & Stakeholder
            </span>
            <Users className="h-4 w-4 text-[#64748b]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-[#0f172a] font-sans">
              87.1%
            </span>
            <span className="text-[11px] font-bold text-[#475569] bg-[#f1f5f9] px-1.5 py-0.5 rounded">
              CSAT 4.5/5
            </span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-3 pt-2 border-t border-[#f1f5f9]">
            Indeks Kepuasan Stakeholder: Patuh
          </p>
        </div>

        {/* Card 4: Proses Internal */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748b]">
              Proses Bisnis Internal
            </span>
            <RotateCcw className="h-4 w-4 text-[#64748b]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-[#0f172a] font-sans">
              94.8%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              0 SOP Fail
            </span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-3 pt-2 border-t border-[#f1f5f9]">
            Efisiensi Siklus Kerja: Istimewa
          </p>
        </div>

        {/* Card 5: Pembelajaran (Alert) */}
        <div className="stitch-metric-card border-rose-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748b]">
              Pembelajaran & SDM
            </span>
            <AlertTriangle className="h-4 w-4 text-[#dc2626]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-[#dc2626] font-sans">
              83.3%
            </span>
            <span className="text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] px-1.5 py-0.5 rounded">
              -6.7% Delta
            </span>
          </div>
          <p className="text-[11px] text-[#dc2626] font-semibold mt-3 pt-2 border-t border-rose-100">
            Realisasi Mandatori Pelatihan Tertunda
          </p>
        </div>

      </div>

      {/* 3. Big Chart Card: Tren Komparasi VMAI */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0f172a]">
              Tren Komparasi Vision & Mission Alignment Index (VMAI)
            </h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              Analisis 6 bulan berjalan terhadap ambang batas kepatuhan Good Corporate Governance (GCG) dan Benchmark Industri
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <span className="text-[11px]">Resolusi:</span>
            {(['Bulanan', 'Kuartalan', 'Semester'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setResolution(r)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  resolution === r
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Line Chart with Floating Tooltip over September */}
        <div className="relative w-full h-[320px] pt-4">
          <svg viewBox="0 0 900 240" className="w-full h-[250px] overflow-visible">
            {/* Horizontal Grid lines */}
            {[60, 70, 80, 90, 100].map((val, idx) => {
              const y = 220 - ((val - 60) / 40) * 190;
              return (
                <g key={idx}>
                  <line x1="45" y1={y} x2="860" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x="35" y={y + 4} textAnchor="end" className="text-[10px] fill-[#94a3b8] font-mono">
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* X-axis Month labels */}
            {[
              { m: 'Apr 2026', x: 80 },
              { m: 'Mei 2026', x: 230 },
              { m: 'Jun 2026', x: 380 },
              { m: 'Jul 2026', x: 530 },
              { m: 'Agt 2026', x: 680 },
              { m: 'Sep 2026', x: 830 },
            ].map((col, idx) => (
              <text
                key={idx}
                x={col.x}
                y="235"
                textAnchor="middle"
                className={`text-[11px] font-medium ${idx === 5 ? 'fill-[#007a5a] font-bold' : 'fill-[#64748b]'}`}
              >
                {col.m}
              </text>
            ))}

            {/* Red GCG Minimum Threshold Line at 70% */}
            {/* y for 70% = 220 - (10/40)*190 = 172.5 */}
            <line x1="45" y1="172.5" x2="860" y2="172.5" stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Blue Benchmark Line (85% approx y = 101.25) */}
            <path
              d="M 80 115 L 230 110 L 380 108 L 530 105 L 680 102 L 830 101"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
            />
            {/* Blue line nodes */}
            <circle cx="80" cy="115" r="3.5" fill="#0284c7" />
            <circle cx="230" cy="110" r="3.5" fill="#0284c7" />
            <circle cx="380" cy="108" r="3.5" fill="#0284c7" />
            <circle cx="530" cy="105" r="3.5" fill="#0284c7" />
            <circle cx="680" cy="102" r="3.5" fill="#0284c7" />
            <circle cx="830" cy="101" r="3.5" fill="#0284c7" />

            {/* Dark Green Corporate VMAI Line (rising from ~77% to 89.4%) */}
            {/* 77% y=139.25, 80% y=125, 83% y=110.75, 86% y=96.5, 88% y=87, 89.4% y=80.35 */}
            <path
              d="M 80 139 L 230 125 L 380 111 L 530 96 L 680 87 L 830 80"
              fill="none"
              stroke="#007a5a"
              strokeWidth="3"
            />
            {/* Green line nodes */}
            <circle cx="80" cy="139" r="4" fill="#007a5a" />
            <circle cx="230" cy="125" r="4" fill="#007a5a" />
            <circle cx="380" cy="111" r="4" fill="#007a5a" />
            <circle cx="530" cy="96" r="4" fill="#007a5a" />
            <circle cx="680" cy="87" r="4" fill="#007a5a" />
            <circle cx="830" cy="80" r="5" fill="#007a5a" stroke="#ffffff" strokeWidth="2" />

            {/* Dashed vertical line down to September */}
            <line x1="830" y1="80" x2="830" y2="220" stroke="#007a5a" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>

          {/* Floating Dark Tooltip over September Point */}
          <div className="absolute right-10 top-0 w-52 rounded-xl bg-[#0d131f] text-white p-3 shadow-xl border border-slate-700 pointer-events-none text-xs">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2">
              <span className="font-semibold text-slate-200">September 2026</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                Q3 Penutupan
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300 font-sans">
                  <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                  Realisasi VMAI
                </span>
                <span className="font-bold text-white">89.4%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300 font-sans">
                  <span className="h-2 w-2 rounded-full bg-[#0284c7]" />
                  Benchmark BUMN
                </span>
                <span className="text-slate-300">85.0%</span>
              </div>

              <div className="pt-1.5 border-t border-slate-700/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-sans">Target RKAP Tahunan</span>
                <span className="font-bold text-emerald-400">88.0% (+1.4% Sukses)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[#f1f5f9] text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#007a5a]" />
            <span className="text-[#334155] font-medium">Realisasi VMAI Korporat (2026)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7]" />
            <span className="text-[#334155] font-medium">Benchmark Industri Tier-1 BUMN Unggul (85.0%)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-[#f87171]" />
            <span className="text-[#334155] font-medium">Ambang Batas Minimum GCG (70.0%)</span>
          </div>
        </div>
      </div>

      {/* 4. Three Bottom Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Peringatan Kesenjangan (Pembelajaran & SDM) */}
        <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#dc2626]">
                Peringatan Kesenjangan
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#fce8e6] text-[#c5221f]">
                Defisit -6.7%
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-[#fce8e6] text-[#dc2626]">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Pilar Pembelajaran & SDM
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Realisasi pengembangan kompetensi saat ini tercatat <strong>22.4 jam/karyawan</strong> terhadap mandat korporat 24 jam/tahun. Terdapat potensi penurunan skor kapabilitas digital Q4.
            </p>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#334155]">Capaian Jam Pelatihan Mandatori</span>
                <span className="font-mono text-[#0f172a]">22.4h / 24.0h (93.3%)</span>
              </div>
              <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                <div className="bg-[#f59e0b] h-full rounded-full" style={{ width: '93.3%' }} />
              </div>
            </div>

            {/* Recommendation Box */}
            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155] flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-[#f59e0b] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Rekomendasi BOD:</strong> Luncurkan program sertifikasi mandatori ISO 30414 dan alokasikan sisa anggaran akselerasi kepemimpinan.
              </p>
            </div>
          </div>

          <button className="w-full py-2.5 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] flex items-center justify-center gap-1.5 transition-colors">
            <span>Tinjau Anggaran & Kuota Diklat</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Card 2: Faktor Tata Kelola (Kepatuhan Prinsip TARIF) */}
        <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#007a5a]">
                Faktor Tata Kelola
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333]">
                Skor 97.4%
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-[#e6f4ea] text-[#007a5a]">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Kepatuhan Prinsip TARIF
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Kepatuhan terhadap prinsip Transparansi, Akuntabilitas, Responsibilitas, Independensi, dan Fairness (TARIF) berjalan optimal dengan <strong>0 temuan material</strong> pada audit interim internal maupun BPKP.
            </p>

            {/* 2 Mini Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
                <span className="text-[10px] text-[#64748b] block">Transparansi</span>
                <span className="text-base font-bold text-[#0f172a] font-mono">98.2%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
                <span className="text-[10px] text-[#64748b] block">Akuntabilitas</span>
                <span className="text-base font-bold text-[#0f172a] font-mono">95.0%</span>
              </div>
            </div>

            {/* Audit Integrity Box */}
            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155] flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-[#007a5a] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Integritas Audit:</strong> Seluruh matriks penilaian kinerja Q3 telah terkunci melalui signature enkripsi digital tanpa revisi susulan.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/audit-governance"
            className="w-full py-2.5 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Lihat Audit Trail Eksekutif</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Card 3: Risiko Suksesi Eksekutif (Pipeline Kepemimpinan) */}
        <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0284c7]">
                Risiko Suksesi Eksekutif
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">
                3 Posisi Kritis
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-[#e0f2fe] text-[#0284c7]">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Pipeline Kepemimpinan
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Algoritma suksesi mendeteksi <strong>3 peran kunci manajerial</strong> (Direktorat TI & Operasional) belum memiliki suksesor siap pakai pada kuadran <em>Future Leader</em> (Box 9).
            </p>

            {/* Stacked Bar for Readiness */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#334155]">Kesiapan Cadangan Talenta (Ready &lt; 6 Bln)</span>
                <span className="font-mono text-[#0f172a]">64.5%</span>
              </div>
              <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden flex">
                <div className="bg-[#007a5a] h-full" style={{ width: '64.5%' }} />
                <div className="bg-[#f59e0b] h-full" style={{ width: '20%' }} />
                <div className="bg-[#dc2626] h-full" style={{ width: '15.5%' }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#64748b] font-medium">
                <span>Siap: 14 Posisi</span>
                <span>Berisiko: 3 Posisi</span>
              </div>
            </div>

            {/* BOC Mandate Box */}
            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155] flex items-start gap-2">
              <Lock className="h-4 w-4 text-[#0284c7] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Mandat Dewan Komisaris:</strong> Tetapkan kandidat suksesi lapis-1 sebelum RUPST Tahunan November 2026.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/ninebox-matrix"
            className="w-full py-2.5 px-4 rounded-xl bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <span>Buka 9-Box Executive View</span>
            <Grid3X3 className="h-3.5 w-3.5" />
          </Link>
        </div>

      </div>

      {/* 5. Formal Legal Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-[#e2e8f0] text-[11px] text-[#64748b]">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-[#94a3b8]" />
          <span>
            Dokumen Rahasia & Terbatas (BOD/BOC E-PerformIQ). Diaudit secara kriptografis pada 30 September 2026 23:59 WIB.
          </span>
        </div>

        <div className="flex items-center gap-4 text-[#475569]">
          <span className="hover:underline cursor-pointer">Protokol Keamanan Data</span>
          <span>&bull;</span>
          <span className="hover:underline cursor-pointer">Standar Metodologi Balanced Scorecard BUMN</span>
        </div>
      </div>

    </div>
  );
}
