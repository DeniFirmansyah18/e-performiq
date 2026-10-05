'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
Download,
Send,
Target,
Compass,
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
Edit3,
X,
Trash2,
Sliders,
AlertCircle,
AlertTriangle,
Clock,
Bot,
Briefcase,
UserCheck,
Trophy,
} from 'lucide-react';
import TimesheetModal from '@/components/employee/TimesheetModal';
import PaySlipModal from '@/components/employee/PaySlipModal';
import CareerPathModal from '@/components/employee/CareerPathModal';
import HelpdeskChatbotDrawer from '@/components/employee/HelpdeskChatbotDrawer';
import ReimbursementModal from '@/components/employee/ReimbursementModal';
import HelpdeskTicketModal from '@/components/employee/HelpdeskTicketModal';
import KpiEvidenceUploadModal from '@/components/employee/KpiEvidenceUploadModal';
import JobBoardModal from '@/components/employee/JobBoardModal';
import LearningModule from '@/components/employee/LearningModule';
import OnboardingPanel from '@/components/employee/OnboardingPanel';
import AttendancePanel from '@/components/employee/AttendancePanel';
import MyProfileModal from '@/components/employee/MyProfileModal';
import FeatureGrid from '@/components/ui/FeatureGrid';
import FeatureCard from '@/components/ui/FeatureCard';
import ActionCard from '@/components/ui/ActionCard';
import ExpandablePanel from '@/components/ui/ExpandablePanel';
import AiAnalyzePanel from '@/components/ai/AiAnalyzePanel';

type EmployeeFeature = 'scorecard' | 'okr' | 'development';

export default function EmployeePortalPage() {
const { currentUser } = useAuth();
const [openFeature, setOpenFeature] = useState<EmployeeFeature | null>(null);
const [kpis, setKpis] = useState<any[]>([]);
const [scorecard, setScorecard] = useState<any | null>(null);
const [loading, setLoading] = useState(true);
const [selectedPeriod, setSelectedPeriod] = useState('d0000000-0000-4000-8000-000000000001');
const [selectedKpi, setSelectedKpi] = useState<any | null>(null);
const [newActual, setNewActual] = useState('');
const [weightModalKpi, setWeightModalKpi] = useState<any | null>(null);
const [editWeightVal, setEditWeightVal] = useState('');
const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
const [isUpdating, setIsUpdating] = useState(false);

// Modal states
const [isAddKpiOpen, setIsAddKpiOpen] = useState(false);
const [is360Open, setIs360Open] = useState(false);
const [isTreeOpen, setIsTreeOpen] = useState(false);
const [treeData, setTreeData] = useState<any | null>(null);

// Govera360 Modals
const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);
const [isPayslipOpen, setIsPayslipOpen] = useState(false);
const [isCareerOpen, setIsCareerOpen] = useState(false);
const [isChatbotOpen, setIsChatbotOpen] = useState(false);
const [isReimbursementOpen, setIsReimbursementOpen] = useState(false);
const [isTicketOpen, setIsTicketOpen] = useState(false);
const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
const [isJobBoardOpen, setIsJobBoardOpen] = useState(false);
const [isProfileOpen, setIsProfileOpen] = useState(false);

// New KPI Form State
const [kpiForm, setKpiForm] = useState({
title: '',
pillarId: 'c0000000-0000-4000-8000-000000000003',
periodId: 'd0000000-0000-4000-8000-000000000001',
target: '',
unit: '% On-Time',
weight: '10',
});

// 360 Feedback Form State
const [reviewForm, setReviewForm] = useState({
evaluateeId: 'b0000000-0000-4000-8000-000000000007', // Anisa Wijaya
evaluateeName: 'Anisa Wijaya, S.Ds. (Product Designer)',
integrity: 4.8,
collaboration: 4.5,
innovation: 4.2,
notes: 'Kolaborasi lintas tim engineering sangat komunikatif dan responsif dalam sprint perbaikan desain UI.',
});

const totalWeight = kpis.reduce((acc, k) => acc + (Number(k.kpi_weight) || 0), 0);
const remainingQuota = Math.max(0, 100 - totalWeight);

const loadKpis = useCallback(async (periodId: string = selectedPeriod) => {
setLoading(true);
try {
const res = await fetch(`/api/v1/performance/individual-kpis?period_id=${periodId}`);
if (res.ok) {
const json = await res.json();
setKpis(json.data?.items || []);
}
} catch {
// fallback
} finally {
setLoading(false);
}
}, [selectedPeriod]);

useEffect(() => {
loadKpis(selectedPeriod);
}, [loadKpis, selectedPeriod]);

// Task 8: muat scorecard GPA nyata milik karyawan dari DB.
useEffect(() => {
let active = true;
(async () => {
try {
const res = await fetch('/api/v1/performance/my-scorecard');
if (!res.ok) return;
const json = await res.json();
if (active) setScorecard(json?.data ?? null);
} catch {
/* biarkan nilai demo bila API tidak tersedia */
}
})();
return () => { active = false; };
}, []);

const handlePeriodChange = (periodId: string) => {
setSelectedPeriod(periodId);
setKpiForm((prev) => ({ ...prev, periodId }));
loadKpis(periodId);
};

