'use client';

import { createPortal } from 'react-dom';
import { nineBoxCopy, NINE_BOX_BOX_NUMBER } from '@/lib/employee/nineBoxLabels';
import type { NineBoxQuadrant } from '@/types';

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
  Users,
  Star as StarIcon,
  ClipboardCheck,
  Target,
  Mail,
  BookOpen,
} from 'lucide-react';
import InternalApplicationReview from '@/components/manager/InternalApplicationReview';
import DailyVerificationPanel from '@/components/governance/DailyVerificationPanel';
import KpiIndicatorPanel from '@/components/governance/KpiIndicatorPanel';
import TargetAchievementCard from '@/components/performance/TargetAchievementCard';
import FeatureGrid from '@/components/ui/FeatureGrid';
import FeatureCard from '@/components/ui/FeatureCard';
import ActionCard from '@/components/ui/ActionCard';
import ExpandablePanel from '@/components/ui/ExpandablePanel';
import AiAnalyzePanel from '@/components/ai/AiAnalyzePanel';
import LetterInboxModal from '@/components/employee/LetterInboxModal';
import PolicyLibraryModal from '@/components/employee/PolicyLibraryModal';

type ManagerFeature = 'roster' | 'approval' | 'evaluasi' | 'indikator';

/** Periode penilaian aktif yang dipakai seluruh panel cockpit manajer. */
const PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

/** Label kotak 9-Box — nomor & nama dari modul bersama (sebelumnya nomor kuadran di sini keliru). */
const QUADRANT_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(NINE_BOX_BOX_NUMBER).map(([code, no]) => [code, `Kotak ${no} — ${nineBoxCopy(code).name}`])
);

function statusTypeFor(pending: number, gpa: number | null): TeamMember['statusType'] {
  if (pending > 0) return 'attention';
  if (gpa != null) return 'ready';
  return 'review';
}

function statusLabelFor(pending: number, gpa: number | null): string {
  if (pending > 0) return `${pending} KPI Menunggu`;
  if (gpa != null) return 'Terkalkulasi';
  return 'Belum Dinilai';
}

/** Memetakan baris roster API ke model tampilan cockpit. */
function toTeamMember(raw: Record<string, any>): TeamMember {
  const gpa = raw.compositeGpa != null ? Number(raw.compositeGpa) : null;
  const pending = Number(raw.pendingKpiCount ?? 0);
  const achievement = raw.kpiAchievement != null ? Number(raw.kpiAchievement) : null;
  return {
    id: String(raw.employeeId),
    name: String(raw.fullName ?? '—'),
    nip: raw.employeeCode ? `NIP: ${raw.employeeCode}` : 'NIP: —',
    role: raw.position ?? '—',
    pillar: raw.department ?? '—',
    kpi: achievement != null ? `${achievement.toFixed(1)}%` : '—',
    kpiScore: achievement ?? 0,
    kpiNote:
      Number(raw.kpiCount ?? 0) === 0
        ? 'Belum ada KPI periode ini'
        : `${raw.kpiCount} KPI · ${raw.activeIndicatorCount ?? 0} indikator harian aktif`,
    kpiColor: achievement != null && achievement >= 90 ? 'text-[#007a5a]' : 'text-[#334155]',
    sopScore: 0,
    sopInsidents: '—',
    competencyScore: 0,
    coreValuesScore: 0,
    potentialScore: 3.5,
    rating360: '—',
    reviewsCount: '—',
    gpa: gpa != null ? gpa.toFixed(2) : '—',
    box: raw.nineBoxQuadrant ? String(raw.nineBoxQuadrant).replace(/_/g, ' ') : 'Belum ada',
    boxName: raw.nineBoxQuadrant
      ? QUADRANT_LABEL[String(raw.nineBoxQuadrant)] ?? 'Terkalibrasi'
      : 'Menunggu kalibrasi',
    status: statusLabelFor(pending, gpa),
    statusType: statusTypeFor(pending, gpa),
    avatar: '',
  };
}

