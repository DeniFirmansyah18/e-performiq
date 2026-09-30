'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Download,
  Scale,
  UserPlus,
  Inbox,
  Activity,
  ShieldCheck,
  LogOut,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileText,
  FileCheck,
  Check,
  Calculator,
  X,
  Plus,
} from 'lucide-react';
import CostOfWorkforceCard from '@/components/governance/CostOfWorkforceCard';
import FlightRiskHeatmap from '@/components/governance/FlightRiskHeatmap';
import LearningCertificationPanel from '@/components/governance/LearningCertificationPanel';

export default function HROperationsPage() {
  const [pipelineTab, setPipelineTab] = useState<'pre' | 'during' | 'post'>('pre');
  const [mppData, setMppData] = useState<any>(null);
  const [offboardings, setOffboardings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resMpp, resOff] = await Promise.all([
        fetch('/api/v1/pre-employment/mpp-summary'),
        fetch('/api/v1/offboarding/initiate'),
      ]);
      if (resMpp.ok) {
        const json = await resMpp.json();
        setMppData(json.data);
      }
      if (resOff.ok) {
        const json = await resOff.json();
        setOffboardings(json.data || []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // FPTK Modal State
  const [isFptkModalOpen, setIsFptkModalOpen] = useState(false);
  const [isFptkSubmitting, setIsFptkSubmitting] = useState(false);
  const [fptkForm, setFptkForm] = useState({
    candidateName: '',
    appliedPositionId: 'a0000000-0000-4000-8000-000000000204',
    hiringRequisitionId: '51000000-0000-4000-8000-000000000001',
    psychometricScore: 88,
    technicalTestScore: 92,
    competencyInterviewScore: 86,
    recruitmentCost: 6500000,
    timeToFillDays: 21,
    hiringStatus: 'OFFERED',
  });

  const handleCreateFptk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFptkSubmitting(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/v1/pre-employment/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: fptkForm.candidateName,
          applied_position_id: fptkForm.appliedPositionId,
          hiring_requisition_id: fptkForm.hiringRequisitionId,
          psychometric_score: Number(fptkForm.psychometricScore),
          technical_test_score: Number(fptkForm.technicalTestScore),
          competency_interview_score: Number(fptkForm.competencyInterviewScore),
          recruitment_cost: Number(fptkForm.recruitmentCost),
          time_to_fill_days: Number(fptkForm.timeToFillDays),
          hiring_status: fptkForm.hiringStatus,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionNotice(
          `Kandidat '${fptkForm.candidateName}' berhasil didaftarkan! Skor Quality of Hire (QoH): ${json.data?.computedQoH || '88.8'} (Status: ${json.data?.hiringStatus || 'OFFERED'}).`
        );
        setIsFptkModalOpen(false);
        setFptkForm({
          candidateName: '',
          appliedPositionId: 'a0000000-0000-4000-8000-000000000204',
          hiringRequisitionId: '51000000-0000-4000-8000-000000000001',
          psychometricScore: 88,
          technicalTestScore: 92,
          competencyInterviewScore: 86,
          recruitmentCost: 6500000,
          timeToFillDays: 21,
          hiringStatus: 'OFFERED',
        });
        loadData();
      } else {
        setActionNotice(`Gagal: ${json.detail || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setIsFptkSubmitting(false);
    }
  };

  const handleExportIso = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Kode FPTK,Departemen,Posisi,Alokasi Budget IDR,Realisasi Budget IDR,Kuota Disetujui,Terisi,Status SLA\n' +
      (mppData?.departmental_breakdown || [])
        .map(
          (p: any) =>
            `"${p.plan_id}","${p.department_name}","${p.position_title}","${p.allocated_budget_idr}","${p.utilized_budget_idr}","${p.approved_quota}","${p.hired_count}","On Track"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Laporan_ISO_30414_Human_Capital_2026.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActionNotice('Laporan ISO 30414:2019 berhasil diekspor ke format CSV!');
  };

  const handleVerifyHandover = async (handoverId: string) => {
    try {
      const res = await fetch(`/api/v1/offboarding/handover/${handoverId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setActionNotice('Item serah terima berhasil diverifikasi!');
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const handleCalculateSeverance = async (requestId: string) => {
    try {
      const res = await fetch('/api/v1/offboarding/calculate-severance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offboarding_request_id: requestId,
          reason_type: 'RESIGNATION',
          dplk_topup: 168000000,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const rawTotal =
          json.data?.totalDisbursement ??
          json.data?.data?.totalDisbursement ??
          json.data?.total_disbursement_idr ??
          json.data?.data?.total_disbursement_idr ??
          json.data?.breakdown?.totalDisbursement ??
          json.data?.data?.breakdown?.totalDisbursement ??
          0;
        const totalNum = Number(rawTotal);
        const formattedTotal = !isNaN(totalNum) && totalNum > 0
          ? `Rp ${totalNum.toLocaleString('id-ID')}`
          : 'Rp 0';

        setActionNotice(`Kalkulasi pesangon berhasil disahkan! Total Hak Kompensasi: ${formattedTotal}`);
        loadData();
      } else {
        setActionNotice(`Gagal: ${json.detail || json.message || 'Terjadi kesalahan kalkulasi.'}`);
      }
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    }
  };

  const candidates = [
    {
      name: 'Annisa Rahmawati, S.Kom.',
      code: 'FPTK-2026-ENG-001',
      dept: 'Core Architecture & DevOps',
      stage: 'Offer Accepted',
      stageBg: 'bg-[#e0f2fe] text-[#0369a1]',
      score: `${mppData?.quality_of_hire?.avg_qoh_score ?? 88.8} QoH`,
      slaOnTrack: true,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
    },
    {
      name: 'Bambang Wicaksono, S.T.',
      code: 'FPTK-2026-HC-002',
      dept: 'Enterprise Data Ops',
      stage: 'Background Check',
      stageBg: 'bg-[#e6f4ea] text-[#137333]',
      score: '91.0 QoH',
      slaOnTrack: true,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    },
    {
      name: 'Citra Melinda, CFA',
      code: 'FPTK-2026-SPI-003',
      dept: 'Governance & SPI',
      stage: 'User Interview 2',
      stageBg: 'bg-[#e0f2fe] text-[#0369a1]',
      score: '80.0 QoH',
      slaOnTrack: false,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[#64748b]">
              Enterprise Talent Governance
            </span>
            <span className="font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded text-[11px] border border-[#b7e1cd]">
              ISO 30414 Compliant
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
            HR Operations / Lifecycle Command Center
          </h1>
        </div>

        {/* Right Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
            <Calendar className="h-3.5 w-3.5 text-[#64748b]" />
            <span>2026-Q3 (Jul - Sep 2026)</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" />
          </button>

          <button 
            onClick={handleExportIso}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc] cursor-pointer">
            <Download className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Ekspor ISO 30414</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc]">
            <Scale className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Kalibrasi Nilai Semester</span>
          </button>

          <button 
            onClick={() => setIsFptkModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer">
            <UserPlus className="h-3.5 w-3.5 text-white" />
            <span>+ Rekrutmen Baru (FPTK)</span>
          </button>
        </div>
      </div>

      {/* 2. Four Lifecycle Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Pre-Employment */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Pre-Employment
            </span>
            <Inbox className="h-4 w-4 text-[#007a5a]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              96.4%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              +3.2% vs Q2
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            MPP Fulfillment (135/140 kuota)
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-[#94a3b8]" /> TTF: <strong>24.2 hari</strong>
            </span>
            <span>QoH: <strong className="text-[#0f172a]">87.5/100</strong></span>
          </div>
        </div>

        {/* Card 2: During-Employment */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              During-Employment
            </span>
            <Activity className="h-4 w-4 text-[#0284c7]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              3.52
            </span>
            <span className="text-sm font-bold text-[#64748b]">/ 4.00</span>
            <span className="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded">
              Sehat
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            Overall Average GPA Nilai
          </p>
          {/* Distribution Stacked Bar */}
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] space-y-1">
            <div className="w-full bg-[#f1f5f9] h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-[#007a5a] h-full" style={{ width: '18%' }} />
              <div className="bg-[#0284c7] h-full" style={{ width: '64%' }} />
              <div className="bg-[#f59e0b] h-full" style={{ width: '15%' }} />
              <div className="bg-[#dc2626] h-full" style={{ width: '3%' }} />
            </div>
            <p className="text-[10px] text-[#64748b] text-center font-mono">
              A: 18% &bull; B: 64% &bull; C: 15% &bull; D: 3%
            </p>
          </div>
        </div>

        {/* Card 3: SOP & GCG SLA */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              SOP & GCG SLA
            </span>
            <ShieldCheck className="h-4 w-4 text-[#007a5a]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              98.7%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              Tercapai
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            0 Fatal Error Operasional
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span className="flex items-center gap-1 text-[#137333] font-semibold">
              <CheckCircle2 className="h-3 w-3" /> Audit: 100%
            </span>
            <span className="text-[10px] bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[#475569]">
              Clearance Strict
            </span>
          </div>
        </div>

        {/* Card 4: Post-Employment */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Post-Employment
            </span>
            <LogOut className="h-4 w-4 text-[#dc2626]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              2.1%
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              Di Bawah Batas
            </span>
          </div>
          <p className="text-xs font-medium text-[#334155] mt-1">
            Regrettable Attrition (Target &le; 3.0%)
          </p>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
            <span>Exit SLA: <strong>4.8 hari Aman</strong></span>
            <span className="text-[10px] bg-[#fce8e6] px-1.5 py-0.5 rounded text-[#c5221f] font-semibold">
              Offboarding
            </span>
          </div>
        </div>

      </div>

      {/* Govera360 Strategic Analytics Row (Cost of Workforce & Flight Risk) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostOfWorkforceCard />
        <FlightRiskHeatmap />
      </div>

      {/* Learning & Certification (integrasi model Moodle) */}
      <LearningCertificationPanel />

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (60%): Lifecycle Milestone Pipeline Table */}
        <div className="lg:col-span-7 stitch-card-white p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f1f5f9] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#0f172a]">
                  Lifecycle Milestone & Operational Pipeline
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                  24 Active Requests
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Pemantauan SLA real-time karyawan dalam transisi fase lifecycle.
              </p>
            </div>
          </div>

          {/* Sub-filter tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#f1f5f9] text-xs font-medium text-[#64748b]">
            <button
              onClick={() => setPipelineTab('pre')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                pipelineTab === 'pre'
                  ? 'bg-white text-[#0f172a] shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              Pre-Employment (MPP & QoH)
            </button>
            <button
              onClick={() => setPipelineTab('during')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                pipelineTab === 'during'
                  ? 'bg-white text-[#0f172a] shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              During (GPA & 360)
            </button>
            <button
              onClick={() => setPipelineTab('post')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                pipelineTab === 'post'
                  ? 'bg-white text-[#0f172a] shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              Post (Clearance & Severance)
            </button>
          </div>

          {actionNotice && (
            <div className="p-3 rounded-lg bg-[#e6f4ea] border border-[#b7e1cd] text-xs font-semibold text-[#137333] flex items-center justify-between">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="font-bold underline">Tutup</button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {pipelineTab === 'post' ? (
              <div className="space-y-4">
                {offboardings.map((off) => (
                  <div key={off.id} className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#0f172a]">{off.employeeName}</h4>
                        <p className="text-[11px] text-[#64748b]">{off.position} &bull; {off.department}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#007a5a]">Clearance: {off.handoverProgress}%</span>
                        <p className="text-[10px] text-[#64748b]">LWD: {off.lastWorkingDay}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 border-t border-[#f1f5f9] pt-2">
                      <p className="text-[11px] font-bold text-[#334155]">Checklist Serah Terima Tugas (PRD §8 Hard Gate):</p>
                      {(off.handovers || []).map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-[#f8fafc] text-xs">
                          <span className={h.isVerified ? 'line-through text-[#64748b]' : 'font-semibold text-[#0f172a]'}>
                            {h.itemName}
                          </span>
                          {h.isVerified ? (
                            <span className="text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded">Terverifikasi</span>
                          ) : (
                            <button
                              onClick={() => handleVerifyHandover(h.id)}
                              className="px-2.5 py-1 rounded bg-[#007a5a] text-white text-[10px] font-bold hover:bg-[#00684a]"
                            >
                              Verifikasi
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {off.severanceTotal && Number(off.severanceTotal) > 0 && (
                      <div className="p-3 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd] flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-[#137333] uppercase tracking-wider block">
                            Hak Kompensasi PP 35/2021 Disahkan:
                          </span>
                          <span className="font-mono font-extrabold text-sm text-[#007a5a]">
                            Rp {Number(off.severanceTotal).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#137333] bg-white px-2 py-1 rounded-lg border border-[#b7e1cd]">
                          {off.isSeverancePaid ? 'Telah Ditransfer' : 'Siap Dicairkan (SLA ≤ 7 Hari)'}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#f1f5f9] flex justify-end">
                      <button
                        onClick={() => handleCalculateSeverance(off.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        <span>{off.severanceTotal ? 'Hitung Ulang & Sahkan Pesangon PP 35' : 'Kalkulasi & Sahkan Pesangon PP 35'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#e2e8f0] text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  <tr>
                    <th className="py-2.5 px-3">Nama & Identitas</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Fase Transisi</th>
                    <th className="py-2.5 px-3 text-center">Skor QoH / GPA</th>
                    <th className="py-2.5 px-3 text-right">SLA Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {candidates.map((c, idx) => (
                    <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="h-8 w-8 rounded-full object-cover border border-[#e2e8f0]"
                          />
                          <div>
                            <p className="font-bold text-[#0f172a]">{c.name}</p>
                            <p className="text-[10px] text-[#64748b] font-mono">{c.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#334155] font-medium">
                        {c.dept}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.stageBg}`}>
                          &bull; {c.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-[#0f172a] font-mono">{c.score}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {c.slaOnTrack ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333]">
                            <Clock className="h-3 w-3 text-[#137333]" /> On Track
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#dc2626]">
                            <AlertTriangle className="h-3 w-3 text-[#dc2626]" /> Alert
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Banner */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#334155]">
              <ShieldCheck className="h-4 w-4 text-[#007a5a] flex-shrink-0" />
              <span>
                <strong>SOP SLA Penanganan Rekrutmen:</strong> Maksimal 30 hari kalender per headcount.
              </span>
            </div>

            <button className="flex items-center gap-1 text-xs font-semibold text-[#007a5a] hover:underline whitespace-nowrap">
              <span>Lihat Seluruh 135 Kuota Terisi</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (40%): Two Cards */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Kalibrasi Penilaian Semester (Gaussian Bell Curve) */}
          <div className="stitch-card-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#0f172a]">
                  Kalibrasi Penilaian Semester
                </h3>
                <p className="text-xs text-[#64748b]">
                  Distribusi Kurva Gaussian BUMN / Enterprise Governance
                </p>
              </div>
              <Scale className="h-4 w-4 text-[#007a5a]" />
            </div>

            {/* 3 Metric Counts */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
              <div>
                <span className="text-[10px] text-[#64748b] block font-semibold">TOTAL KARYAWAN</span>
                <span className="text-base font-black text-[#0f172a] font-mono">1,240</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748b] block font-semibold">DINILAI (95.1%)</span>
                <span className="text-base font-black text-[#007a5a] font-mono">1,180</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748b] block font-semibold">PENDING VALIDASI</span>
                <span className="text-base font-black text-[#dc2626] font-mono">60</span>
              </div>
            </div>

            {/* Bell Curve Diagram with Normal Tolerance badge */}
            <div className="relative p-3 rounded-xl border border-[#e2e8f0] bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#64748b] font-medium">
                  BUMN Standard Forced Distribution Benchmark
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333]">
                  Toleransi Normal
                </span>
              </div>

              {/* Curve Graphic */}
              <div className="w-full h-24 flex items-center justify-center">
                <svg viewBox="0 0 300 80" className="w-full h-full overflow-visible">
                  <path
                    d="M 10 75 Q 80 75, 110 50 T 150 15 T 190 50 Q 220 75, 290 75"
                    fill="rgba(0, 122, 90, 0.08)"
                    stroke="#007a5a"
                    strokeWidth="2"
                  />
                  {/* Mean line */}
                  <line x1="150" y1="15" x2="150" y2="75" stroke="#007a5a" strokeWidth="1" strokeDasharray="2 2" />
                  <text x="150" y="10" textAnchor="middle" className="text-[8px] fill-[#007a5a] font-bold">Median</text>
                  
                  {/* Dots on thresholds */}
                  <circle cx="50" cy="73" r="2.5" fill="#f87171" />
                  <text x="50" y="80" textAnchor="middle" className="text-[8px] fill-[#64748b]">D (3%)</text>
                  
                  <circle cx="100" cy="58" r="2.5" fill="#f59e0b" />
                  <text x="100" y="80" textAnchor="middle" className="text-[8px] fill-[#64748b]">C (15%)</text>
                  
                  <circle cx="150" cy="15" r="3" fill="#007a5a" />
                  <text x="150" y="80" textAnchor="middle" className="text-[8px] fill-[#0f172a] font-bold">B (64%)</text>
                  
                  <circle cx="240" cy="65" r="2.5" fill="#0284c7" />
                  <text x="240" y="80" textAnchor="middle" className="text-[8px] fill-[#64748b]">A (18%)</text>
                </svg>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                <span>Status Dewan Kalibrasi: <strong className="text-[#007a5a]">Kuorum Terpenuhi</strong></span>
                <span className="text-[#0284c7] hover:underline cursor-pointer font-medium">Detail Kuota Per Divisi</span>
              </div>
            </div>
          </div>

          {/* Card 2: Offboarding Clearance Pending */}
          <div className="stitch-card-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-sm font-extrabold text-[#0f172a]">
                  Offboarding Clearance Pending
                </h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#fce8e6] text-[#c5221f]">
                3 Karyawan
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Dokumen Berita Acara Serah Terima (BAST), pengembalian token SSO, & audit clearance inventaris menunggu approval HR Director sebelum tanggal LWD.
            </p>

            {/* List */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-[#dc2626] flex-shrink-0" />
                  <div>
                    <p className="font-bold text-[#0f172a]">Irfan Syahputra, S.T.</p>
                    <p className="text-[10px] text-[#64748b]">Lead Security Architect &bull; LWD: 2 Okt 2026</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded">
                  IT Clearance OK
                </span>
              </div>

              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-[#dc2626] flex-shrink-0" />
                  <div>
                    <p className="font-bold text-[#0f172a]">Dian Paramitha</p>
                    <p className="text-[10px] text-[#64748b]">Senior Legal Counsel &bull; LWD: 3 Okt 2026</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded">
                  Audit NDA Pending
                </span>
              </div>
            </div>

            {/* Button */}
            <button className="w-full py-2.5 px-4 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
              <FileCheck className="h-4 w-4" />
              <span>Review Dokumen LWD & BAST</span>
            </button>
          </div>

        </div>

      </div>

      {/* Modal Input FPTK Baru */}
      {isFptkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#007a5a]/10 text-[#007a5a]">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Form Permintaan Tenaga Kerja (FPTK)</h3>
                  <p className="text-xs text-slate-500">Pendaftaran & Penilaian Seleksi Kandidat (ISO 30414 QoH Engine)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsFptkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFptk} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap Kandidat *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Safitri, S.Kom."
                  value={fptkForm.candidateName}
                  onChange={(e) => setFptkForm({ ...fptkForm, candidateName: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Posisi Jabatan *</label>
                  <select
                    value={fptkForm.appliedPositionId}
                    onChange={(e) => setFptkForm({ ...fptkForm, appliedPositionId: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                  >
                    <option value="a0000000-0000-4000-8000-000000000204">Senior Cloud Engineer (IT Infrastructure)</option>
                    <option value="a0000000-0000-4000-8000-000000000203">Lead Performance Specialist (HC Strategy)</option>
                    <option value="a0000000-0000-4000-8000-000000000205">Enterprise Risk Manager (Risk & GCG)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Rekrutmen</label>
                  <select
                    value={fptkForm.hiringStatus}
                    onChange={(e) => setFptkForm({ ...fptkForm, hiringStatus: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                  >
                    <option value="OFFERED">OFFERED (Siap Onboarding)</option>
                    <option value="HIRED">HIRED (Kandidat Menerima)</option>
                    <option value="INTERVIEW_PASSED">INTERVIEW PASSED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Psikometri (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fptkForm.psychometricScore}
                    onChange={(e) => setFptkForm({ ...fptkForm, psychometricScore: Number(e.target.value) })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tes Teknis (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fptkForm.technicalTestScore}
                    onChange={(e) => setFptkForm({ ...fptkForm, technicalTestScore: Number(e.target.value) })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wawancara User</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fptkForm.competencyInterviewScore}
                    onChange={(e) => setFptkForm({ ...fptkForm, competencyInterviewScore: Number(e.target.value) })}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Biaya Rekrutmen (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    step="500000"
                    value={fptkForm.recruitmentCost}
                    onChange={(e) => setFptkForm({ ...fptkForm, recruitmentCost: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time to Fill (Hari)</label>
                  <input
                    type="number"
                    min="1"
                    value={fptkForm.timeToFillDays}
                    onChange={(e) => setFptkForm({ ...fptkForm, timeToFillDays: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                Formula Quality of Hire: <strong>(Psikometri × 30%) + (Teknis × 40%) + (Wawancara × 30%)</strong>
                <div className="mt-0.5 font-bold">
                  Estimasi Skor: {((fptkForm.psychometricScore * 0.3) + (fptkForm.technicalTestScore * 0.4) + (fptkForm.competencyInterviewScore * 0.3)).toFixed(1)} / 100
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFptkModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isFptkSubmitting || !fptkForm.candidateName}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#007a5a] hover:bg-[#00684a] rounded-lg disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  {isFptkSubmitting ? 'Memproses...' : 'Simpan & Kalkulasi QoH'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
