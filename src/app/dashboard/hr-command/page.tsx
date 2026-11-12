'use client';

import { createPortal } from 'react-dom';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Download,
  Scale,
  UserPlus,
  UserCheck,
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
  Users,
  GraduationCap,
  TrendingDown,
  Banknote,
  Target,
  Briefcase,
  ClipboardList,
  Building2,
  FileSignature,
  Coins,
  BookOpen,
  HeartPulse,
  Gavel,
  GitBranch,
  FileSpreadsheet,
  ChevronLeft,
  CalendarClock,
  PackageCheck,
  Users2,
} from 'lucide-react';
import CostOfWorkforceCard from '@/components/governance/CostOfWorkforceCard';
import FlightRiskHeatmap from '@/components/governance/FlightRiskHeatmap';
import CompanyActivityFeed from '@/components/governance/CompanyActivityFeed';
import LetterManagerPanel from '@/components/governance/LetterManagerPanel';
import PolicyManagerPanel from '@/components/governance/PolicyManagerPanel';
import SocialSecurityManagerPanel from '@/components/governance/SocialSecurityManagerPanel';
import DocumentVerificationPanel from '@/components/governance/DocumentVerificationPanel';
import DisciplinaryManagerPanel from '@/components/governance/DisciplinaryManagerPanel';
import CareerLadderManagerPanel from '@/components/governance/CareerLadderManagerPanel';
import LearningCertificationPanel from '@/components/governance/LearningCertificationPanel';
import PositionCourseMappingPanel from '@/components/governance/PositionCourseMappingPanel';
import RecruitmentPanel from '@/components/governance/RecruitmentPanel';
import ManpowerPlanManager from '@/components/governance/ManpowerPlanManager';
import InterviewSchedulerPanel from '@/components/governance/InterviewSchedulerPanel';
import TechnicalTestPanel from '@/components/governance/TechnicalTestPanel';
import EmployeeRegistrationPanel from '@/components/governance/EmployeeRegistrationPanel';
import ManagerAssignmentPanel from '@/components/governance/ManagerAssignmentPanel';
import LeaveApprovalPanel from '@/components/governance/LeaveApprovalPanel';
import PayrollPanel from '@/components/governance/PayrollPanel';
import HrDashboardCards from '@/components/governance/HrDashboardCards';
import HrKpiIndicatorPanel from '@/components/governance/HrKpiIndicatorPanel';
import TargetAchievementCard from '@/components/performance/TargetAchievementCard';
import WorkloadAnalysisPanel from '@/components/governance/WorkloadAnalysisPanel';
import CareerAndActionsPanel from '@/components/governance/CareerAndActionsPanel';
import PkwtDirectoryPanel from '@/components/governance/PkwtDirectoryPanel';
import HrOverviewAnalyticsPanel from '@/components/governance/HrOverviewAnalyticsPanel';
import HrLifecycleControlPanel from '@/components/governance/HrLifecycleControlPanel';
import EmployeeDirectoryPanel from '@/components/governance/EmployeeDirectoryPanel';
import RetirementPlanPanel from '@/components/governance/RetirementPlanPanel';
import ClearanceAssetPanel from '@/components/governance/ClearanceAssetPanel';
import ServiceLetterPanel from '@/components/governance/ServiceLetterPanel';
import PostEmploymentCompliancePanel from '@/components/governance/PostEmploymentCompliancePanel';
import AlumniDirectoryPanel from '@/components/governance/AlumniDirectoryPanel';
import ExitAnalyticsPanel from '@/components/governance/ExitAnalyticsPanel';
import FeatureCard from '@/components/ui/FeatureCard';
import ActionCard from '@/components/ui/ActionCard';
import ExpandablePanel from '@/components/ui/ExpandablePanel';
import AiAnalyzePanel from '@/components/ai/AiAnalyzePanel';
import { PHASES, PHASE_LABEL, PHASE_SUBTITLE, PHASE_TITLE, normalizePhase, phaseOf, type WorkPhase } from '@/lib/employee/phase';

type MainTab = 'overview' | 'lifecycle' | 'workload' | 'career-actions' | 'directory';
/**
 * Fitur yang bisa dibuka sebagai panel. Setiap kunci wajib terdaftar di
 * `FEATURE_PHASE` (`@/lib/employee/phase`) karena kartunya dirender per fase.
 */
type HrFeature = string | null;

const MAIN_TABS: MainTab[] = ['overview', 'lifecycle', 'workload', 'career-actions', 'directory'];

/** Label tab lifecycle pipeline; istilah teknis dipertahankan sebagai konteks. */
const PIPELINE_TAB_LABEL: Record<WorkPhase, string> = {
  PRE: 'Pra-Kerja (MPP & QoH)',
  DURING: 'Saat Kerja (GPA & 360)',
  POST: 'Pasca-Kerja (Clearance & Pesangon)',
};