interface ProbationMilestone {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  position: string;
  department: string;
  day30Score: number | null;
  day60Score: number | null;
  day90Score: number | null;
  managerNotes: string | null;
  probationPassed: boolean;
  conversionDate: string | null;
}

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
  const [openFeature, setOpenFeature] = useState<ManagerFeature | null>(null)
  const [isLetterOpen, setIsLetterOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
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
  const [isPullingDerived, setIsPullingDerived] = useState(false);

  // Live probation (30-60-90) milestones + evaluasi form.
  const [probations, setProbations] = useState<ProbationMilestone[]>([]);
  const [activeProbation, setActiveProbation] = useState<ProbationMilestone | null>(null);
  const [probationForm, setProbationForm] = useState({ day30: '', day60: '', day90: '', notes: '' });
  const [isSavingProbation, setIsSavingProbation] = useState(false);
  const [probationMsg, setProbationMsg] = useState<string | null>(null);

  // Roster nyata dari DB (bukan data demo). Diisi oleh /api/v1/performance/team-roster.
  const [teamRoster, setTeamRoster] = useState<TeamMember[]>([]);
  const [isRosterLoaded, setIsRosterLoaded] = useState(false);

  // Task 8: hydrate roster (identitas + KPI + GPA/9-box) dari API DB.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/performance/team-roster?period_id=${PERIOD_ID}`
        );
        if (!res.ok) return;
        const json = await res.json();
        const members: Array<Record<string, any>> = json?.data?.members ?? [];
        if (!active) return;
        setTeamRoster(members.map(toTeamMember));
      } catch {
        /* roster tetap kosong; UI menampilkan empty state */
      } finally {
        if (active) setIsRosterLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Probation (30-60-90) milestones — sumber data nyata untuk panel evaluasi.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/pre-employment/probation');
        if (!res.ok) return;
        const json = await res.json();
        const rows: ProbationMilestone[] = json?.data?.milestones ?? [];
        if (active) setProbations(rows);
      } catch {
        /* panel eval tetap tampil walau API tidak tersedia */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openProbationEval = (m: ProbationMilestone) => {
    setActiveProbation(m);
    setProbationMsg(null);
    setProbationForm({
      day30: m.day30Score != null ? String(m.day30Score) : '',
      day60: m.day60Score != null ? String(m.day60Score) : '',
      day90: m.day90Score != null ? String(m.day90Score) : '',
      notes: m.managerNotes ?? '',
    });
  };

  const submitProbationEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProbation) return;
    setIsSavingProbation(true);
    setProbationMsg(null);
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
    try {
      const res = await fetch(`/api/v1/pre-employment/probation/${activeProbation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_30_score: num(probationForm.day30),
          day_60_score: num(probationForm.day60),
          day_90_score: num(probationForm.day90),
          manager_notes: probationForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setProbationMsg('Skor evaluasi probation tersimpan.');
        setProbations((prev) =>
          prev.map((p) =>
            p.id === activeProbation.id
              ? {
                  ...p,
                  day30Score: num(probationForm.day30) ?? p.day30Score,
                  day60Score: num(probationForm.day60) ?? p.day60Score,
                  day90Score: num(probationForm.day90) ?? p.day90Score,
                  managerNotes: probationForm.notes || p.managerNotes,
                }
              : p
          )
        );
      } else {
        const json = await res.json().catch(() => ({}));
        setProbationMsg(json.detail || 'Gagal menyimpan evaluasi probation.');
      }
    } catch {
      setProbationMsg('Terjadi kesalahan koneksi.');
    } finally {
      setIsSavingProbation(false);
    }
  };

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

  const handlePullDerivedScores = async () => {
    if (!selectedMember) return;
    setIsPullingDerived(true);
    setApprovalMsg(null);
    try {
      const res = await fetch(
        `/api/v1/performance/gpa-preview?employee_id=${selectedMember.id}&period_id=${PERIOD_ID}`
      );
      const json = await res.json();
      if (res.ok && json.data) {
        const c = json.data.components ?? {};
        // SOP pakai nilai final (base × faktor disiplin) bila tersedia; jika tidak, base.
        const sopBase = c.sopScore?.value;
        const sopFinal = c.sopScore?.detail?.finalWithDiscipline ?? sopBase;
        const coreVal = c.coreValuesScore?.value;
        setEvalForm((prev) => ({
          ...prev,
          sopScore: sopFinal != null ? Number(sopFinal) : prev.sopScore,
          coreValuesScore: coreVal != null ? Number(coreVal) : prev.coreValuesScore,
        }));
        const missing = [
          c.sopScore?.source === 'missing' ? 'SOP' : null,
          c.coreValuesScore?.source === 'missing' ? 'penilaian rekan (360°)' : null,
        ].filter(Boolean);
        setApprovalMsg(
          missing.length
            ? `Skor ditarik dari data. Belum tersedia: ${missing.join(', ')} — KPI & Kompetensi diisi manual.`
            : 'Skor ditarik dari data sistem (KPI manual; SOP, disiplin, dan penilaian rekan otomatis).'
        );
      } else {
        setApprovalMsg(`Gagal menarik data: ${json.detail || 'Tidak ada data'}`);
      }
    } catch (err: any) {
      setApprovalMsg(`Error: ${err.message}`);
    } finally {
      setIsPullingDerived(false);
    }
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
          period_id: PERIOD_ID,
          employee_id: selectedMember.id,
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
                  box: `Kotak ${NINE_BOX_BOX_NUMBER[data.nine_box_placement?.quadrant as NineBoxQuadrant] ?? '-'}`,
                  boxName: data.nine_box_placement?.quadrant
                    ? `Kotak ${NINE_BOX_BOX_NUMBER[data.nine_box_placement.quadrant as NineBoxQuadrant] ?? '-'} — ${nineBoxCopy(String(data.nine_box_placement.quadrant)).name}`
                    : 'Belum dinilai',
                  status: 'Terkalkulasi & Tersimpan',
                  statusType: 'ready',
                  kpi: data.kpi_score != null ? `${Number(data.kpi_score).toFixed(1)}%` : m.kpi,
                  kpiScore: data.kpi_score != null ? Number(data.kpi_score) : m.kpiScore,
                  sopScore: evalForm.sopScore,
                  competencyScore: evalForm.competencyScore,
                  coreValuesScore: evalForm.coreValuesScore,
                  potentialScore: evalForm.potentialScore,
                }
              : m
          )
        );
        setApprovalMsg(
          `Evaluasi kinerja untuk ${selectedMember.name} berhasil disimpan! Nilai Kinerja: ${data.composite_gpa} (Rating ${data.performance_rating} — ${data.nine_box_placement?.quadrant}). Komponen KPI ${
            data.kpi_score_source === 'DERIVED' ? 'dihitung otomatis dari capaian KPI' : 'diisi manual'
          }: ${data.kpi_score ?? '—'}.`
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

  const handleExportRecap = () => {
    const header = ['Nama', 'Jabatan', 'KPI (%)', 'SOP', 'Kompetensi', 'Nilai Inti 360', 'Potensi', 'GPA', 'Kuadran', 'Status'];
    const rows = teamRoster.map((m) => [
      m.name,
      m.role,
      m.kpi,
      String(m.sopScore ?? ''),
      String(m.competencyScore ?? ''),
      String(m.coreValuesScore ?? ''),
      String(m.potentialScore ?? ''),
      m.gpa,
      m.box,
      m.status,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekapitulasi-kinerja-tim-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setApprovalMsg('Rekapitulasi kinerja tim berhasil diekspor ke format CSV.');
  };

  const handleApproveAll = async () => {
    setIsApproving(true);
    setApprovalMsg(null);
    try {
      const pending: Array<{ kpiId: string; title: string }> = [];
      for (const member of teamRoster) {
        const res = await fetch(
          `/api/v1/performance/individual-kpis?employee_id=${member.id}&period_id=${PERIOD_ID}`
        );
        if (!res.ok) continue;
        const json = await res.json();
        (json?.data?.items ?? []).forEach((k: any) => {
          if (k.status !== 'APPROVED') pending.push({ kpiId: k.kpi_id, title: k.kpi_title });
        });
      }

      if (pending.length === 0) {
        setApprovalMsg('Tidak ada sasaran KPI yang menunggu persetujuan di tim Anda.');
        return;
      }

      let okCount = 0;
      const failures: string[] = [];
      for (const item of pending) {
        try {
          const res = await fetch('/api/v1/performance/individual-kpis', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kpi_id: item.kpiId, action: 'APPROVE' }),
          });
          if (res.ok) okCount += 1;
          else {
            const json = await res.json().catch(() => ({}));
            failures.push(`${item.title}: ${json.detail || 'gagal'}`);
          }
        } catch {
          failures.push(`${item.title}: kesalahan koneksi`);
        }
      }

      setApprovalMsg(
        failures.length
          ? `${okCount} dari ${pending.length} sasaran KPI disetujui. Gagal — ${failures[0]}`
          : `${okCount} sasaran KPI tim berhasil disahkan dan tercatat di audit trail.`
      );

      // Segarkan roster agar status "menunggu" langsung hilang.
      const refreshed = await fetch(`/api/v1/performance/team-roster?period_id=${PERIOD_ID}`);
      if (refreshed.ok) {
        const json = await refreshed.json();
        setTeamRoster((json?.data?.members ?? []).map(toTeamMember));
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
          <button
            type="button"
            onClick={handleExportRecap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc]"
          >
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

      {/* 1. Verifikasi Kinerja Harian Tim (PRD v2 §5.5) */}
      <DailyVerificationPanel />

      {/* 2. Feature Card Grid (click to open) */}
      <FeatureGrid>
        <FeatureCard
          icon={Users}
          title="Roster Tim"
          metric={`${teamRoster.length} Anggota`}
          tag="People Manager"
          description="Metrik ringkasan tim: rata-rata skor, kesiapan evaluasi, dan status persetujuan dalam cakupan langsung."
          onOpen={() => setOpenFeature('roster')}
        />
        <FeatureCard
          icon={ClipboardCheck}
          title="Persetujuan KPI"
          metric="Tabel Evaluasi"
          tag="Target & Nilai"
          description="Tabel penilaian anggota tim: Target Kerja, Kepatuhan Prosedur, Penilaian Rekan (360°), Nilai Kinerja, dan posisi 9-Box."
          onOpen={() => setOpenFeature('approval')}
        />
        <FeatureCard
          icon={Calculator}
          title="Evaluasi Nilai Kinerja"
          metric="Action Drawer"
          tag="Otorisasi"
          description="Tindakan otorisasi manajerial, penghitungan nilai kinerja tim, dan peninjauan lamaran internal."
          onOpen={() => setOpenFeature('evaluasi')}
        />
        <FeatureCard
          icon={Target}
          title="Indikator KPI Harian"
          metric="CRUD & Rollup"
          tag="Target & Nilai"
          description="Tetapkan indikator harian tiap sasaran KPI, tarik realisasi harian menjadi capaian periode, lalu sahkan KPI anggota tim."
          onOpen={() => setOpenFeature('indikator')}
        />
      </FeatureGrid>

      {/* Aksi Cepat (kartu) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-[#0f172a]">Aksi Cepat Manajerial</h2>
          <span className="text-[11px] text-[#64748b]">Persetujuan, evaluasi &amp; ekspor</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            icon={CheckSquare}
            tone="emerald"
            title={isApproving ? 'Menyetujui...' : 'Setujui Semua Nilai Tim'}
            tag="Persetujuan"
            description="Setujui seluruh nilai evaluasi anggota tim sekaligus."
            onClick={handleApproveAll}
            disabled={isApproving}
          />
          <ActionCard
            icon={StarIcon}
            tone="amber"
            title="Evaluasi Nilai Kinerja Tim"
            tag="Nilai"
            description="Hitung dan tinjau nilai kinerja anggota tim Anda."
            onClick={() => setOpenFeature('evaluasi')}
          />
          <ActionCard
            icon={ClipboardCheck}
            tone="blue"
            title="Roster & Penugasan"
            tag="Tim"
            description="Tinjau roster tim dan status penugasan berjalan."
            onClick={() => setOpenFeature('roster')}
          />
          <ActionCard
            icon={Download}
            tone="slate"
            title="Ekspor Rekapitulasi"
            tag="Dokumen"
            description="Unduh rekapitulasi penilaian kinerja anggota tim."
            onClick={() => window.print()}
          />
          <ActionCard
            icon={Mail}
            tone="emerald"
            title="e-Surat & Disposisi"
            tag="Kepatuhan"
            description="Surat masuk, surat perintah, dan disposisi pimpinan beserta status tindak lanjutnya."
            onClick={() => setIsLetterOpen(true)}
          />
          <ActionCard
            icon={BookOpen}
            tone="emerald"
            title="SOP & Peraturan"
            tag="Wajib dibaca"
            description="Perpustakaan SOP, PP, dan SK aktif beserta kewajiban menandai telah dipahami."
            onClick={() => setIsPolicyOpen(true)}
          />
        </div>
        {/* Kartu "Roster & Penugasan" & "Evaluasi Nilai Kinerja Tim" membuka
            panelnya TEPAT DI BAWAH grid ini (pola sama dengan HR). */}
      <ExpandablePanel open={openFeature === 'roster'} title="Roster Tim" onClose={() => setOpenFeature(null)}>
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
              (Nilai Kinerja 3.65)
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
              Tingkat Kepatuhan Prosedur
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
              Status Penilaian Rekan (360°)
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
        <AiAnalyzePanel feature="manager" />
      </ExpandablePanel>
      <ExpandablePanel open={openFeature === 'evaluasi'} title="Tindakan Otorisasi & Evaluasi Nilai Kinerja" onClose={() => setOpenFeature(null)}>
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
              <button
                type="button"
                onClick={() => handleOpenEval(teamRoster.find((m) => m.name === 'Andika Wijaya') ?? teamRoster[0])}
                disabled={teamRoster.length === 0}
                className="px-3.5 py-1.5 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                Review Justifikasi
              </button>
            </div>
          </div>

          {/* Action 2: 30-60-90 Days Review (live probation milestones) */}
          <div className="stitch-card-white p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded">
                  Probation Milestone
                </span>
                <span className="text-[11px] text-[#64748b]">
                  {probations.filter((p) => !p.probationPassed).length} Karyawan Berjalan
                </span>
              </div>

              <h3 className="text-sm font-bold text-[#0f172a]">
                30-60-90 Days Probation Review
              </h3>

              {probations.length === 0 ? (
                <p className="text-xs text-[#64748b] leading-relaxed">
                  Belum ada catatan evaluasi probation pada basis data. Skor Hari-30/60/90 akan muncul di sini setelah HR membuat program onboarding karyawan.
                </p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {probations.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-[#e2e8f0] p-2.5 space-y-1.5 bg-[#f8fafc]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0f172a] truncate">{p.employeeName}</p>
                          <p className="text-[10px] text-[#64748b] truncate">{p.position} · {p.department}</p>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            p.probationPassed
                              ? 'bg-[#e6f4ea] text-[#137333]'
                              : 'bg-[#fef3c7] text-[#92400e]'
                          }`}
                        >
                          {p.probationPassed ? 'Lulus (Tetap)' : 'Probation'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#334155]">
                        <span className="font-semibold">H30</span> {p.day30Score ?? '—'}
                        <span className="mx-1 text-[#cbd5e1]">|</span>
                        <span className="font-semibold">H60</span> {p.day60Score ?? '—'}
                        <span className="mx-1 text-[#cbd5e1]">|</span>
                        <span className="font-semibold">H90</span> {p.day90Score ?? '—'}
                      </div>
                      <button
                        onClick={() => openProbationEval(p)}
                        className="w-full text-[11px] font-semibold text-[#0369a1] hover:text-[#075985] hover:underline text-left"
                      >
                        Isi / perbarui evaluasi →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <span className="text-xs text-[#64748b]">Sinkron dengan modul Pre-Employment</span>
              <button
                onClick={() => probations[0] && openProbationEval(probations[0])}
                disabled={probations.length === 0}
                className="px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Beri Nilai Evaluasi
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
        <AiAnalyzePanel feature="manager" />
      </ExpandablePanel>
      </div>

      {/* Indikator Pencapaian Target Tim */}
      <TargetAchievementCard periodId={PERIOD_ID} title="Indikator Pencapaian Target Tim" />

      {/* Panel: Roster Tim */}

      {/* Panel: Approval KPI (Team Table) */}
      <ExpandablePanel open={openFeature === 'approval'} title="Penilaian Tim & Goal Cascading" onClose={() => setOpenFeature(null)}>
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
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-medium text-[#334155]">
              <Filter className="h-3 w-3 text-[#64748b]" />
              <span>Semua Pilar BSC</span>
            </span>
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
                <th className="py-2.5 px-3 text-center">Insiden Prosedur</th>
                <th className="py-2.5 px-3 text-center">Penilaian Rekan</th>
                <th className="py-2.5 px-3 text-center">Nilai Kinerja & 9-Box</th>
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
                        {row.avatar ? (
                          <img
                            src={row.avatar}
                            alt={row.name}
                            className="h-9 w-9 rounded-full object-cover border border-[#e2e8f0]"
                          />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-[#e6f4ea] text-[#007a5a] border border-[#b7e1cd] flex items-center justify-center text-[11px] font-bold">
                            {row.name
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0]?.toUpperCase() ?? '')
                              .join('')}
                          </span>
                        )}
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

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#f1f5f9] text-xs text-[#64748b]">
          <span>Menampilkan seluruh {teamRoster.length} bawahan langsung dalam cakupan evaluasi People Manager</span>
          <span className="font-semibold text-[#334155]">Semua baris sudah ditampilkan</span>
        </div>
      </div>
        <AiAnalyzePanel feature="manager" />
      </ExpandablePanel>

      {/* Panel: Evaluasi GPA & Otorisasi */}

      <ExpandablePanel
        open={openFeature === 'indikator'}
        title="Indikator KPI Harian Tim"
        onClose={() => setOpenFeature(null)}
      >
        <KpiIndicatorPanel
          members={teamRoster.map((m) => ({
            employeeId: m.id,
            fullName: m.name,
            employeeCode: m.nip.replace(/^NIP:\s*/, ''),
            position: m.role,
            department: m.pillar,
          }))}
          periodId={PERIOD_ID}
        />
      </ExpandablePanel>

      {/* Modal Evaluasi Kinerja & Hitung Nilai Tim */}
      {selectedMember && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-5 border border-[#e2e8f0] animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div className="flex items-center gap-3">
                {selectedMember.avatar ? (
                  <img
                    src={selectedMember.avatar}
                    alt={selectedMember.name}
                    className="h-10 w-10 rounded-full object-cover border border-[#e2e8f0]"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-[#e6f4ea] text-[#007a5a] border border-[#b7e1cd] flex items-center justify-center text-xs font-bold">
                    {selectedMember.name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? '')
                      .join('')}
                  </span>
                )}
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
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
                <span className="text-[11px] text-[#64748b]">Skor bisa diisi manual, atau tarik otomatis dari data sistem.</span>
                <button
                  type="button"
                  onClick={handlePullDerivedScores}
                  disabled={isPullingDerived}
                  className="flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#007a5a] text-[#007a5a] hover:bg-[#ecfdf5] disabled:opacity-50 cursor-pointer"
                >
                  {isPullingDerived ? 'Menarik...' : 'Tarik dari data'}
                </button>
              </div>
              <div className="space-y-3">
                {/* 1. KPI Score */}
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#334155]">1. Capaian Target Kerja (Bobot: 50%)</span>
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
                    <span className="font-semibold text-[#334155]">2. Kepatuhan Prosedur & Tenggat (Bobot: 20%)</span>
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
                    <span className="font-semibold text-[#334155]">4. Sikap & Penilaian Rekan (360°) (Bobot: 15%)</span>
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
                        Nilai Kinerja Real-Time
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
        </div>,
        document.body
      )}

      {/* Modal Evaluasi Probation 30-60-90 */}
      {activeProbation && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={submitProbationEval} className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded">
                    Evaluasi Probation
                  </span>
                  <h3 className="text-base font-bold text-[#0f172a] mt-1.5">
                    {activeProbation.employeeName}
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    {activeProbation.position} · {activeProbation.department}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveProbation(null); setProbationMsg(null); }}
                  className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([['day30', 'Hari-30'], ['day60', 'Hari-60'], ['day90', 'Hari-90']] as const).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className="text-[11px] font-semibold text-[#334155] block">{label}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={probationForm[key]}
                      onChange={(e) => setProbationForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0369a1]/40"
                      placeholder="0-100"
                    />
                  </label>
                ))}
              </div>

              <label className="space-y-1 block">
                <span className="text-[11px] font-semibold text-[#334155] block">Catatan Manajerial</span>
                <textarea
                  rows={3}
                  value={probationForm.notes}
                  onChange={(e) => setProbationForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0369a1]/40"
                  placeholder="Observasi kinerja, sikap kerja, dan rekomendasi..."
                />
              </label>

              {probationMsg && (
                <p className="text-xs text-[#0f172a] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2">
                  {probationMsg}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={() => { setActiveProbation(null); setProbationMsg(null); }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f1f5f9] rounded-lg"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isSavingProbation}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] hover:bg-[#00684a] rounded-lg shadow-sm disabled:opacity-60"
                >
                  {isSavingProbation ? 'Menyimpan...' : 'Simpan Evaluasi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <LetterInboxModal open={isLetterOpen} onClose={() => setIsLetterOpen(false)} />
      <PolicyLibraryModal open={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />

    </div>
  );
}
