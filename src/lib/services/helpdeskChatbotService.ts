import { getDb } from '@/lib/db/client';
import type { HelpdeskTicket } from '@/types';

export interface ChatbotResponse {
  answer: string;
  sourceRef: string;
}

/**
 * Knowledge Engine untuk Chatbot SOP & Peraturan Perusahaan (Kotak 6)
 */
export function queryPolicyChatbotEngine(question: string): ChatbotResponse {
  const q = question.toLowerCase();

  if (q.includes('klaim') || q.includes('kacamata') || q.includes('reimburse')) {
    return {
      answer:
        'Pengajuan klaim penggantian biaya (reimbursement) medis dan kacamata dapat dilakukan mandiri melalui menu Kotak 5 dengan melampirkan foto kwitansi asli. Batas waktu klaim adalah 30 hari kalender sejak tanggal transaksi.',
      sourceRef: 'SOP Keuangan & Manfaat Karyawan Pasal 14',
    };
  }

  if (q.includes('cuti') || q.includes('sakit') || q.includes('izin')) {
    return {
      answer:
        'Karyawan berhak atas cuti tahunan sebanyak 12 hari kerja setelah masa kerja 12 bulan terus menerus. Pengajuan cuti minimal 3 hari sebelum tanggal pelaksanaan melalui portal Kotak 4.',
      sourceRef: 'Peraturan Perusahaan Bab VII & PP No. 35/2021',
    };
  }

  if (q.includes('pesangon') || q.includes('phk') || q.includes('pensiun')) {
    return {
      answer:
        'Perhitungan uang pesangon dihitung resmi mengacu pada formula baku PP No. 35/2021 Pasal 40-59 (UP + UPMK + UPH) yang secara otomatis dikalkulasikan melalui sistem.',
      sourceRef: 'PP No. 35/2021 & PRD E-PerformIQ v1.0',
    };
  }

  return {
    answer:
      'Pertanyaan Anda telah dicatat. Anda dapat membuka tiket bantuan langsung ke bagian Human Capital atau melihat panduan lengkap di Pusat Bantuan fullscreen.',
    sourceRef: 'Basis Pengetahuan Umum E-PerformIQ',
  };
}

/**
 * Membuat tiket bantuan operasional atau laporan Whistleblowing anonim
 */
export async function createHelpdeskTicket(payload: {
  employeeId?: string;
  isWhistleblowing: boolean;
  ticketCategory: string;
  subject: string;
  detail: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}): Promise<HelpdeskTicket> {
  const db = await getDb();
  const priority = payload.priority ?? 'MEDIUM';
  // Jika Whistleblowing anonim, pastikan employee_id di-null-kan demi perlindungan pelapor (GCG Fairness)
  const safeEmployeeId = payload.isWhistleblowing ? null : payload.employeeId ?? null;

  const res = await db.query<any>(
    `INSERT INTO helpdesk_tickets (employee_id, is_whistleblowing, ticket_category, subject, detail, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *;`,
    [
      safeEmployeeId,
      payload.isWhistleblowing,
      payload.ticketCategory,
      payload.subject,
      payload.detail,
      priority,
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    isWhistleblowing: Boolean(row.is_whistleblowing),
    ticketCategory: row.ticket_category,
    subject: row.subject,
    detail: row.detail,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
  };
}