const handleCreateKpi = async (e: React.FormEvent) => {
e.preventDefault();
setIsUpdating(true);
setStatusMsg(null);
try {
const res = await fetch('/api/v1/performance/individual-kpis', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
period_id: kpiForm.periodId,
employee_id: currentUser?.employeeId || '',
strategic_pillar_id: kpiForm.pillarId,
kpi_title: kpiForm.title,
target_value: Number(kpiForm.target),
unit_of_measure: kpiForm.unit,
kpi_weight: Number(kpiForm.weight),
}),
});
const json = await res.json();
if (res.ok) {
setStatusMsg({
type: 'success',
text: `Sasaran KPI '${kpiForm.title}' (bobot ${kpiForm.weight}%) berhasil diajukan dan tertaut ke Pilar Strategis BSC!`,
});
setIsAddKpiOpen(false);
setKpiForm({
title: '',
pillarId: 'c0000000-0000-4000-8000-000000000003',
periodId: selectedPeriod,
target: '',
unit: '% On-Time',
weight: '10',
});
if (kpiForm.periodId !== selectedPeriod) {
handlePeriodChange(kpiForm.periodId);
} else {
loadKpis(selectedPeriod);
}
} else {
setStatusMsg({ type: 'error', text: json.detail || 'Gagal mengajukan sasaran KPI baru.' });
}
} catch (err: any) {
setStatusMsg({ type: 'error', text: err.message });
} finally {
setIsUpdating(false);
}
};

const handleUpdateWeight = async (e: React.FormEvent) => {
e.preventDefault();
if (!weightModalKpi) return;
setIsUpdating(true);
setStatusMsg(null);
try {
const res = await fetch('/api/v1/performance/individual-kpis', {
method: 'PATCH',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
kpi_id: weightModalKpi.kpi_id,
action: 'UPDATE_WEIGHT',
kpi_weight: Number(editWeightVal),
}),
});
const json = await res.json();
if (res.ok) {
setStatusMsg({
type: 'success',
text: `Bobot KPI '${weightModalKpi.kpi_title}' berhasil disesuaikan menjadi ${editWeightVal}%! Kuota bobot diperbarui.`,
});
setWeightModalKpi(null);
setEditWeightVal('');
loadKpis(selectedPeriod);
} else {
setStatusMsg({ type: 'error', text: json.detail || 'Gagal menyesuaikan bobot KPI.' });
}
} catch (err: any) {
setStatusMsg({ type: 'error', text: err.message });
} finally {
setIsUpdating(false);
}
};

const handleDeleteKpi = async (kpi: any) => {
if (!confirm(`Apakah Anda yakin ingin menghapus KPI '${kpi.kpi_title}'? Bobot ${kpi.kpi_weight}% akan tersedia kembali sebagai kuota.`)) {
return;
}
setIsUpdating(true);
setStatusMsg(null);
try {
const res = await fetch(`/api/v1/performance/individual-kpis?kpi_id=${kpi.kpi_id}`, {
method: 'DELETE',
});
const json = await res.json();
if (res.ok) {
setStatusMsg({
type: 'success',
text: `KPI '${kpi.kpi_title}' berhasil dihapus. Kuota bobot ${kpi.kpi_weight}% kini bebas untuk dialokasikan!`,
});
loadKpis(selectedPeriod);
} else {
setStatusMsg({ type: 'error', text: json.detail || 'Gagal menghapus KPI.' });
}
} catch (err: any) {
setStatusMsg({ type: 'error', text: err.message });
} finally {
setIsUpdating(false);
}
};

const handleQuickFreeQuota = async (amount: number = 10) => {
if (kpis.length === 0) return;
const sorted = [...kpis].sort((a, b) => Number(b.kpi_weight) - Number(a.kpi_weight));
const target = sorted[0];
const currentW = Number(target.kpi_weight);
const newW = currentW - amount;
if (newW < 5) {
setStatusMsg({ type: 'error', text: `Tidak dapat mengurangi bobot '${target.kpi_title}' di bawah 5%. Silakan sesuaikan manual.` });
return;
}
setIsUpdating(true);
try {
const res = await fetch('/api/v1/performance/individual-kpis', {
method: 'PATCH',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
kpi_id: target.kpi_id,
action: 'UPDATE_WEIGHT',
kpi_weight: newW,
}),
});
const json = await res.json();
if (res.ok) {
setStatusMsg({
type: 'success',
text: `Bobot '${target.kpi_title}' dikurangi dari ${currentW}% ke ${newW}%. Kuota ${amount}% sekarang siap digunakan!`,
});
loadKpis(selectedPeriod);
} else {
setStatusMsg({ type: 'error', text: json.detail || 'Gagal mengurangi bobot.' });
}
} catch (err: any) {
setStatusMsg({ type: 'error', text: err.message });
} finally {
setIsUpdating(false);
}
};