const PHASE_STYLE: Record<WorkPhase, { frame: string; header: string; badge: string; icon: string }> = {
  PRE: {
    frame: 'border-[#c7e7d3]',
    header: 'border-[#d8ecdf] bg-[#e6f4ea]/40',
    badge: 'bg-[#e6f4ea]',
    icon: 'text-[#007a5a]',
  },
  DURING: {
    frame: 'border-[#bfe3f7]',
    header: 'border-[#cfe8f9] bg-[#e0f2fe]/40',
    badge: 'bg-[#e0f2fe]',
    icon: 'text-[#0284c7]',
  },
  POST: {
    frame: 'border-[#f5c6c0]',
    header: 'border-[#f7d5d0] bg-[#fce8e6]/40',
    badge: 'bg-[#fce8e6]',
    icon: 'text-[#dc2626]',
  },
};

/**
 * Panel tata kelola per fitur, masing-masing dengan fase siklusnya. Fase
 * ditentukan lewat `phaseOf(key)` dari `FEATURE_PHASE`, bukan dari urutan
 * render, sehingga penempatan tidak bisa melenceng lagi.
 *
 * `metric` & `tag` dipakai kartu fitur; `Panel` dirender di panelnya sendiri.
 * `action` menandai fitur yang membuka modal alih-alih panel.
 */
type HrFeatureIcon = React.ComponentType<{ className?: string }>;

