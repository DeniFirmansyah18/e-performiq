import type {
  DailyTimesheet,
  KpiEvidenceAttachment,
  NineBoxQuadrant,
  TalentRecommendationSignal,
} from '@/types';
import { getDb } from '@/lib/db/client';

export interface TalentMetricInput {
  gpa: number;
  nineBox: NineBoxQuadrant;
  attendanceBradford?: number;
}

/**
 * Mesin kalkulasi rekomendasi talenta berbasis analitik matematis (Kotak 1 Govera360)
 * Menghasilkan sinyal promosi cepat, evaluasi mutasi/penempatan peran, atau bimbingan PIP.
 */
export function generateTalentRecommendationSignal(
  input: TalentMetricInput
): TalentRecommendationSignal {
  const { gpa, nineBox, attendanceBradford = 0 } = input;

  // Kasus 1: Performa Rendah atau Kotak 1 -> Wajib Pembinaan Khusus PIP (60 hari)
  if (gpa < 2.0 || nineBox === 'UNDERPERFORMER') {
    return {
      action: 'PIP',
      title: 'Mandat Program Pembinaan Kinerja (PIP)',
      reason: `Nilai rapor GPA (${gpa.toFixed(2)}) atau posisi matriks talenta (${nineBox}) berada di bawah standar minimum organisasi. Wajib pembinaan intensif 60 hari.`,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      durationDays: 60,
    };
  }

  // Kasus 2: Potensi Tinggi tapi Kinerja Terhambat -> Evaluasi Peran / Mutasi
  if (nineBox === 'ENIGMA' || (nineBox === 'DILEMMA' && gpa < 2.5)) {
    return {
      action: 'MUTATION',
      title: 'Rekomendasi Penyelarasan Peran / Mutasi Unit',
      reason: `Indeks potensi tinggi namun terdeteksi hambatan adaptasi atau indikasi salah penempatan peran kerja. Disarankan rotasi divisi untuk memaksimalkan kapabilitas.`,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  // Kasus 3: Kinerja Istimewa + Potensi Suksesor -> Fast-Track Promosi
  if (
    gpa >= 3.7 &&
    (nineBox === 'FUTURE_LEADER' || nineBox === 'GROWTH_STAR') &&
    attendanceBradford <= 25
  ) {
    return {
      action: 'PROMOTION',
      title: 'Kandidat Kuat Promosi Jabatan & Suksesi',
      reason: `Konsistensi pencapaian rapor GPA tinggi (${gpa.toFixed(2)}), rekam jejak kepatuhan disiplin baik, dan kesiapan suksesi kepemimpinan tingkat lanjut.`,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  // Kasus Default: Kontributor Standar Stabil
  return {
    action: 'MAINTAIN',
    title: 'Kontributor Inti Berkinerja Stabil',
    reason: `Pencapaian target selaras dengan standar divisi. Pertahankan ritme kerja dan lanjutkan pengembangan kompetensi terencana.`,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  };
}

/**
 * Menyimpan entri lembar kerja harian (Timesheet) dengan penegakan regulasi PP No. 35/2021
 */
export async function submitDailyTimesheet(payload: {
  employeeId: string;
  workDate: string;
  regularHours?: number;
  overtimeHours?: number;
  taskSummary: string;
}): Promise<DailyTimesheet> {
  const regularHours = payload.regularHours ?? 8.0;
  const overtimeHours = payload.overtimeHours ?? 0.0;

  if (overtimeHours < 0 || overtimeHours > 4.0) {
    throw new Error(
      'Waktu lembur melanggar batas sah regulasi PP No. 35/2021 Pasal 26 (maksimal 4 jam per hari).'
    );
  }

  const db = await getDb();
  const res = await db.query<any>(
    `INSERT INTO daily_timesheets (employee_id, work_date, regular_hours, overtime_hours, task_summary)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employee_id, work_date)
     DO UPDATE SET 
       regular_hours = EXCLUDED.regular_hours,
       overtime_hours = EXCLUDED.overtime_hours,
       task_summary = EXCLUDED.task_summary
     RETURNING *;`,
    [payload.employeeId, payload.workDate, regularHours, overtimeHours, payload.taskSummary]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    workDate: row.work_date,
    regularHours: Number(row.regular_hours),
    overtimeHours: Number(row.overtime_hours),
    taskSummary: row.task_summary,
    approvalStatus: row.approval_status,
    createdAt: row.created_at,
  };
}

/**
 * Mengunggah lampiran portofolio atau tautan bukti pencapaian KPI
 */
export async function attachKpiEvidence(payload: {
  individualKpiId: string;
  fileTitle: string;
  fileUrl: string;
}): Promise<KpiEvidenceAttachment> {
  const db = await getDb();
  const res = await db.query<any>(
    `INSERT INTO kpi_evidence_attachments (individual_kpi_id, file_title, file_url)
     VALUES ($1, $2, $3)
     RETURNING *;`,
    [payload.individualKpiId, payload.fileTitle, payload.fileUrl]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    individualKpiId: row.individual_kpi_id,
    fileTitle: row.file_title,
    fileUrl: row.file_url,
    uploadedAt: row.uploaded_at,
  };
}