const handleSubmit360 = async (e: React.FormEvent) => {
e.preventDefault();
setIsUpdating(true);
setStatusMsg(null);
try {
const res = await fetch('/api/v1/performance/360-reviews', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
period_id: 'd0000000-0000-4000-8000-000000000001',
evaluatee_id: reviewForm.evaluateeId,
relationship_type: 'PEER',
integrity_score: Number(reviewForm.integrity),
collaboration_score: Number(reviewForm.collaboration),
innovation_score: Number(reviewForm.innovation),
feedback_notes: reviewForm.notes,
}),
});
const json = await res.json();
if (res.ok) {
setStatusMsg({
type: 'success',
text: `Feedback 360° untuk rekan kerja berhasil dikirim secara anonim & terenkripsi ke database!`,
});
setIs360Open(false);
} else {
setStatusMsg({ type: 'error', text: json.detail || 'Gagal mengirim evaluasi 360°.' });
}
} catch (err: any) {
setStatusMsg({ type: 'error', text: err.message });
} finally {
setIsUpdating(false);
}
};

const handleOpenTree = async () => {
setIsTreeOpen(true);
if (!treeData) {
try {
const res = await fetch('/api/v1/performance/cascading-tree');
if (res.ok) {
const json = await res.json();
setTreeData(json.data);
}
} catch {
// fallback
}
}
};