const MPP_PANELS: ReadonlyArray<{
  feature: string;
  title: string;
  description: string;
  Panel: React.ComponentType;
  icon: HrFeatureIcon;
  metric?: string;
  tag?: string;
  action?: boolean;
}> = [
  {
    feature: 'mpp',
    title: 'Kelola MPP',
    description: 'Kuota formasi & budget, tersinkron ke form Buat Lowongan.',
    Panel: ManpowerPlanManager,
    icon: ClipboardList,
    metric: 'Kuota & Budget',
    tag: 'Pra-Kerja',
  },
  {
    feature: 'recruitment',
    title: 'Rekrutmen Kandidat',
    description: 'Portal karier publik, pipeline pelamar, dan kualitas rekrutmen.',
    Panel: RecruitmentPanel,
    icon: UserPlus,
    metric: 'Pipeline',
    tag: 'Pra-Kerja',
  },
  {
    feature: 'interview',
    title: 'Jadwal Wawancara',
    description: 'Penjadwalan wawancara dengan tautan meeting ke kandidat.',
    Panel: InterviewSchedulerPanel,
    icon: Calendar,
    metric: 'Jadwal',
    tag: 'Pra-Kerja',
  },
  {
    feature: 'technical-test',
    title: 'Bank Soal Tes Teknis',
    description: 'Generate soal dengan AI, tinjau, lalu setujui.',
    Panel: TechnicalTestPanel,
    icon: FileCheck,
    metric: 'Bank Soal',
    tag: 'Pra-Kerja',
  },
  {
    feature: 'registration',
    title: 'Registrasi Karyawan Mandiri',
    description: 'Verifikasi email kandidat lalu persetujuan HR.',
    Panel: EmployeeRegistrationPanel,
    icon: Building2,
    metric: 'Onboarding',
    tag: 'Pra-Kerja',
  },
  {
    feature: 'document-verification',
    title: 'Verifikasi Berkas Kepegawaian',
    description: 'Pemeriksaan kelengkapan & keabsahan berkas sebelum penempatan.',
    Panel: DocumentVerificationPanel,
    icon: FileCheck,
    metric: 'Berkas',
    tag: 'Pra-Kerja',
  },
  {
    feature: 'manager-assignment',
    title: 'Penugasan Atasan Langsung',
    description: 'Penetapan manager_id dan garis pelaporan karyawan aktif.',
    Panel: ManagerAssignmentPanel,
    icon: Users,
    metric: 'Garis Pelaporan',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'leave',
    title: 'Persetujuan Cuti & Izin',
    description: 'Antrian pengajuan cuti, izin, dan peninjauan saldo.',
    Panel: LeaveApprovalPanel,
    icon: Calendar,
    metric: 'Antrian Cuti',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'payroll',
    title: 'Payroll',
    description: 'Komponen gaji lengkap dengan AI advisory.',
    Panel: PayrollPanel,
    icon: Banknote,
    metric: 'Payroll',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'e-letter',
    title: 'Register e-Surat & Disposisi',
    description: 'Registrasi surat masuk/keluar dan alur disposisinya.',
    Panel: LetterManagerPanel,
    icon: Inbox,
    metric: 'e-Surat',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'policy',
    title: 'Perpustakaan SOP & Peraturan',
    description: 'Katalog SOP, PP, dan kebijakan perusahaan beserta versinya.',
    Panel: PolicyManagerPanel,
    icon: BookOpen,
    metric: 'SOP & PP',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'bpjs',
    title: 'Data BPJS Karyawan',
    description: 'Kepesertaan dan iuran BPJS Ketenagakerjaan/Kesehatan.',
    Panel: SocialSecurityManagerPanel,
    icon: HeartPulse,
    metric: 'BPJS',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'disciplinary',
    title: 'Sanksi & Keberatan',
    description: 'Pencatatan sanksi disiplin dan penanganan keberatan.',
    Panel: DisciplinaryManagerPanel,
    icon: Gavel,
    metric: 'Disiplin',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'career-ladder',
    title: 'Konfigurasi Jenjang Karir',
    description: 'Jenjang, syarat kenaikan, dan pemetaan kursus per posisi.',
    Panel: CareerLadderManagerPanel,
    icon: GitBranch,
    metric: 'Jenjang',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'scorecard',
    title: 'Indikator KPI & Realisasi Harian',
    description: 'Tetapkan indikator harian, tarik realisasi menjadi capaian periode, dan sahkan KPI karyawan.',
    Panel: HrKpiIndicatorPanel,
    icon: Target,
    metric: 'KPI Harian',
    tag: 'Saat-Kerja',
  },
  {
    feature: 'pipeline',
    title: 'Lifecycle Pipeline',
    description: 'Pemantauan SLA transisi karyawan: pra-kerja, saat kerja (GPA & 360), dan pasca-kerja (clearance).',
    Panel: () => null,
    icon: Activity,
    metric: '24 Aktif',
    tag: 'Milestone',
  },
  {
    feature: 'learning',
    title: 'Learning & Certification',
    description: 'Materi pembelajaran, pelacakan progres, dan sertifikasi otomatis setelah pelatihan mandatori.',
    Panel: () => null,
    icon: GraduationCap,
    metric: 'Moodle',
    tag: 'LMS',
  },
  {
    feature: 'cost',
    title: 'Cost & Risk',
    description: 'Cost of Workforce, Flight Risk Heatmap, dan clearance offboarding.',
    Panel: () => null,
    icon: TrendingDown,
    metric: 'Flight Risk',
    tag: 'Govera360',
  },
  {
    feature: 'iso-30414',
    title: 'Ekspor ISO 30414',
    description: 'Ekspor metrik human capital sesuai standar ISO 30414.',
    Panel: () => null,
    icon: Download,
    metric: 'Laporan',
    tag: 'Pasca-Kerja',
    action: true,
  },
  {
    feature: 'hr-dashboard',
    title: 'Ringkasan SDM & Pasca-Kerja',
    description: 'Agregasi metrik lintas modul, termasuk pasca-kerja.',
    Panel: HrDashboardCards,
    icon: Briefcase,
    metric: 'Agregat',
    tag: 'Pasca-Kerja',
  },
  {
    feature: 'retirement',
    title: 'Manajemen Pensiun & Kaderisasi',
    description: 'Proyeksi usia pensiun, penetapan pengganti, dan status alih pengetahuan.',
    Panel: RetirementPlanPanel,
    icon: CalendarClock,
    metric: 'Pensiun 58 th',
    tag: 'Pasca-Kerja',
  },
  {
    feature: 'clearance',
    title: 'Serah Terima Aset & Clearance',
    description: 'Checklist pengembalian aset dan persetujuan bebas tanggungan per unit kerja.',
    Panel: ClearanceAssetPanel,
    icon: PackageCheck,
    metric: 'Clearance',
    tag: 'Pasca-Kerja',
  },
  {
    feature: 'service-letter',
    title: 'Surat Keterangan Kerja',
    description: 'Terbitkan paklaring bernomor unik yang bisa diverifikasi pihak luar.',
    Panel: ServiceLetterPanel,
    icon: FileSignature,
    metric: 'Paklaring',
    tag: 'Pasca-Kerja',
  },
  {
    feature: 'offboarding-compliance',
    title: 'Kepatuhan Pasca-Kerja',
    description: 'Penonaktifan BPJS, 1721-A1, DPLK, dan penutupan berkas karyawan keluar.',
    Panel: PostEmploymentCompliancePanel,
    icon: ShieldCheck,
    metric: 'Kewajiban',
    tag: 'Pasca-Kerja',
  },
  {
    feature: 'alumni',
    title: 'Direktori Alumni',
    description: 'Mantan karyawan yang layak dipertimbangkan kembali dan bersedia dihubungi.',
    Panel: AlumniDirectoryPanel,
    icon: Users2,
    metric: 'Alumni',
    tag: 'Pasca-Kerja',
  },
  {
    feature: 'exit-analytics',
    title: 'Analitik Keluar & Biaya',
    description: 'Pola pengunduran diri, unit dengan atrisi tertinggi, dan nilai pesangon terbayar.',
    Panel: ExitAnalyticsPanel,
    icon: TrendingDown,
    metric: 'Atrisi',
    tag: 'Pasca-Kerja',
  },
];

