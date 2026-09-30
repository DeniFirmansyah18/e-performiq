'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Star,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
  Calculator,
  X,
} from 'lucide-react';
import InternalApplicationReview from '@/components/manager/InternalApplicationReview';

interface TeamMember {
  id: string;
  name: string;
  nip: string;
  role: string;
  pillar: string;
  kpi: string;
  kpiScore: number;
  kpiNote: string;
  kpiColor: string;
  sopScore: number;
  sopInsidents: string;
  sopAlert?: boolean;
  competencyScore: number;
  coreValuesScore: number;
  potentialScore: number;
  rating360: string;
  reviewsCount: string;
  gpa: string;
  box: string;
  boxName: string;
  status: string;
  statusType: 'ready' | 'attention' | 'review';
  isProbation?: boolean;
  avatar: string;
}

export default function ManagerCockpitPage() {
  const [filterType, setFilterType] = useState<'all' | 'ready' | 'attention'>('all');
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Modal evaluation state
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [evalForm, setEvalForm] = useState({
    kpiScore: 92.5,
    sopScore: 96.0,
    competencyScore: 85.0,
    coreValuesScore: 90.0,
    potentialScore: 4.2,
  });
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [teamRoster, setTeamRoster] = useState<TeamMember[]>([
    {
      id: 'b0000000-0000-4000-8000-000000000004',
      name: 'Budi Pratama',
      nip: 'NIP: EMP-2022-0042',
      role: 'Senior Systems Architect',
      pillar: 'Internal Tech & Scalability',
      kpi: '96.8%',
      kpiScore: 96.8,
      kpiNote: '+4.8% SLA 99.98%',
      kpiColor: 'text-[#007a5a]',
      sopScore: 98.0,
      sopInsidents: '0 Insiden',
      competencyScore: 88.0,
      coreValuesScore: 92.0,
      potentialScore: 4.2,
      rating360: '4.8',
      reviewsCount: '12 Ulasan',
      gpa: '3.67',
      box: 'Kuadran 1',
      boxName: 'Future Leader / High Potential',
      status: 'Siap Kalibrasi',
      statusType: 'ready',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    },
    {
      id: 'b0000000-0000-4000-8000-000000000007',
      name: 'Anisa Wijaya, S.Ds.',
      nip: 'NIP: EMP-2023-0108',
      role: 'Product Designer (UI/UX)',
      pillar: 'Customer Experience & Design',
      kpi: '94.0%',
      kpiScore: 94.0,
      kpiNote: 'OKR Tercapai Sesuai Target',
      kpiColor: 'text-[#007a5a]',
      sopScore: 95.0,
      sopInsidents: '0 Insiden',
      competencyScore: 86.0,
      coreValuesScore: 90.0,
      potentialScore: 4.0,
      rating360: '4.7',
      reviewsCount: '14 Ulasan',
      gpa: '3.52',
      box: 'Kuadran 2',
      boxName: 'Growth Star / Top Talent',
      status: 'Siap Kalibrasi',
      statusType: 'ready',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
    },
    {
      id: 'b0000000-0000-4000-8000-000000000008',
      name: 'Dimas Prasetyo, S.Kom.',
      nip: 'NIP: EMP-2021-0089',
      role: 'DevOps & SRE Engineer',
      pillar: 'Infrastructure SLA & Security',
      kpi: '88.5%',
      kpiScore: 88.5,
      kpiNote: '-2.5% Target SLA Cloud',
      kpiColor: 'text-[#334155]',
      sopScore: 90.0,
      sopInsidents: '1 Tiket SLA',
      sopAlert: true,
      competencyScore: 82.0,
      coreValuesScore: 85.0,
      potentialScore: 3.5,
      rating360: '4.1',
      reviewsCount: '8 Ulasan',
      gpa: '3.41',
      box: 'Kuadran 5',
      boxName: 'Core Player / Steady Performer',
      status: 'Butuh Justifikasi',
      statusType: 'attention',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100',
    },
    {
      id: 'b0000000-0000-4000-8000-000000000009',
      name: 'Rian Hidayat, S.Kom.',
      nip: 'NIP: EMP-2024-0230',
      role: 'Junior Backend Developer',
      pillar: 'API Service & Architecture',
      kpi: '80.0%',
      kpiScore: 80.0,
      kpiNote: 'Evaluasi Probation Hari-90',
      kpiColor: 'text-[#0369a1]',
      sopScore: 87.5,
      sopInsidents: '0 Insiden',
      competencyScore: 78.0,
      coreValuesScore: 84.0,
      potentialScore: 3.2,
      rating360: '4.2',
      reviewsCount: '6 Ulasan',
      gpa: '2.85',
      box: 'Kuadran 4',
      boxName: 'Dilemma / Inconsistent',
      status: 'Evaluasi Probation',
      statusType: 'review',
      isProbation: true,
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100',
    },
  ]);

  // Task 8: hydrate GPA/rating/box dari API DB (override nilai demo bila tersedia).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/performance/team-roster');
        if (!res.ok) return;
        const json = await res.json();
        const members: Array<any> = json?.data?.members ?? [];
        if (!active || members.length === 0) return;
        setTeamRoster((prev) =>
          prev.map((m) => {
            const api = members.find((x) => x.employeeId === m.id);
            if (!api) return m;
            return {
              ...m,
              gpa: api.compositeGpa != null ? String(api.compositeGpa) : m.gpa,
              boxName: api.nineBoxQuadrant
                ? api.nineBoxQuadrant.replace(/_/g, ' ')
                : m.boxName,
            };
          })
        );
      } catch {
        /* biarkan nilai demo bila API tidak tersedia */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleOpenEval = (member: TeamMember) => {
    setSelectedMember(member);
    setEvalForm({
      kpiScore: member.kpiScore,
      sopScore: member.sopScore,
      competencyScore: member.competencyScore,
      coreValuesScore: member.coreValuesScore,
      potentialScore: member.potentialScore,
    });
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    setIsEvaluating(true);
    setApprovalMsg(null);
    try {
      const res = await fetch('/api/v1/performance/appraisals/calculate-gpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_id: 'd0000000-0000-4000-8000-000000000001',
          employee_id: selectedMember.id,
          kpi_actual_score: Number(evalForm.kpiScore),
          sop_compliance_score: Number(evalForm.sopScore),
          competency_gap_score: Number(evalForm.competencyScore),
          core_values_360_score: Number(evalForm.coreValuesScore),
          potential_assessment_score: Number(evalForm.potentialScore),
        }),
      });

      const json = await res.json();
      if (res.ok) {
        const data = json.data;
        setTeamRoster((prev) =>
          prev.map((m) =>
            m.id === selectedMember.id
              ? {
                  ...m,
                  gpa: Number(data.composite_gpa).toFixed(2),
                  box: `Kuadran (${data.nine_box_placement?.quadrant})`,
                  boxName: data.nine_box_placement?.strategic_action || 'Evaluated',
                  status: 'Terkalkulasi & Tersimpan',
                  statusType: 'ready',
                  kpiScore: evalForm.kpiScore,
                  sopScore: evalForm.sopScore,
                  competencyScore: evalForm.competencyScore,
                  coreValuesScore: evalForm.coreValuesScore,
                  potentialScore: evalForm.potentialScore,
                }
              : m
          )
        );
        setApprovalMsg(
          `Evaluasi kinerja untuk ${selectedMember.name} berhasil disimpan! GPA Komposit: ${data.composite_gpa} (Rating ${data.performance_rating} — ${data.nine_box_placement?.quadrant}).`
        );
        setSelectedMember(null);
      } else {
        setApprovalMsg(`Gagal: ${json.detail || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setApprovalMsg(`Error: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleApproveAll = async () => {
    setIsApproving(true);
    setApprovalMsg(null);
    try {
      const res = await fetch('/api/v1/performance/individual-kpis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpi_id: 'f0000000-0000-4000-8000-000000000001',
          action: 'APPROVE',
        }),
      });
      if (res.ok) {
        setApprovalMsg('Persetujuan sasaran KPI seluruh tim berhasil disahkan dan tercatat di audit trail PostgreSQL.');
      } else {
        const json = await res.json();
        setApprovalMsg(json.detail || 'Gagal menyetujui KPI tim.');
      }
    } catch {
      setApprovalMsg('Terjadi kesalahan koneksi.');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb Context */}
          <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[#64748b]">
              Division Workspace
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
              Siklus Aktif
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
            Tim Operasional & Engineering <span className="text-[#64748b] font-normal text-xl">(14 Anggota Langsung)</span>
          </h1>

          <p className="text-xs text-[#64748b] mt-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#94a3b8]" />
            <span>Evaluasi Q3 Berjalan &mdash; <strong>Sisa Waktu 6 Hari Kerja</strong> (Batas Kalibrasi: 30 September 2026)</span>
          </p>
        </div>

        {/* Right Buttons */}
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]">
            <Download className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Ekspor Rekapitulasi</span>
          </button>

          <button
            onClick={handleApproveAll}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5 text-white" />
            <span>{isApproving ? 'Menyetujui...' : 'Approve Semua Nilai Tim'}</span>
          </button>
        </div>
      </div>

      {/* Approval Status Alert */}
      {approvalMsg && (
        <div className="p-3 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd] text-xs font-semibold text-[#137333] flex items-center justify-between">
          <span>{approvalMsg}</span>
          <button onClick={() => setApprovalMsg(null)} className="text-[#137333] hover:underline font-bold">Tutup</button>
        </div>
      )}

      {/* 2. Four Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Rata-Rata Skor Tim
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              +0.18 vs Q2
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              91.2%
            </span>
            <span className="text-sm font-semibold text-[#64748b] ml-1">
              (GPA 3.65)
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#007a5a]" />
            <span className="text-xs text-[#334155] font-semibold">Tier A- (Sangat Baik)</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              Cascaded KPI Achievement
            </span>
            <span className="text-[11px] font-bold text-[#0369a1] bg-[#e0f2fe] px-1.5 py-0.5 rounded">
              94.1% Bobot
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              13/14
            </span>
            <span className="text-xs text-[#64748b] ml-2">Individu di atas target</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#0284c7]" />
            <span className="text-xs text-[#334155] font-semibold">On-Track Strategy</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              SOP Adherence Index
            </span>
            <span className="text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] px-1.5 py-0.5 rounded">
              1 Alert
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              98.4%
            </span>
            <span className="text-xs text-[#64748b] ml-2">Zero Major Breach</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#007a5a]" />
            <span className="text-xs text-[#334155] font-semibold">GCG Compliance</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="stitch-metric-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
              360 Feedback Status
            </span>
            <span className="text-[11px] font-bold text-[#137333] bg-[#e6f4ea] px-1.5 py-0.5 rounded">
              100% Selesai
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-[#0f172a] font-sans">
              42/42
            </span>
            <span className="text-xs text-[#64748b] ml-2">Ulasan Diterima</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#007a5a]" />
            <span className="text-xs text-[#334155] font-semibold">Siap Verifikasi</span>
          </div>
        </div>

      </div>

      {/* 3. Team Member Assessment & Goal Cascading Table */}
      <div className="stitch-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0f172a]">
              Team Member Assessment & Goal Cascading
            </h2>
            <p className="text-xs text-[#64748b] mt-0.5">
              Penilaian performa komprehensif, penyelarasan KPI Balanced Scorecard, dan kalibrasi kuadran 9-box talent matrix.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center rounded-lg bg-[#f1f5f9] p-0.5 text-xs font-semibold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-md transition-all ${filterType === 'all' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
              >
                Semua (14)
              </button>
              <button
                onClick={() => setFilterType('ready')}
                className={`px-3 py-1 rounded-md transition-all ${filterType === 'ready' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
              >
                Siap Review (8)
              </button>
              <button
                onClick={() => setFilterType('attention')}
                className={`px-3 py-1 rounded-md transition-all ${filterType === 'attention' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
              >
                Perlu Atensi (2)
              </button>
            </div>

            {/* Pillar Dropdown */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] hover:bg-[#f8fafc]">
              <Filter className="h-3 w-3 text-[#64748b]" />
              <span>Semua Pilar BSC</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#e2e8f0] text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
              <tr>
                <th className="py-2.5 px-3">Anggota Tim (Direct Report)</th>
                <th className="py-2.5 px-3">Pilar Strategis BSC</th>
                <th className="py-2.5 px-3 text-center">KPI Selesai (%)</th>
                <th className="py-2.5 px-3 text-center">Insiden SOP</th>
                <th className="py-2.5 px-3 text-center">360 Peer Review</th>
                <th className="py-2.5 px-3 text-center">Prediksi GPA & 9-Box</th>
                <th className="py-2.5 px-3 text-right">Status Kalibrasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {teamRoster
                .filter((r) => {
                  if (filterType === 'ready') return r.statusType === 'ready';
                  if (filterType === 'attention') return r.statusType === 'attention';
                  return true;
                })
                .map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                    {/* Column 1: Member */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={row.avatar}
                          alt={row.name}
                          className="h-9 w-9 rounded-full object-cover border border-[#e2e8f0]"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#0f172a]">{row.name}</span>
                            {row.isProbation && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#e0f2fe] text-[#0369a1]">
                                Probation
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#64748b]">
                            {row.nip} &bull; {row.role}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: BSC Pillar */}
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-1 rounded-md bg-[#f1f5f9] text-[#334155] font-medium text-[11px]">
                        {row.pillar}
                      </span>
                    </td>

                    {/* Column 3: KPI Selesai */}
                    <td className="py-3 px-3 text-center">
                      <span className={`font-bold font-mono text-xs ${row.kpiColor}`}>{row.kpi}</span>
                      <p className="text-[10px] text-[#64748b]">{row.kpiNote}</p>
                    </td>

                    {/* Column 4: SOP */}
                    <td className="py-3 px-3 text-center">
                      {row.sopAlert ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded">
                          <AlertTriangle className="h-3 w-3" />
                          {row.sopInsidents}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {row.sopInsidents}
                        </span>
                      )}
                    </td>

                    {/* Column 5: 360 Review */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-[#0f172a]">{row.rating360}</span>
                        <span className="text-[10px] text-[#64748b]">({row.reviewsCount})</span>
                      </div>
                    </td>

                    {/* Column 6: GPA & 9-Box */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-black text-[#0f172a] font-mono">{row.gpa}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1]">
                          {row.box}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748b] mt-0.5">{row.boxName}</p>
                    </td>

                    {/* Column 7: Status & Aksi Evaluasi */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {row.statusType === 'ready' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                            {row.status}
                          </span>
                        )}
                        {row.statusType === 'attention' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#c5221f]" />
                            {row.status}
                          </span>
                        )}
                        {row.statusType === 'review' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#0369a1]" />
                            {row.status}
                          </span>
                        )}
                        <button
                          onClick={() => handleOpenEval(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-[11px] font-bold shadow-xs transition-colors"
                        >
                          <Calculator className="h-3 w-3" />
                          <span>Evaluasi</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#f1f5f9] text-xs text-[#64748b]">
          <span>Menampilkan {teamRoster.length} bawahan langsung dalam cakupan evaluasi People Manager</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-lg border border-[#cbd5e1] text-xs hover:bg-[#f8fafc]">Sebelumnya</button>
            <button className="px-3 py-1 rounded-lg border border-[#cbd5e1] text-xs hover:bg-[#f8fafc]">Selanjutnya</button>
          </div>
        </div>
      </div>

      {/* 4. Tindakan Otorisasi & Tugas Segera (Action Drawer) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-[#0f172a]">
              Tindakan Otorisasi & Tugas Segera (Action Drawer)
            </h2>
          </div>
          <span className="text-xs text-[#64748b]">
            3 Item Memerlukan Tanda Tangan Manajerial
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Action 1: SOP Verification */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#c5221f] bg-[#fce8e6] px-2 py-0.5 rounded">
                  SLA Breached Exception
                </span>
                <span className="text-[11px] text-[#64748b]">2 Jam Lalu</span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                SOP & SLA Verification Needed
              </h3>

              <p className="text-xs text-[#64748b] leading-relaxed">
                Tiket keterlambatan SLA resolusi insiden produksi (#INC-8921) oleh <strong>Andika Wijaya</strong> memerlukan verifikasi log data center dan justifikasi manajerial sebelum nilai SOP dikalibrasi ke sistem GCG.
              </p>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b] hover:underline cursor-pointer">Lihat Log Bukti</span>
              <button className="px-3.5 py-1.5 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs">
                Review Justifikasi
              </button>
            </div>
          </div>

          {/* Action 2: 30-60-90 Days Review */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded">
                  Probation Milestone
                </span>
                <span className="text-[11px] text-[#64748b]">Jatuh Tempo: 2 Hari</span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                30-60-90 Days Probation Review
              </h3>

              <p className="text-xs text-[#64748b] leading-relaxed">
                <strong>Rizky Pratama</strong> (Jr. Cloud Engineer) telah memasuki Hari ke-60 masa percobaan. Peer review tim infrastruktur sudah lengkap (Skor 4.2/5.0).
              </p>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b] hover:underline cursor-pointer">Buku Catatan Mentor</span>
              <button className="px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs">
                Beri Nilai Evaluasi Tahap 2
              </button>
            </div>
          </div>

          {/* Action 3: Cascading KPI Sign-off */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded">
                  Balanced Scorecard
                </span>
                <span className="text-[11px] text-[#64748b]">Perencanaan Q4</span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                Cascading KPI Sign-off: Target Q4-2026
              </h3>

              <p className="text-xs text-[#64748b] leading-relaxed">
                2 usulan metrik KPI individu baru diajukan oleh Tim Arsitektur Sistem (termasuk efisiensi konsumsi cloud compute) membutuhkan otorisasi keselarasan pilar BSC divisi.
              </p>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b] hover:underline cursor-pointer">Lihat Matriks Bobot</span>
              <button
                onClick={handleApproveAll}
                disabled={isApproving}
                className="px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {isApproving ? 'Mengotorisasi...' : 'Otorisasi KPI Tim'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 5. Peninjauan Lamaran Internal (Kotak 3: Job Board & Mobilitas Internal) */}
      <InternalApplicationReview />

      {/* Modal Evaluasi Kinerja & Hitung GPA Tim */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-5 border border-[#e2e8f0] animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedMember.avatar}
                  alt={selectedMember.name}
                  className="h-10 w-10 rounded-full object-cover border border-[#e2e8f0]"
                />
                <div>
                  <h3 className="text-sm font-extrabold text-[#0f172a]">
                    Evaluasi Kinerja: {selectedMember.name}
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    {selectedMember.nip} &bull; {selectedMember.role}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)} className="text-[#64748b] hover:text-[#0f172a]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              <div className="space-y-3">
                {/* 1. KPI Score */}
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#334155]">1. Capaian Sasaran KPI SMART (Bobot: 50%)</span>
                    <span className="font-mono font-bold text-[#007a5a]">{evalForm.kpiScore}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={evalForm.kpiScore}
                    onChange={(e) => setEvalForm({ ...evalForm, kpiScore: parseFloat(e.target.value) })}
                    className="w-full accent-[#007a5a]"
                  />
                  <p className="text-[10px] text-[#64748b]">Kontribusi bobot: {((evalForm.kpiScore * 0.5)).toFixed(2)}%</p>
                </div>

                {/* 2. SOP Score */}
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#334155]">2. Kepatuhan Prosedur SOP & SLA (Bobot: 20%)</span>
                    <span className="font-mono font-bold text-[#0284c7]">{evalForm.sopScore}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={evalForm.sopScore}
                    onChange={(e) => setEvalForm({ ...evalForm, sopScore: parseFloat(e.target.value) })}
                    className="w-full accent-[#0284c7]"
                  />
                  <p className="text-[10px] text-[#64748b]">Kontribusi bobot: {((evalForm.sopScore * 0.2)).toFixed(2)}%</p>
                </div>

                {/* 3. Competency Score */}
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#334155]">3. Penguasaan Kompetensi Teknis (Bobot: 15%)</span>
                    <span className="font-mono font-bold text-[#0d9488]">{evalForm.competencyScore}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={evalForm.competencyScore}
                    onChange={(e) => setEvalForm({ ...evalForm, competencyScore: parseFloat(e.target.value) })}
                    className="w-full accent-[#0d9488]"
                  />
                  <p className="text-[10px] text-[#64748b]">Kontribusi bobot: {((evalForm.competencyScore * 0.15)).toFixed(2)}%</p>
                </div>

                {/* 4. Core Values */}
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#334155]">4. Nilai Luhur Budaya AKHLAK & 360° (Bobot: 15%)</span>
                    <span className="font-mono font-bold text-[#7c3aed]">{evalForm.coreValuesScore}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={evalForm.coreValuesScore}
                    onChange={(e) => setEvalForm({ ...evalForm, coreValuesScore: parseFloat(e.target.value) })}
                    className="w-full accent-[#7c3aed]"
                  />
                  <p className="text-[10px] text-[#64748b]">Kontribusi bobot: {((evalForm.coreValuesScore * 0.15)).toFixed(2)}%</p>
                </div>

                {/* 5. Potential */}
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#334155]">5. Potensi Suksesi Kepemimpinan (Skala 1.0 - 5.0)</span>
                    <span className="font-mono font-bold text-[#ea580c]">{evalForm.potentialScore} / 5.0</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={evalForm.potentialScore}
                    onChange={(e) => setEvalForm({ ...evalForm, potentialScore: parseFloat(e.target.value) })}
                    className="w-full accent-[#ea580c]"
                  />
                </div>
              </div>

              {/* Real-time Calculation Preview Card */}
              {(() => {
                const totalPct = Number(
                  (evalForm.kpiScore * 0.5 + evalForm.sopScore * 0.2 + evalForm.competencyScore * 0.15 + evalForm.coreValuesScore * 0.15).toFixed(2)
                );
                const gpa = Number(Math.min(4.0, (totalPct / 100) * 4.0).toFixed(2));
                const rating = totalPct >= 90 ? 'A' : totalPct >= 80 ? 'B' : totalPct >= 70 ? 'C' : 'D';
                return (
                  <div className="p-4 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#137333] uppercase tracking-wider block">
                        Kalkulasi Komposit GPA Real-Time
                      </span>
                      <p className="text-xs text-[#0f172a] font-bold mt-0.5">
                        Total Skor: {totalPct}% &bull; Rating Prediksi: {rating}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#007a5a] font-mono">
                        {gpa}
                      </span>
                      <span className="text-[11px] text-[#64748b] block font-mono">/ 4.00</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f1f5f9] rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isEvaluating}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] hover:bg-[#00684a] rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  <span>{isEvaluating ? 'Menghitung & Menyimpan...' : 'Hitung & Simpan Nilai ke PostgreSQL'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
