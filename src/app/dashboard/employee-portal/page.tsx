'use client';

import React, { useState } from 'react';
import {
  Download,
  Send,
  Sparkles,
  ShieldCheck,
  Award,
  Users,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  GraduationCap,
  MessageSquare,
  Bookmark,
  ArrowRight,
  GitBranch,
  Plus,
  Lock,
} from 'lucide-react';

export default function EmployeePortalPage() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Employee Welcome Header Card */}
      <div className="stitch-card-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Identity & Badges */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
                alt="Budi Pratama"
                className="h-16 w-16 rounded-2xl object-cover border border-[#e2e8f0] shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#137333] ring-2 ring-white" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                Selamat Datang, Budi Pratama
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
                <span className="font-mono font-semibold text-[#0f172a]">NIP: EMP-2024-0042</span>
                <span>&bull;</span>
                <span className="font-medium text-[#334155]">Enterprise Technology Solutions</span>
                <span>&bull;</span>
                <span>Level: <strong className="text-[#0f172a]">Senior Specialist</strong></span>
              </div>

              <div className="text-xs text-[#64748b]">
                Atasan Langsung: <strong className="text-[#334155]">Ir. H. Gunawan (VP Eng.)</strong>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                  Status: Tetap (Permanent)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                  Masa Bakti: 3 Thn 4 Bln
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                  Siklus: 2026-Q3 (Self-Appraisal Phase)
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <Download className="h-3.5 w-3.5 text-[#64748b]" />
              <span>Unduh Portofolio KPI</span>
            </button>

            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors">
              <Send className="h-3.5 w-3.5 text-white" />
              <span>Ajukan Finalisasi Q3</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. Composite Performance Scorecard */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold text-[#0f172a]">
              Composite Performance Scorecard
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569]">
              Model GCG 4-Pilar
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-[#64748b] font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-[#007a5a]" />
            <span>Audit Trail ID: #GPA-2026-Q3-0941</span>
          </div>
        </div>

        <p className="text-xs text-[#64748b]">
          Formula bobot matematis transparan tanpa bias subjektif, tersinkronisasi otomatis dengan HR Command Center.
        </p>

        {/* Scorecard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch pt-1">
          
          {/* Left Block: GPA Hero */}
          <div className="lg:col-span-3 p-5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                Cumulative Weighted GPA
              </span>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-4xl font-black text-[#0f172a] font-sans">
                  3.67
                </span>
                <span className="text-base font-bold text-[#64748b]">/ 4.00</span>
              </div>
              <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                Predikat: A (Sangat Baik)
              </span>
            </div>

            <div className="text-[11px] text-[#64748b] pt-2 border-t border-[#e2e8f0] space-y-1">
              <div className="flex justify-between">
                <span>Standar Perusahaan: 3.25</span>
                <strong className="text-[#007a5a]">Top 7% Divisi</strong>
              </div>
              <p className="text-[10px] text-[#007a5a] font-semibold mt-1">
                Memenuhi syarat fast-track promosi Principal Engineer Q4.
              </p>
            </div>
          </div>

          {/* Right 4 Component Cards */}
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Component 1: KPI */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#334155]">
                    <Sparkles className="h-3.5 w-3.5 text-[#007a5a]" />
                    Cascaded KPI
                  </div>
                  <span className="text-xs font-bold text-[#0f172a] font-mono">46.25%</span>
                </div>
                <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 50%</span>
                <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
                  <span>Skor Aktual: <strong>92.5%</strong></span>
                  <span className="text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-1 rounded">Sangat Optimal</span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                Terhubung BSC Internal Process & Finansial
              </p>
            </div>

            {/* Component 2: SOP */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#334155]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0284c7]" />
                    SOP Compliance
                  </div>
                  <span className="text-xs font-bold text-[#0f172a] font-mono">19.20%</span>
                </div>
                <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 20%</span>
                <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
                  <span>Skor Aktual: <strong>96.0%</strong></span>
                  <span className="text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-1 rounded">0 Fatal Error</span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                SLA Penyelesaian Insiden 99.1% (Target 95%)
              </p>
            </div>

            {/* Component 3: Competency */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#334155]">
                    <Award className="h-3.5 w-3.5 text-[#007a5a]" />
                    Competency Mastery
                  </div>
                  <span className="text-xs font-bold text-[#0f172a] font-mono">12.75%</span>
                </div>
                <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 15%</span>
                <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
                  <span>Skor Aktual: <strong>85.0%</strong></span>
                  <span className="text-[10px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1 rounded">Index Gap: 0.12</span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                Benchmark standar arsitektur cloud level 4
              </p>
            </div>

            {/* Component 4: Core Values */}
            <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#334155]">
                    <Users className="h-3.5 w-3.5 text-[#007a5a]" />
                    Core Values & 360°
                  </div>
                  <span className="text-xs font-bold text-[#0f172a] font-mono">13.50%</span>
                </div>
                <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 15%</span>
                <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
                  <span>Skor Aktual: <strong>90.0%</strong></span>
                  <span className="text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-1 rounded">Rating: 4.5 / 5.0</span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                Pilar AKHLAK: Amanah, Harmonis, Kompeten
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* 3. Sasaran Kerja & Cascading OKR Aktif */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#0f172a]">
                Sasaran Kerja & Cascading OKR Aktif
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333]">
                Q3 In-Progress
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Setiap target individu terhubung secara hierarkis ke Balanced Scorecard (BSC) Perusahaan.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]">
              <GitBranch className="h-3.5 w-3.5 text-[#64748b]" />
              <span>Diagram Pohon BSC</span>
            </button>

            <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors">
              <Plus className="h-3.5 w-3.5 text-white" />
              <span>Ajukan Milestone Baru</span>
            </button>
          </div>
        </div>

        {/* Corporate Objective Alignment Banner */}
        <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#334155]">
            <Sparkles className="h-4 w-4 text-[#007a5a] flex-shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block">
                Corporate Objective Alignment
              </span>
              <span>
                BSC Level 1: &ldquo;<strong>Modernisasi Infrastruktur Digital & Tata Kelola GCG Tanpa Downtime Kritis</strong>&rdquo;
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[#64748b] block">Penyelarasan</span>
            <span className="text-xs font-bold text-[#007a5a]">100% Fully Cascaded</span>
          </div>
        </div>

        {/* Three Cascaded KR Cards */}
        <div className="space-y-4 pt-2">
          
          {/* KR-ETS-01 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                  KR-ETS-01
                </span>
                <h3 className="text-xs font-bold text-[#0f172a]">
                  Implementasi Arsitektur High Availability Multi-Region AWS & On-Premise
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                On Track (95%)
              </span>
            </div>

            <p className="text-xs text-[#64748b]">
              Menjamin uptime service tier-1 perbankan minimal 99.98% per triwulan dan audit sertifikasi ISO 27001.
            </p>

            <div className="flex flex-wrap items-center justify-between text-xs font-mono text-[#334155] pt-1">
              <span>Bobot: <strong>20%</strong></span>
              <span>Target: <strong>99.98% High Availability</strong></span>
              <span className="text-[#007a5a] font-bold">Realisasi: 99.99% (Terlampaui)</span>
            </div>

            {/* Bottom Attachments & Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#f1f5f9]">
              <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#007a5a]" />
                  <div>
                    <p className="font-semibold text-[#0f172a]">SLA_Report_AWS_Datadog_Q3.pdf</p>
                    <p className="text-[10px] text-[#64748b]">Diverifikasi Sistem Ops &bull; 2.4 MB</p>
                  </div>
                </div>
                <button className="text-[11px] font-semibold text-[#0284c7] hover:underline">Ganti</button>
              </div>

              <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-start gap-2 text-xs">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
                  alt="VP Eng"
                  className="h-6 w-6 rounded-full object-cover mt-0.5"
                />
                <div>
                  <p className="text-[10px] text-[#64748b]">
                    <strong>Ir. H. Gunawan</strong> &bull; 3 hari lalu
                  </p>
                  <p className="text-[11px] text-[#334155] italic mt-0.5">
                    &ldquo;Eksekusi failover multi-region sangat rapi. Pastikan dokumentasi simulasi DR dilaporkan ke komite GCG.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* KR-ETS-02 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                  KR-ETS-02
                </span>
                <h3 className="text-xs font-bold text-[#0f172a]">
                  Optimasi Rasio Efisiensi Komputasi Cloud (FinOps Initiative)
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0369a1]" />
                Review Mandiri (88%)
              </span>
            </div>

            <p className="text-xs text-[#64748b]">
              Reduksi idle resource pada kluster staging dan right-sizing container instance perusahaan.
            </p>

            <div className="flex flex-wrap items-center justify-between text-xs font-mono text-[#334155] pt-1">
              <span>Bobot: <strong>15%</strong></span>
              <span>Target: <strong>Penghematan USD 12,000 / Bulan</strong></span>
              <span className="text-[#0369a1] font-bold">Realisasi: USD 10,650 (88%)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#f1f5f9]">
              <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-[#007a5a]" />
                  <div>
                    <p className="font-semibold text-[#0f172a]">FinOps_Billing_Reduction_Aug2026.xlsx</p>
                    <p className="text-[10px] text-[#64748b]">Signed Finance Dept &bull; 1.1 MB</p>
                  </div>
                </div>
                <button className="text-[11px] font-semibold text-[#0284c7] hover:underline">Perbarui</button>
              </div>

              <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-start gap-2 text-xs">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
                  alt="VP Eng"
                  className="h-6 w-6 rounded-full object-cover mt-0.5"
                />
                <div>
                  <p className="text-[10px] text-[#64748b]">
                    <strong>Ir. H. Gunawan</strong> &bull; 1 minggu lalu
                  </p>
                  <p className="text-[11px] text-[#334155] italic mt-0.5">
                    &ldquo;Realisasi finops sangat memuaskan, usulkan masuk ke forum Kaizen bulanan untuk disalin unit lain.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* KR-ETS-03 */}
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                  KR-ETS-03
                </span>
                <h3 className="text-xs font-bold text-[#0f172a]">
                  Standardisasi Modul Microservices Security Zero-Trust
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                Selesai 100%
              </span>
            </div>

            <p className="text-xs text-[#64748b]">
              Menuntaskan enkripsi mTLS dan automated token rotasi untuk 34 core services perbankan.
            </p>

            <div className="flex flex-wrap items-center justify-between text-xs font-mono text-[#334155] pt-1">
              <span>Bobot: <strong>15%</strong></span>
              <span>Target: <strong>34 Modul Layanan Tervalidasi</strong></span>
              <span className="text-[#007a5a] font-bold">Realisasi: 34 / 34 (100%)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#f1f5f9]">
              <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#007a5a]" />
                  <div>
                    <p className="font-semibold text-[#0f172a]">Cert_Security_Clearance_Audit.pdf</p>
                    <p className="text-[10px] text-[#64748b]">Signed InfoSec &bull; 3.8 MB</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded">Tervalidasi</span>
              </div>

              <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-start gap-2 text-xs">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100"
                  alt="VP Eng"
                  className="h-6 w-6 rounded-full object-cover mt-0.5"
                />
                <div>
                  <p className="text-[10px] text-[#64748b]">
                    <strong>Ir. H. Gunawan</strong> &bull; 2 minggu lalu
                  </p>
                  <p className="text-[11px] text-[#334155] italic mt-0.5">
                    &ldquo;Sempurna. Milestone ini langsung memperkuat pilar GCG compliance divisi kita.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. Three Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Individual Development Plan & Training */}
        <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#e0f2fe] text-[#0284c7]">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Individual Development Plan & Training
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1]">
                18 / 24 Jam
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Penyelesaian jam pelatihan wajib tata kelola dan kapabilitas teknis tahun berjalan.
            </p>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#334155]">Progress Pelatihan Wajib</span>
                <span className="font-mono text-[#007a5a]">75% Selesai</span>
              </div>
              <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                <div className="bg-[#007a5a] h-full rounded-full" style={{ width: '75%' }} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#007a5a] flex-shrink-0" />
              <span className="text-[11px]">
                <strong>Kursus Aktif:</strong> Enterprise Architecture ISO & GCG Governance
              </span>
            </div>
          </div>

          <button className="w-full py-2 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] flex items-center justify-center gap-1.5 transition-colors">
            <span>Lanjutkan Pelatihan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Card 2: Peer Review 360° Feedback */}
        <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#e0f2fe] text-[#0284c7]">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Peer Review 360° Feedback
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">
                2 Menunggu
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Umpan balik tertutup antarmitra untuk evaluasi budaya kerja AKHLAK dan kolaborasi lintas fungsi.
            </p>

            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#334155] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#007a5a]">
                <Lock className="h-3.5 w-3.5" />
                <span>Jaminan Kerahasiaan 100%</span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Anda memiliki 2 rekan kerja yang menunggu umpan balik nilai budaya AKHLAK & Integritas untuk siklus Q3.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="h-6 w-6 rounded-full bg-[#007a5a] text-white text-[10px] font-bold flex items-center justify-center">AF</span>
                <span className="h-6 w-6 rounded-full bg-[#0284c7] text-white text-[10px] font-bold flex items-center justify-center">DS</span>
              </div>
            </div>
          </div>

          <button className="w-full py-2.5 px-4 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs">
            <span>Isi Feedback Anonim</span>
          </button>
        </div>

        {/* Card 3: Talent Legacy & Lifetime Contribution */}
        <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#e6f4ea] text-[#007a5a]">
                  <Bookmark className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-[#0f172a]">
                  Talent Legacy & Lifetime Contribution
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569]">
                Tier: Gold Contributor
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Rekam jejak dampak jangka panjang, hak paten terdaftar, dan efisiensi Kaizen organisasi.
            </p>

            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-[#0f172a] font-sans">140</span>
                <span className="text-xs font-semibold text-[#64748b]">Poin Legacy Akumulatif</span>
              </div>
              <ul className="text-[11px] text-[#475569] space-y-1 list-disc list-inside">
                <li>1 Paten Terdaftar: &ldquo;Dynamic API Gateway Rate Limiting&rdquo;</li>
                <li>2 Inovasi Kaizen: &ldquo;FF-Cost Staging Optimization&rdquo;</li>
              </ul>
            </div>
          </div>

          <button className="w-full py-2 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] flex items-center justify-center gap-1.5 transition-colors">
            <span>Lihat Portofolio Legacy</span>
          </button>
        </div>

      </div>

    </div>
  );
}