/** Fitur satu fase, urut sesuai urutan kartu di blok fase. */
function panelsInPhase(phase: WorkPhase) {
  return MPP_PANELS.filter((panel) => phaseOf(panel.feature) === phase);
}

/** Membaca `?tab=` agar tautan dari rekomendasi HRD (mis. ?tab=directory) langsung terbuka. */
function resolveInitialTab(): MainTab {
  if (typeof window === 'undefined') return 'overview';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return (MAIN_TABS as string[]).includes(tab ?? '') ? (tab as MainTab) : 'overview';
}

/** Penggolongan kotak fitur per fase, agar mudah dipahami orang awam. */
/** Penggolongan kotak fitur per fase, agar mudah dipahami orang awam. */
const PANEL_GROUPS: Record<"PRE" | "DURING" | "POST", Array<{ judul: string; ket: string; fitur: string[] }>> = {
  PRE: [
    { judul: "Perencanaan Kebutuhan", ket: "Menentukan berapa orang yang dibutuhkan dan untuk posisi apa.", fitur: ["mpp"] },
    { judul: "Seleksi & Rekrutmen", ket: "Menarik pelamar, menguji kemampuan, dan menjadwalkan wawancara.", fitur: ["recruitment", "interview", "technical-test"] },
    { judul: "Penerimaan & Berkas", ket: "Mendaftarkan karyawan baru dan memeriksa kelengkapan berkasnya.", fitur: ["registration", "document-verification"] },
  ],
  DURING: [
    { judul: "Administrasi & Kehadiran", ket: "Urusan harian: atasan langsung, cuti, gaji, surat, dan SOP.", fitur: ["manager-assignment", "leave", "payroll", "e-letter", "policy"] },
    { judul: "Kesejahteraan & Kepatuhan", ket: "Jaminan sosial karyawan dan penanganan pelanggaran aturan.", fitur: ["bpjs", "disciplinary"] },
    { judul: "Pengembangan Kinerja", ket: "Mengatur jenjang karier dan memantau capaian kinerja.", fitur: ["career-ladder", "scorecard"] },
    { judul: "Pantauan & Wawasan", ket: "Gambaran menyeluruh untuk pengambilan keputusan.", fitur: ["pipeline", "learning", "cost"] },
  ],
  POST: [
    { judul: "Serah Terima & Pelaporan", ket: "Menyelesaikan aset, clearance, dan laporan sesuai regulasi.", fitur: ["iso-30414", "hr-dashboard", "clearance"] },
    { judul: "Hak & Dokumen Karyawan", ket: "Menyiapkan surat keterangan dan memenuhi kewajiban pasca-kerja.", fitur: ["service-letter", "offboarding-compliance"] },
    { judul: "Kaderisasi & Analitik", ket: "Menyiapkan pengganti, mendata alumni, dan menganalisis biaya keluar.", fitur: ["retirement", "alumni", "exit-analytics"] },
  ],
};