const handleUpdateActual = async (e: React.FormEvent) => {
e.preventDefault();
if (!selectedKpi) return;
setIsUpdating(true);
setStatusMsg(null);
try {
const res = await fetch('/api/v1/performance/individual-kpis', {
method: 'PATCH',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
kpi_id: selectedKpi.kpi_id,
action: 'UPDATE_ACTUAL',
actual_value: Number(newActual),
}),
});
const json = await res.json();
if (res.ok) {
setStatusMsg({
type: 'success',
text: `Realisasi '${selectedKpi.kpi_title}' berhasil diperbarui menjadi ${newActual}! Achievement: ${json.data?.achievementPercentage}%`,
});
setSelectedKpi(null);
setNewActual('');
loadKpis();
} else {
setStatusMsg({ type: 'error', text: json.detail || 'Gagal memperbarui nilai realisasi.' });
}
} catch (err: any) {
setStatusMsg({ type: 'error', text: err.message });
} finally {
setIsUpdating(false);
}
};
return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      
  {/* 0. Header */}
  <div>
    <div className="flex items-center gap-2 text-xs text-[#64748b] mb-1.5">
      <span className="font-bold uppercase tracking-wider text-[#64748b]">
        Employee Growth Portal
      </span>
      <span className="font-semibold text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded text-[11px] border border-[#b7e1cd]">
        Employee Self-Service
      </span>
    </div>
    <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
      Employee Portal / Growth & Performance
    </h1>
  </div>

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

    </div>
  </div>

  {/* 2. Feature Card Grid (click to open) */}
  <FeatureGrid>
    <FeatureCard
      icon={Compass}
      title="Scorecard GPA"
      metric="4-Pilar"
      tag="Model GCG"
      description="Composite Performance Scorecard: KPI, SOP, Kompetensi, dan Core Values dengan formula bobot transparan."
      onOpen={() => setOpenFeature('scorecard')}
    />
    <FeatureCard
      icon={Target}
      title="Sasaran Kerja & OKR"
      metric={`${totalWeight}%`}
      tag="Cascading BSC"
      description="Sasaran kerja aktif yang terhubung hierarkis ke Balanced Scorecard perusahaan, lengkap dengan input realisasi."
      onOpen={() => setOpenFeature('okr')}
    />
    <FeatureCard
      icon={GraduationCap}
      title="Pengembangan & Pembelajaran"
      metric="Moodle"
      tag="IDP"
      description="Individual Development Plan, pelatihan, peer review 360°, talent legacy, dan modul pembelajaran Moodle."
      onOpen={() => setOpenFeature('development')}
    />
  </FeatureGrid>

  {/* 3. Aksi Cepat (kartu) */}
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Aksi Cepat</h2>
      <span className="text-[11px] text-[#64748b]">Layanan self-service karyawan</span>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <ActionCard
        icon={Clock}
        tone="emerald"
        title="Isi Timesheet Harian"
        tag="Timesheet"
        description="Catat jam kerja harian dan aktivitas Anda untuk periode berjalan."
        onClick={() => setIsTimesheetOpen(true)}
      />
      <ActionCard
        icon={Lock}
        tone="slate"
        title="Slip Gaji PIN"
        tag="Payroll"
        description="Akses slip gaji terenkripsi dengan verifikasi PIN pribadi Anda."
        onClick={() => setIsPayslipOpen(true)}
      />
      <ActionCard
        icon={Compass}
        tone="blue"
        title="Peta Karir & Moodle"
        tag="Karir"
        description="Telusuri jalur karir dan lanjutkan modul pembelajaran Moodle Anda."
        onClick={() => setIsCareerOpen(true)}
      />
      <ActionCard
        icon={UserCheck}
        tone="emerald"
        title="Profil Saya"
        tag="Self-Service"
        description="Perbarui data profil, kontak, dan informasi pribadi Anda."
        onClick={() => setIsProfileOpen(true)}
      />
      <ActionCard
        icon={Bot}
        tone="amber"
        title="Tanya Chatbot HR"
        tag="Bantuan"
        description="Ajukan pertanyaan seputar kebijakan HR & tata kelola perusahaan."
        onClick={() => setIsChatbotOpen(true)}
      />
      <ActionCard
        icon={FileText}
        tone="teal"
        title="Reimbursement"
        tag="Klaim"
        description="Ajukan penggantian biaya operasional dan pantau status klaim."
        onClick={() => setIsReimbursementOpen(true)}
      />
      <ActionCard
        icon={MessageSquare}
        tone="rose"
        title="Tiket Bantuan"
        tag="Helpdesk"
        description="Laporkan kendala atau ajukan permintaan dukungan internal."
        onClick={() => setIsTicketOpen(true)}
      />
      <ActionCard
        icon={Bookmark}
        tone="indigo"
        title="Unggah Bukti"
        tag="Evidence"
        description="Unggah dokumen bukti pencapaian untuk mendukung penilaian KPI."
        onClick={() => setIsEvidenceOpen(true)}
      />
      <ActionCard
        icon={Briefcase}
        tone="violet"
        title="Bursa Kerja Internal"
        tag="Mobilitas"
        description="Jelajahi peluang rotasi dan posisi internal yang tersedia."
        onClick={() => setIsJobBoardOpen(true)}
      />
      <ActionCard
        icon={Download}
        tone="slate"
        title="Unduh Portofolio KPI"
        tag="Dokumen"
        description="Unduh rekapitulasi portofolio KPI Anda dalam satu berkas."
        onClick={() => window.print()}
      />
      <ActionCard
        icon={Send}
        tone="emerald"
        title="Ajukan Finalisasi Q3"
        tag="Self-Appraisal"
        description="Kirim pengajuan finalisasi penilaian kinerja periode Q3 kepada atasan."
        onClick={() => setIsProfileOpen(true)}
      />
    </div>
  </div>

  {/* Panel: Scorecard GPA */}
  <ExpandablePanel open={openFeature === 'scorecard'} title="Composite Performance Scorecard" onClose={() => setOpenFeature(null)}>
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
              {scorecard?.compositeGpa != null ? Number(scorecard.compositeGpa).toFixed(2) : '3.67'}
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
                <Target className="h-3.5 w-3.5 text-[#007a5a]" />
                Cascaded KPI
              </div>
              <span className="text-xs font-bold text-[#0f172a] font-mono">{scorecard?.kpiCompositeScore != null ? Number((scorecard.kpiCompositeScore * 0.5).toFixed(2)) : '46.25'}%</span>
            </div>
            <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 50%</span>
            <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
              <span>Skor Aktual: <strong>{scorecard?.kpiCompositeScore != null ? Number(scorecard.kpiCompositeScore).toFixed(1) : '92.5'}%</strong></span>
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
              <span className="text-xs font-bold text-[#0f172a] font-mono">{scorecard?.sopComplianceScore != null ? Number((scorecard.sopComplianceScore * 0.2).toFixed(2)) : '19.20'}%</span>
            </div>
            <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 20%</span>
            <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
              <span>Skor Aktual: <strong>{scorecard?.sopComplianceScore != null ? Number(scorecard.sopComplianceScore).toFixed(1) : '96.0'}%</strong></span>
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
              <span className="text-xs font-bold text-[#0f172a] font-mono">{scorecard?.competencyScore != null ? Number((scorecard.competencyScore * 0.15).toFixed(2)) : '12.75'}%</span>
            </div>
            <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 15%</span>
            <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
              <span>Skor Aktual: <strong>{scorecard?.competencyScore != null ? Number(scorecard.competencyScore).toFixed(1) : '85.0'}%</strong></span>
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
              <span className="text-xs font-bold text-[#0f172a] font-mono">{scorecard?.coreValuesScore != null ? Number((scorecard.coreValuesScore * 0.15).toFixed(2)) : '13.50'}%</span>
            </div>
            <span className="text-[10px] text-[#64748b] block mt-0.5">Bobot: 15%</span>
            <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
              <span>Skor Aktual: <strong>{scorecard?.coreValuesScore != null ? Number(scorecard.coreValuesScore).toFixed(1) : '90.0'}%</strong></span>
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
    <AiAnalyzePanel feature="employee" />
  </ExpandablePanel>

  {/* Panel: Sasaran Kerja & Cascading OKR */}
  <ExpandablePanel open={openFeature === 'okr'} title="Sasaran Kerja & Cascading OKR Aktif" onClose={() => setOpenFeature(null)}>
  <div className="stitch-card-white p-6 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1f5f9] pb-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-extrabold text-[#0f172a]">
            Sasaran Kerja & Cascading OKR Aktif
          </h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            totalWeight === 100 ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#e0f2fe] text-[#0369a1]'
          }`}>
            Bobot Terpakai: {totalWeight}% / 100%
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            remainingQuota > 0 ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fef3c7] text-[#92400e]'
          }`}>
            Sisa Kuota: {remainingQuota}%
          </span>
        </div>
        <p className="text-xs text-[#64748b] mt-0.5">
          Setiap target individu terhubung secara hierarkis ke Balanced Scorecard (BSC) Perusahaan (PRD §8).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Period Selector Tabs */}
        <div className="flex items-center bg-[#f1f5f9] p-0.5 rounded-lg text-xs font-medium border border-[#e2e8f0]">
          <button
            type="button"
            onClick={() => handlePeriodChange('d0000000-0000-4000-8000-000000000001')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              selectedPeriod === 'd0000000-0000-4000-8000-000000000001'
                ? 'bg-white font-bold text-[#007a5a] shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            2026-Q3 (Aktif)
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange('d0000000-0000-4000-8000-000000000002')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              selectedPeriod === 'd0000000-0000-4000-8000-000000000002'
                ? 'bg-white font-bold text-[#007a5a] shadow-xs'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            2026-Q4 (Perencanaan)
          </button>
        </div>

        <button
          onClick={handleOpenTree}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] shadow-xs hover:bg-[#f8fafc] transition-colors cursor-pointer"
        >
          <GitBranch className="h-3.5 w-3.5 text-[#64748b]" />
          <span>Diagram Pohon BSC</span>
        </button>

        <button
          onClick={() => {
            setKpiForm((prev) => ({
              ...prev,
              periodId: selectedPeriod,
              weight: String(remainingQuota > 0 ? Math.min(10, remainingQuota) : 10),
            }));
            setIsAddKpiOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-white" />
          <span>Ajukan Milestone Baru</span>
        </button>
      </div>
    </div>

    {/* Corporate Objective Alignment Banner */}
    <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-[#334155]">
        <Compass className="h-4 w-4 text-[#007a5a] flex-shrink-0" />
        <div>
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block">
            Corporate Objective Alignment (PostgreSQL Live)
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

    {/* Status Notification */}
    {statusMsg && (
      <div className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
        statusMsg.type === 'success' ? 'bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]' : 'bg-[#fce8e6] text-[#c5221f] border border-[#f5c2c7]'
      }`}>
        <span>{statusMsg.text}</span>
        <button onClick={() => setStatusMsg(null)}><X className="h-3.5 w-3.5" /></button>
      </div>
    )}

    {/* Modal Update Actual */}
    {selectedKpi && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#e2e8f0]">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
            <h3 className="text-sm font-extrabold text-[#0f172a]">Input Nilai Realisasi KPI</h3>
            <button onClick={() => setSelectedKpi(null)} className="text-[#64748b] hover:text-[#0f172a] cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#0f172a]">{selectedKpi.kpi_title}</p>
            <p className="text-[11px] text-[#64748b]">Pilar: {selectedKpi.strategic_pillar_name} (Bobot: {selectedKpi.kpi_weight}%)</p>
            <p className="text-[11px] text-[#64748b]">Target: {selectedKpi.target_value}</p>
          </div>
          <form onSubmit={handleUpdateActual} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Nilai Realisasi Aktual Baru</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={newActual}
                onChange={(e) => setNewActual(e.target.value)}
                placeholder={`Masukkan angka (contoh: ${selectedKpi.target_value})`}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSelectedKpi(null)} className="px-3 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg cursor-pointer">Batal</button>
              <button type="submit" disabled={isUpdating} className="px-4 py-1.5 text-xs font-bold text-white bg-[#007a5a] hover:bg-[#00684a] rounded-lg shadow-sm cursor-pointer">
                {isUpdating ? 'Menyimpan...' : 'Simpan Realisasi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Modal Update Weight */}
    {weightModalKpi && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#e2e8f0]">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
            <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#0284c7]" />
              <span>Sesuaikan Bobot Sasaran KPI</span>
            </h3>
            <button onClick={() => setWeightModalKpi(null)} className="text-[#64748b] hover:text-[#0f172a] cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#0f172a]">{weightModalKpi.kpi_title}</p>
            <p className="text-[11px] text-[#64748b]">Bobot saat ini: <strong className="text-[#0f172a]">{weightModalKpi.kpi_weight}%</strong> &bull; Total bobot lain: <strong>{totalWeight - Number(weightModalKpi.kpi_weight)}%</strong></p>
            <p className="text-[11px] text-[#007a5a]">Maksimal bobot yang diizinkan untuk KPI ini: <strong>{100 - (totalWeight - Number(weightModalKpi.kpi_weight))}%</strong></p>
          </div>
          <form onSubmit={handleUpdateWeight} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Bobot Baru (%)</label>
              <input
                type="number"
                min="1"
                max={100 - (totalWeight - Number(weightModalKpi.kpi_weight))}
                required
                value={editWeightVal}
                onChange={(e) => setEditWeightVal(e.target.value)}
                placeholder="Contoh: 15"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
              />
              <span className="text-[10px] text-[#64748b] mt-1 block">
                Menurunkan bobot ini akan meluangkan kuota bobot bagi milestone baru.
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setWeightModalKpi(null)} className="px-3 py-1.5 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg cursor-pointer">Batal</button>
              <button type="submit" disabled={isUpdating} className="px-4 py-1.5 text-xs font-bold text-white bg-[#0284c7] hover:bg-[#0369a1] rounded-lg shadow-sm cursor-pointer">
                {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan Bobot'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Real Database KPIs from PostgreSQL */}
    <div className="space-y-4 pt-2">
      {kpis.length > 0 ? (
        kpis.map((kpi, idx) => (
          <div key={kpi.kpi_id} className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] border border-[#b7e1cd]">
                  KPI-0{idx + 1}
                </span>
                <h3 className="text-xs font-bold text-[#0f172a]">
                  {kpi.kpi_title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  kpi.status === 'APPROVED' ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fef3c7] text-[#92400e]'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${kpi.status === 'APPROVED' ? 'bg-[#137333]' : 'bg-[#d97706]'}`} />
                  {kpi.status === 'APPROVED' ? 'Disetujui Atasan' : 'Menunggu Approval'}
                </span>
                <button
                  onClick={() => {
                    setSelectedKpi(kpi);
                    setNewActual(String(kpi.actual_value));
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[#f1f5f9] text-[#007a5a] hover:bg-[#e6f4ea] border border-[#cbd5e1] cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Update Realisasi</span>
                </button>
                <button
                  onClick={() => {
                    setWeightModalKpi(kpi);
                    setEditWeightVal(String(kpi.kpi_weight));
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[#f1f5f9] text-[#0284c7] hover:bg-[#e0f2fe] border border-[#cbd5e1] cursor-pointer"
                  title="Sesuaikan bobot KPI ini"
                >
                  <Sliders className="h-3 w-3" />
                  <span>Ubah Bobot</span>
                </button>
                <button
                  onClick={() => handleDeleteKpi(kpi)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[#fef2f2] text-[#dc2626] hover:bg-rose-100 border border-[#fecaca] cursor-pointer"
                  title="Hapus sasaran KPI ini"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-[#64748b]">
              Pilar Strategis: <strong>{kpi.strategic_pillar_name}</strong> &bull; Perspektif BSC: <strong>{kpi.perspective}</strong>
            </p>

            <div className="flex flex-wrap items-center justify-between text-xs font-mono text-[#334155] pt-1">
              <span>Bobot: <strong>{kpi.kpi_weight}%</strong></span>
              <span>Target: <strong>{kpi.target_value}</strong></span>
              <span className="text-[#007a5a] font-bold">
                Realisasi: {kpi.actual_value} ({kpi.achievement_pct}%)
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 p-4 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] space-y-2">
          <p className="text-xs font-medium text-[#64748b]">
            {loading ? 'Memuat data KPI dari PostgreSQL...' : 'Belum ada sasaran KPI tercatat untuk periode ini.'}
          </p>
          {!loading && (
            <p className="text-[11px] text-[#007a5a] font-semibold">
              Sisa kuota bobot 100% tersedia! Klik &ldquo;Ajukan Milestone Baru&rdquo; untuk mulai merancang sasaran kerja.
            </p>
          )}
        </div>
      )}
    </div>
  </div>
    <AiAnalyzePanel feature="employee" />
  </ExpandablePanel>

  {/* Panel: Pengembangan Diri */}
  <ExpandablePanel open={openFeature === 'development'} title="Pengembangan Diri & Pembelajaran" onClose={() => setOpenFeature(null)}>
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

      <button
        onClick={() => setIs360Open(true)}
        className="w-full py-2.5 px-4 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
      >
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

  {/* Learning & Development (integrasi model Moodle) */}
  <div className="mt-5">
    <AttendancePanel />
  </div>
  <div className="mt-5">
    <OnboardingPanel />
  </div>
  <div className="mt-5">
    <LearningModule />
  </div>
    <AiAnalyzePanel feature="employee" />
  </ExpandablePanel>

  {/* Modal 1: Ajukan Sasaran KPI Baru */}
  {isAddKpiOpen && (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-[#e2e8f0] animate-fadeIn">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#007a5a]" />
              <span>Ajukan Sasaran Kerja / KPI Baru</span>
            </h3>
            <p className="text-[11px] text-[#64748b]">Wajib terhubung ke minimal 1 Pilar Strategis BSC (PRD §8).</p>
          </div>
          <button onClick={() => setIsAddKpiOpen(false)} className="text-[#64748b] hover:text-[#0f172a] cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quota Gauge */}
        <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#334155]">Alokasi Kuota Bobot Periode</span>
            <span className="font-mono text-xs font-bold text-[#0f172a]">
              {kpiForm.periodId === selectedPeriod ? totalWeight : 0}% / 100%
            </span>
          </div>
          <div className="w-full bg-[#e2e8f0] h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (kpiForm.periodId === selectedPeriod ? totalWeight : 0) >= 100 ? 'bg-[#007a5a]' : 'bg-[#0284c7]'
              }`}
              style={{ width: `${Math.min(100, kpiForm.periodId === selectedPeriod ? totalWeight : 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748b]">
              Status: <strong>{(kpiForm.periodId === selectedPeriod ? totalWeight : 0) >= 100 ? 'Kuota Penuh (100%)' : 'Tersedia'}</strong>
            </span>
            <span className={`font-semibold ${
              (kpiForm.periodId === selectedPeriod ? remainingQuota : 100) > 0 ? 'text-[#137333]' : 'text-[#c5221f]'
            }`}>
              Sisa Kuota: {kpiForm.periodId === selectedPeriod ? remainingQuota : 100}%
            </span>
          </div>
        </div>

        {/* Full Quota Assistance Banner */}
        {kpiForm.periodId === selectedPeriod && remainingQuota === 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>Total Bobot Periode 2026-Q3 Sudah 100%</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Sesuai standar BSC korporasi, total bobot KPI dibatasi maksimal 100%. Untuk mendaftarkan sasaran baru, pilih salah satu opsi cepat berikut:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setKpiForm((prev) => ({ ...prev, periodId: 'd0000000-0000-4000-8000-000000000002', weight: '15' }));
                }}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#007a5a] text-white hover:bg-[#00684a] shadow-xs cursor-pointer"
              >
                Pilih Periode 2026-Q4 (Kuota 100% Tersedia)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFreeQuota(10)}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 cursor-pointer"
              >
                Kurangi 10% dari KPI Lain Otomatis
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateKpi} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Periode Evaluasi</label>
              <select
                value={kpiForm.periodId}
                onChange={(e) => setKpiForm({ ...kpiForm, periodId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a] bg-white text-[#0f172a]"
              >
                <option value="d0000000-0000-4000-8000-000000000001">2026-Q3 (Fiskal Berjalan)</option>
                <option value="d0000000-0000-4000-8000-000000000002">2026-Q4 (Perencanaan)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Bobot Sasaran (%)</label>
              <input
                type="number"
                min="1"
                max={kpiForm.periodId === selectedPeriod ? (remainingQuota > 0 ? remainingQuota : 100) : 100}
                required
                value={kpiForm.weight}
                onChange={(e) => setKpiForm({ ...kpiForm, weight: e.target.value })}
                placeholder="Contoh: 10"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">Judul Sasaran KPI (SMART Target)</label>
            <input
              type="text"
              required
              placeholder="Contoh: Optimasi Waktu Respon API Microservices < 150ms"
              value={kpiForm.title}
              onChange={(e) => setKpiForm({ ...kpiForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">Pilar Strategis Balanced Scorecard (BSC)</label>
            <select
              value={kpiForm.pillarId}
              onChange={(e) => setKpiForm({ ...kpiForm, pillarId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a] bg-white text-[#0f172a]"
            >
              <option value="c0000000-0000-4000-8000-000000000001">Perspektif Finansial (Pertumbuhan & Efisiensi Anggaran)</option>
              <option value="c0000000-0000-4000-8000-000000000002">Perspektif Pelanggan (Kepuasan Stakeholder & CSAT)</option>
              <option value="c0000000-0000-4000-8000-000000000003">Perspektif Proses Bisnis Internal (Keunggulan Operasional & SLA)</option>
              <option value="c0000000-0000-4000-8000-000000000004">Perspektif Pembelajaran & Pertumbuhan (Kapabilitas SDM & AKHLAK)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Target Angka</label>
              <input
                type="number"
                step="any"
                required
                placeholder="Contoh: 100"
                value={kpiForm.target}
                onChange={(e) => setKpiForm({ ...kpiForm, target: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Satuan Pengukuran</label>
              <input
                type="text"
                required
                placeholder="% / ms / Sesi / Unit"
                value={kpiForm.unit}
                onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f5f9]">
            <button
              type="button"
              onClick={() => setIsAddKpiOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f1f5f9] rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUpdating || (kpiForm.periodId === selectedPeriod && remainingQuota === 0)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#007a5a] hover:bg-[#00684a] rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isUpdating ? 'Memvalidasi...' : 'Ajukan KPI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* Modal 2: Isi Ulasan 360° Anonim */}
  {is360Open && (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-[#e2e8f0] animate-fadeIn">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#0284c7]" />
              <span>Ulasan Kinerja 360° Multi-Rater (PRD §5.2)</span>
            </h3>
            <p className="text-[11px] text-[#64748b]">Jaminan anonimitas terenkripsi penuh sesuai standar tata kelola GCG.</p>
          </div>
          <button onClick={() => setIs360Open(false)} className="text-[#64748b] hover:text-[#0f172a]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit360} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">Pilih Rekan Kerja (Evaluatee)</label>
            <select
              value={reviewForm.evaluateeId}
              onChange={(e) => setReviewForm({ ...reviewForm, evaluateeId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#0284c7] bg-white text-[#0f172a]"
            >
              <option value="b0000000-0000-4000-8000-000000000007">Anisa Wijaya, S.Ds. — Product Designer UI/UX</option>
              <option value="b0000000-0000-4000-8000-000000000008">Dimas Prasetyo, S.Kom. — DevOps & SRE Engineer</option>
              <option value="b0000000-0000-4000-8000-000000000009">Rian Hidayat, S.Kom. — Junior Backend Developer</option>
            </select>
          </div>

          <div className="space-y-3 p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#334155]">1. Integritas & Etika Kerja (1.0 - 5.0):</span>
              <span className="font-mono font-bold text-[#007a5a] bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">{reviewForm.integrity} / 5.0</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={reviewForm.integrity}
              onChange={(e) => setReviewForm({ ...reviewForm, integrity: parseFloat(e.target.value) })}
              className="w-full accent-[#007a5a]"
            />

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="font-semibold text-[#334155]">2. Kolaborasi Lintas Fungsi (1.0 - 5.0):</span>
              <span className="font-mono font-bold text-[#0284c7] bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">{reviewForm.collaboration} / 5.0</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={reviewForm.collaboration}
              onChange={(e) => setReviewForm({ ...reviewForm, collaboration: parseFloat(e.target.value) })}
              className="w-full accent-[#0284c7]"
            />

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="font-semibold text-[#334155]">3. Inovasi & Inisiatif Solutif (1.0 - 5.0):</span>
              <span className="font-mono font-bold text-[#7c3aed] bg-white px-2 py-0.5 rounded border border-[#cbd5e1]">{reviewForm.innovation} / 5.0</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={reviewForm.innovation}
              onChange={(e) => setReviewForm({ ...reviewForm, innovation: parseFloat(e.target.value) })}
              className="w-full accent-[#7c3aed]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">Ulasan Kualitatif / Feedback Konstruktif</label>
            <textarea
              rows={3}
              required
              value={reviewForm.notes}
              onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
              placeholder="Berikan masukan yang membangun untuk rekan kerja Anda..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f5f9]">
            <button
              type="button"
              onClick={() => setIs360Open(false)}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#64748b] hover:bg-[#f1f5f9] rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#0284c7] hover:bg-[#0369a1] rounded-lg shadow-sm"
            >
              {isUpdating ? 'Mengenkripsi...' : 'Kirim Feedback 360°'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* Modal 3: Diagram Pohon Cascading BSC */}
  {isTreeOpen && (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 border border-[#e2e8f0] animate-fadeIn max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[#007a5a]" />
              <span>Pohon Cascading Sasaran Strategis (Goal Cascading Tree)</span>
            </h3>
            <p className="text-[11px] text-[#64748b]">Level 1 (Korporasi) &rarr; Level 2 (Divisi) &rarr; Level 3 (Unit) &rarr; KPI Individu</p>
          </div>
          <button onClick={() => setIsTreeOpen(false)} className="text-[#64748b] hover:text-[#0f172a]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <span className="text-[10px] font-bold text-[#007a5a] uppercase tracking-wider block mb-1">Visi & Misi Korporasi</span>
            <p className="font-bold text-[#0f172a]">{treeData?.level_0_vision?.description || 'Menjadi Perusahaan Teknologi Terkemuka di Asia Tenggara yang Berdampak Nyata'}</p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-xs text-[#334155]">Pilar Strategis Balanced Scorecard Aktif:</p>
            {(treeData?.level_2_strategic_pillars || []).map((p: any) => (
              <div key={p.pillar_id} className="p-3 rounded-xl border border-[#e2e8f0] bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0f172a]">{p.pillar_name}</span>
                  <span className="text-[10px] font-bold text-[#007a5a] bg-[#e6f4ea] px-2 py-0.5 rounded">Bobot: {p.strategic_weight_pct}%</span>
                </div>
                <p className="text-[11px] text-[#64748b]">{p.description}</p>
                {(p.level_3_corporate_kpis || []).map((corp: any) => (
                  <div key={corp.kpi_id} className="pl-3 border-l-2 border-[#007a5a] text-[11px] text-[#334155] space-y-1">
                    <p className="font-semibold text-[#0f172a]">Target Korporat: {corp.kpi_name} (Target: {corp.target_value} {corp.unit})</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-[#f1f5f9]">
          <button
            onClick={() => setIsTreeOpen(false)}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#0f172a] hover:bg-[#1e293b] rounded-lg"
          >
            Tutup Diagram
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Learning & Development telah dipindahkan ke Panel Pengembangan Diri */}

  <MyProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

  {/* Govera360 Modals */}
  <TimesheetModal
    isOpen={isTimesheetOpen}
    onClose={() => setIsTimesheetOpen(false)}
    onSuccess={(msg) => setStatusMsg({ type: 'success', text: msg })}
  />

  <PaySlipModal
    isOpen={isPayslipOpen}
    onClose={() => setIsPayslipOpen(false)}
  />

  <CareerPathModal
    isOpen={isCareerOpen}
    onClose={() => setIsCareerOpen(false)}
  />

  <ReimbursementModal
    isOpen={isReimbursementOpen}
    onClose={() => setIsReimbursementOpen(false)}
    onSuccess={(msg) => setStatusMsg({ type: 'success', text: msg })}
  />

  <HelpdeskTicketModal
    isOpen={isTicketOpen}
    onClose={() => setIsTicketOpen(false)}
    onSuccess={(msg) => setStatusMsg({ type: 'success', text: msg })}
  />

  <KpiEvidenceUploadModal
    isOpen={isEvidenceOpen}
    onClose={() => setIsEvidenceOpen(false)}
    onSuccess={(msg) => setStatusMsg({ type: 'success', text: msg })}
    kpiOptions={kpis.map((k: any) => ({ id: k.kpi_id ?? k.id, title: k.kpi_title }))}
  />

  <JobBoardModal
    isOpen={isJobBoardOpen}
    onClose={() => setIsJobBoardOpen(false)}
    onSuccess={(msg) => setStatusMsg({ type: 'success', text: msg })}
  />

  <HelpdeskChatbotDrawer
    isOpen={isChatbotOpen}
    onClose={() => setIsChatbotOpen(false)}
  />

</div>
);
}