export default function HROperationsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [pipelineTab, setPipelineTab] = useState<WorkPhase>('PRE');
  // `activePhase` dibiarkan null sampai pengguna memilih fase: blok fase dan
  // panel MPP memakai nilai yang sama sehingga hanya satu fase yang dirender.
  const [activePhase, setActivePhase] = useState<WorkPhase | null>(null);
  const [openFeature, setOpenFeature] = useState<HrFeature>(null);
  // Panel fitur dirender tepat di bawah blok kartu fase, jadi posisinya perlu
  // dijadikan acuan scroll supaya panel yang dibuka langsung terlihat.
  const phaseBlockRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * Satu handler untuk semua pemilih fase agar transisi selalu atomik:
   * ganti fase sekaligus tutup panel fitur yang sedang terbuka, supaya isi
   * panel dari fase sebelumnya tidak ikut tampil di fase baru.
   */
  const selectPhase = useCallback((phase: WorkPhase) => {
    setOpenFeature(null);
    setActivePhase(phase);
  }, []);

  /**
   * Membuka satu fitur lalu menggulir ke panelnya, supaya pengguna tidak perlu
   * mencari panel yang terbuka secara manual.
   */
  const openPanelAtTop = useCallback((feature: string) => {
    setOpenFeature(feature);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const node = phaseBlockRef.current;
        // Beberapa lingkungan (jsdom pada tes) tidak menyediakan scrollIntoView.
        if (node && typeof node.scrollIntoView === 'function') {
          node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }, []);
  const [mppData, setMppData] = useState<any>(null);
  const [offboardings, setOffboardings] = useState<any[]>([]);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // Generate Program Onboarding (HR): pilih karyawan lalu buat program via LMS.
  const [employees, setEmployees] = useState<any[]>([]);
  const [onboardingEmployeeId, setOnboardingEmployeeId] = useState('');
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resMpp, resOff, resCand, resEmp] = await Promise.all([
        fetch('/api/v1/pre-employment/mpp-summary'),
        fetch('/api/v1/offboarding/initiate'),
        fetch('/api/v1/recruitment/candidates'),
        fetch('/api/v1/hr/employee-directory'),
      ]);
      if (resMpp.ok) {
        const json = await resMpp.json();
        setMppData(json.data);
      }
      if (resOff.ok) {
        const json = await resOff.json();
        setOffboardings(json.data || []);
      }
      if (resCand.ok) {
        const json = await resCand.json();
        setCandidates(json.data?.candidates || []);
      }
      if (resEmp.ok) {
        const json = await resEmp.json();
        setEmployees(json.data?.employees || []);
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

  // Hormati deep-link `?tab=` setelah hidrasi agar tautan rekomendasi HRD tepat sasaran.
  const [deepLinkEmployeeId, setDeepLinkEmployeeId] = useState<string | undefined>();
  const [deepLinkSearch, setDeepLinkSearch] = useState<string | undefined>();

  // Berjalan ulang setiap kali query berubah supaya tautan "Tinjau" di tab yang
  // sama tetap berpindah (navigasi client-side tidak me-remount halaman ini).
  useEffect(() => {
    const applyDeepLink = () => {
      setMainTab(resolveInitialTab());
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      setDeepLinkEmployeeId(params.get('employeeId') ?? undefined);
      setDeepLinkSearch(params.get('search') ?? undefined);
      // `?feature=` membuka panel fitur tertentu; hanya fitur yang benar-benar ada
      // yang diterima supaya panel kosong tidak pernah terbuka.
      const feature = params.get('feature');
      setOpenFeature(feature && MPP_PANELS.some((p) => p.feature === feature) ? feature : null);
      // `?phase=` membuka fase lifecycle tertentu langsung (mis. Offboarding → POST).
      const phase = params.get('phase');
      if (phase) {
        const resolved = normalizePhase(phase, 'PRE');
        setPipelineTab(resolved);
        setActivePhase(resolved);
      }
    };

    applyDeepLink();
    window.addEventListener('popstate', applyDeepLink);

    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;

    window.history.pushState = function pushState(...args: Parameters<History['pushState']>) {
      const ret = originalPush.apply(this, args);
      applyDeepLink();
      return ret;
    };
    window.history.replaceState = function replaceState(...args: Parameters<History['replaceState']>) {
      const ret = originalReplace.apply(this, args);
      // `replaceState` juga dipakai Next.js saat hidrasi; hindari loop tak berujung.
      return ret;
    };

    return () => {
      window.removeEventListener('popstate', applyDeepLink);
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleGenerateOnboarding = async () => {
    if (!onboardingEmployeeId) {
      setActionNotice('Pilih karyawan terlebih dahulu.');
      return;
    }
    setIsOnboardingSubmitting(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/v1/recruitment/onboarding/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: onboardingEmployeeId }),
      });
      const json = await res.json();
      if (res.ok) {
        const employee = employees.find((emp) => emp.employeeId === onboardingEmployeeId);
        setActionNotice(
          `Program onboarding untuk '${employee?.fullName || 'karyawan'}' berhasil dibuat. ${json.message || ''}`.trim()
        );
        setOnboardingEmployeeId('');
      } else {
        setActionNotice(`Gagal: ${json.detail || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  const handleExportIso = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Kode MPP,Departemen,Posisi,Alokasi Budget IDR,Realisasi Budget IDR,Kuota Disetujui,Terisi,Status SLA\n' +
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

  const handleDisburseSeverance = async (severanceId: string, requestId: string) => {
    setDisbursingId(requestId);
    try {
      const res = await fetch('/api/v1/offboarding/disburse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severance_id: severanceId }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionNotice(json?.data?.message || 'Pesangon berhasil dicairkan.');
        loadData();
      } else {
        setActionNotice(`Gagal: ${json.detail || json.error?.message || json.message || 'Terjadi kesalahan pencairan.'}`);
      }
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setDisbursingId(null);
    }
  };

  const phasePanels = activePhase === null ? [] : panelsInPhase(activePhase);

  /** Fitur yang isinya bergantung state halaman ini dirender inline. */
  const renderFeatureContent = (feature: string): React.ReactNode => {
    switch (feature) {
      case 'learning':
        return (
          <div>
            <div className="stitch-card-white p-6 mb-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-4">
                <GraduationCap className="w-5 h-5 text-[#007a5a]" />
                <div>
                  <h2 className="text-base font-extrabold text-[#0f172a]">Generate Program Onboarding</h2>
                  <p className="text-xs text-slate-500">
                    Buat program onboarding LMS (learning plan + kursus wajib posisi) untuk karyawan baru.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Karyawan</label>
                  <select
                    value={onboardingEmployeeId}
                    onChange={(e) => setOnboardingEmployeeId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                  >
                    <option value="">— Pilih karyawan —</option>
                    {employees.map((emp) => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.fullName}
                        {emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                        {emp.position ? ` — ${emp.position}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateOnboarding}
                  disabled={isOnboardingSubmitting || !onboardingEmployeeId}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#007a5a] text-white text-xs font-bold hover:bg-[#00664b] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GraduationCap className="w-4 h-4" />
                  {isOnboardingSubmitting ? 'Memproses...' : 'Generate Program Onboarding'}
                </button>
              </div>
            </div>
            <LearningCertificationPanel />
            <PositionCourseMappingPanel />
          </div>
        );
      case 'cost':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CostOfWorkforceCard />
            <FlightRiskHeatmap />
            <CompanyActivityFeed />
          </div>
        );
      default:
        return null;
    }
  };

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
          <div className="relative">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-medium text-[#334155]">
              <Calendar className="h-3.5 w-3.5 text-[#64748b]" />
              <span>2026-Q3 (Jul - Sep 2026)</span>
            </span>
          </div>

          <button 
            onClick={handleExportIso}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-medium text-[#334155] shadow-xs hover:bg-[#f8fafc] cursor-pointer">
            <Download className="h-3.5 w-3.5 text-[#64748b]" />
            <span>Ekspor ISO 30414</span>
          </button>

          <Link
            href="/dashboard/employee-portal"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#007a5a] bg-[#007a5a] text-xs font-semibold text-white shadow-xs hover:bg-[#00684a] transition-colors"
            title="Buka Employee Growth Portal untuk melihat data pribadi Anda"
          >
            <UserCheck className="h-3.5 w-3.5 text-white" />
            <span>Portal Saya</span>
          </Link>
        </div>
      </div>

                  {actionNotice && (
                    <div className="mb-3 flex items-center justify-between rounded-lg border border-[#b7e1cd] bg-[#e6f4ea] p-3 text-xs font-semibold text-[#137333]">
                      <span>{actionNotice}</span>
                      <button
                        onClick={() => setActionNotice(null)}
                        className="font-bold underline"
                      >
                        Tutup
                      </button>
                    </div>
                  )}

                  {/* Navigasi Utama Tab Command Center Narasi 3 */}
                  <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2 overflow-x-auto">
                    <button
                      onClick={() => setMainTab('overview')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        mainTab === 'overview'
                          ? 'bg-[#007a5a] text-white shadow-sm'
                          : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
                      }`}
                    >
                      Ringkasan &amp; Analitik
                    </button>
                    <button
                      onClick={() => setMainTab('lifecycle')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        mainTab === 'lifecycle'
                          ? 'bg-[#007a5a] text-white shadow-sm'
                          : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
                      }`}
                    >
                      Kontrol Siklus 3-Fase
                    </button>
                    <button
                      onClick={() => setMainTab('workload')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        mainTab === 'workload'
                          ? 'bg-[#007a5a] text-white shadow-sm'
                          : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
                      }`}
                    >
                      Analisis Beban Kerja & Waktu
                    </button>
                    <button
                      onClick={() => setMainTab('career-actions')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        mainTab === 'career-actions'
                          ? 'bg-[#007a5a] text-white shadow-sm'
                          : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
                      }`}
                    >
                      Rekomendasi Aksi & Karir
                    </button>
                    <button
                      onClick={() => setMainTab('directory')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        mainTab === 'directory'
                          ? 'bg-[#007a5a] text-white shadow-sm'
                          : 'bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]'
                      }`}
                    >
                      Direktori Pegawai & Status PKWT
                    </button>
                  </div>

                  {mainTab === 'workload' && <WorkloadAnalysisPanel />}
                  {mainTab === 'career-actions' && <CareerAndActionsPanel employeeId={deepLinkEmployeeId} />}
                  {mainTab === 'directory' && (
                    <div className="space-y-6">
                      <PkwtDirectoryPanel initialSearch={deepLinkSearch} />
                      <EmployeeDirectoryPanel initialSearch={deepLinkSearch} />
                    </div>
                  )}

                  {mainTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Ringkasan & sebaran talenta lebih dulu, indikator target menyusul. */}
                      <HrOverviewAnalyticsPanel />
                      <TargetAchievementCard title="Indikator Pencapaian Target Organisasi" />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CostOfWorkforceCard />
                        <FlightRiskHeatmap />
                      </div>
                      <CompanyActivityFeed />
                    </div>
                  )}

                  {mainTab === 'lifecycle' && (
                    <div className="space-y-3" ref={phaseBlockRef}>
                      {/* Kartu tahap di dalam panel sudah menjadi pemilih fase —
                          tidak perlu tombol fase tambahan di bawahnya. */}
                      <HrLifecycleControlPanel
                        phase={activePhase ?? 'PRE'}
                        showPhaseSwitch
                        onPhaseChange={(next) => selectPhase(next)}
                      />

                      {activePhase === null ? (
                        <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-5 py-8 text-center">
                          <Scale className="mx-auto h-5 w-5 text-[#94a3b8]" />
                          <p className="mt-2 text-sm font-bold text-[#0f172a]">Pilih fase siklus karyawan</p>
                          <p className="mt-1 text-xs text-[#64748b]">
                            Tampilkan satu fase saja — fitur fase lain tidak akan ikut muncul.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-[#e2e8f0] bg-white overflow-hidden">
                          <div className={`flex items-center gap-2.5 border-b px-4 py-3 ${PHASE_STYLE[activePhase].header}`}>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${PHASE_STYLE[activePhase].badge}`}>
                          {activePhase === 'PRE' ? (
                            <Inbox className={`h-4 w-4 ${PHASE_STYLE[activePhase].icon}`} />
                          ) : activePhase === 'DURING' ? (
                            <Activity className={`h-4 w-4 ${PHASE_STYLE[activePhase].icon}`} />
                          ) : (
                            <LogOut className={`h-4 w-4 ${PHASE_STYLE[activePhase].icon}`} />
                          )}
                        </span>
                        <div>
                          <h3 className="text-sm font-extrabold text-[#0f172a]">{PHASE_TITLE[activePhase]}</h3>
                          <p className="text-[11px] text-[#64748b]">{PHASE_SUBTITLE[activePhase]}</p>
                        </div>
                      </div>
                        <div className="p-4 space-y-5">
                          {/* Kotak dikelompokkan per tujuan agar tidak campur aduk.
                              Fitur yang tidak masuk golongan mana pun ditampung di akhir. */}
                          {(() => {
                            const grupFase = PANEL_GROUPS[activePhase];
                            const sudahDitampung = new Set<string>(grupFase.flatMap((g) => g.fitur));
                            const sisa = phasePanels.filter((p) => !sudahDitampung.has(p.feature));

                            const renderKotak = (panel: any) =>
                              panel.action ? (
                                <ActionCard
                                  key={panel.feature}
                                  icon={panel.icon}
                                  tone="emerald"
                                  title={panel.title}
                                  tag={panel.tag}
                                  description={panel.description}
                                  onClick={() =>
                                    panel.feature === 'iso-30414' ? handleExportIso() : undefined
                                  }
                                />
                              ) : (
                                <FeatureCard
                                  key={panel.feature}
                                  icon={panel.icon}
                                  title={panel.title}
                                  metric={panel.metric}
                                  tag={panel.tag}
                                  description={panel.description}
                                  onOpen={() => openPanelAtTop(panel.feature)}
                                />
                              );

                            return (
                              <>
                                {grupFase.map((grup, gi) => {
                                  const isi = grup.fitur
                                    .map((kode) => phasePanels.find((p) => p.feature === kode))
                                    .filter(Boolean);
                                  if (isi.length === 0) return null;
                                  return (
                                    <section key={grup.judul}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e6f4ea] text-[10px] font-extrabold text-[#137333]">
                                          {gi + 1}
                                        </span>
                                        <h4 className="text-xs font-extrabold text-[#0f172a]">{grup.judul}</h4>
                                      </div>
                                      <p className="text-[11px] text-[#64748b] mb-2.5">{grup.ket}</p>
                                      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {isi.map(renderKotak)}
                                      </div>
                                      {/* Panel fitur golongan ini, tampil tepat di bawah kartunya. */}
                                      {openFeature && isi.some((p: any) => p.feature === openFeature && !p.action) && (
                                        <div className="mt-4">
                                          {phasePanels
                                            .filter((panel) => !panel.action && panel.feature === openFeature)
                                            .map((panel) => (
                                              <ExpandablePanel
                                                key={`grup-${panel.feature}`}
                                                open
                                                title={panel.title}
                                                onClose={() => setOpenFeature(null)}
                                              >
                                                <div className="space-y-4">
                                                  <button
                                                    type="button"
                                                    onClick={() => setOpenFeature(null)}
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#007a5a] hover:underline"
                                                  >
                                                    <ChevronLeft className="h-3.5 w-3.5" /> Tutup dan kembali ke daftar fitur
                                                  </button>
                                                  <panel.Panel />
                                                  {renderFeatureContent(panel.feature)}
                                                  <AiAnalyzePanel feature="hr" />
                                                </div>
                                              </ExpandablePanel>
                                            ))}
                                        </div>
                                      )}
                                    </section>
                                  );
                                })}

                                {sisa.length > 0 && (
                                  <section>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f1f5f9] text-[10px] font-extrabold text-[#475569]">
                                        {grupFase.length + 1}
                                      </span>
                                      <h4 className="text-xs font-extrabold text-[#0f172a]">Lainnya</h4>
                                    </div>
                                    <p className="text-[11px] text-[#64748b] mb-2.5">
                                      Fitur tambahan yang tidak termasuk golongan di atas.
                                    </p>
                                    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      {sisa.map(renderKotak)}
                                    </div>
                                  </section>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-3">


      {/* Panel: Lifecycle Pipeline */}
      <ExpandablePanel open={mainTab === 'lifecycle' && openFeature === 'pipeline'} title="Tahapan Siklus & Pipeline Operasional" onClose={() => setOpenFeature(null)}>
      {phaseOf('pipeline') !== activePhase ? (
        <p className="text-xs text-[#64748b]">Pilih fase siklus karyawan terlebih dahulu.</p>
      ) : (
      <>
      <button
        type="button"
        onClick={() => setOpenFeature(null)}
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#007a5a] hover:underline"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke daftar fitur fase
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (60%): Lifecycle Milestone Pipeline Table */}
        <div className="lg:col-span-7 stitch-card-white p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f1f5f9] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#0f172a]">
                  Tahapan Siklus & Pipeline Operasional
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                  24 Permintaan Aktif
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Pemantauan SLA karyawan secara langsung selama transisi fase siklus kerja.
              </p>
            </div>
          </div>

          {/* Sub-filter tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#f1f5f9] text-xs font-medium text-[#64748b]">
            {PHASES.map((p) => (
              <button
                key={p}
                onClick={() => setPipelineTab(p)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  pipelineTab === p
                    ? 'bg-white text-[#0f172a] shadow-xs'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {PIPELINE_TAB_LABEL[p]}
              </button>
            ))}
          </div>

          {actionNotice && (
            <div className="p-3 rounded-lg bg-[#e6f4ea] border border-[#b7e1cd] text-xs font-semibold text-[#137333] flex items-center justify-between">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="font-bold underline">Tutup</button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {pipelineTab === 'POST' ? (
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
                      <p className="text-[11px] font-bold text-[#334155]">Checklist Serah Terima Tugas (Hard Gate):</p>
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

                    <div className="pt-2 border-t border-[#f1f5f9] flex justify-end gap-2">
                      {off.severanceId && !off.isSeverancePaid && (
                        <button
                          onClick={() => handleDisburseSeverance(off.severanceId, off.id)}
                          disabled={disbursingId === off.id}
                          className="px-3.5 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          <span>{disbursingId === off.id ? 'Mencairkan...' : 'Cairkan Pesangon'}</span>
                        </button>
                      )}
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
                    <th className="py-2.5 px-3 text-right">Status SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-3 text-center">
                        <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 text-xs text-[#64748b]">
                          Belum ada data lamaran. Data tampil otomatis setelah kandidat melamar via portal karir.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c: any, idx: number) => (
                    <tr key={c.id ?? idx} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center text-xs font-bold border border-[#e2e8f0]">
                            {(c.fullName || '?').charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[#0f172a]">{c.fullName}</p>
                            <p className="text-[10px] text-[#64748b] font-mono">{c.applicationNo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#334155] font-medium">
                        {c.postingTitle || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f2fe] text-[#0369a1]">
                          &bull; {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-[#0f172a] font-mono">{c.education || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333]">
                          <Clock className="h-3 w-3 text-[#137333]" /> {c.appliedAt ? new Date(c.appliedAt).toLocaleDateString('id-ID') : 'On Track'}
                        </span>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column (40%): Two Cards */}        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Kalibrasi Penilaian Semester (Gaussian Bell Curve) */}
          <div className="stitch-card-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#0f172a]">Kalibrasi Penilaian Semester</h3>
                <p className="text-xs text-[#64748b] mt-0.5">Distribusi nilai terhadap kurva Gaussian korporat</p>
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
                  Pembereskan Serah Terima Tertunda
                </h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#fce8e6] text-[#c5221f]">
                3 Karyawan
              </span>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Dokumen Berita Acara Serah Terima (BAST), pengembalian token SSO, & audit kelengkapan inventaris menunggu persetujuan HR Director sebelum tanggal LWD.
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
                  Pembersihan Aset TI Selesai
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
                  NDA Audit Tertunda
                </span>
              </div>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={() => openPanelAtTop('clearance')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <FileCheck className="h-4 w-4" />
              <span>Tinjau Dokumen LWD & BAST</span>
            </button>
          </div>
        </div>
      </div>
      </>
      )}
      </ExpandablePanel>
      </div>
    </div>
  );
}

