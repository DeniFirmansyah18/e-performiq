import { getDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { HelpdeskTicket } from '@/types';

export interface ChatbotResponse {
  answer: string;
  source: 'POLICY' | 'DATA' | 'FALLBACK';
  confidence: number;
}

interface PolicyRow {
  question: string;
  answer: string;
  keywords: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Knowledge Engine untuk Chatbot SOP & Peraturan Perusahaan (Kotak 6), Task 9.
 *
 * - POLICY: jawaban terbaik dari tabel policy_knowledge_base (skor kata kunci).
 * - DATA  : jawaban berbasis data nyata milik `employeeId` (mis. saldo cuti).
 * - FALLBACK: tidak ada kecocokan.
 * Semua akses data dibatasi ke `employeeId` (scope).
 */
export async function queryPolicyChatbotEngine(
  db: Db,
  question: string,
  employeeId: string
): Promise<ChatbotResponse> {
  const q = (question ?? '').toLowerCase();
  const qTokens = new Set(tokenize(q));

  // 1) POLICY: cari baris knowledge base dengan skor kata kunci tertinggi.
  const kb = (await db.execute(sql`
    SELECT question, answer, keywords FROM policy_knowledge_base
  `)) as unknown as { rows: PolicyRow[] };

  let best: { row: PolicyRow; score: number } | null = null;
  for (const row of kb.rows ?? []) {
    const kws = tokenize(`${row.keywords} ${row.question}`);
    let score = 0;
    for (const kw of kws) if (qTokens.has(kw)) score += 1;
    if (!best || score > best.score) best = { row, score };
  }

  // 2) DATA intent (query data nyata milik karyawan) — diperiksa bila ada sinyal data.
  const dataIntent =
    (q.includes('saldo') && q.includes('cuti')) ||
    /saldo cuti|sisa cuti|cuti saya|berapa cuti/.test(q);
  if (dataIntent) {
    const leave = (await db.execute(sql`
      SELECT COUNT(*)::int AS "used"
        FROM leave_requests
       WHERE employee_id = ${employeeId}::uuid AND status = 'APPROVED'
    `)) as unknown as { rows: Array<{ used: number }> };
    const used = Number(leave.rows[0]?.used ?? 0);
    return {
      answer: `Sesuai data Anda, terdapat ${used} pengajuan cuti yang telah disetujui. Sisa kuota cuti tahunan mengikuti kebijakan 12 hari kerja/tahun dikurangi cuti terpakai.`,
      source: 'DATA',
      confidence: 0.9,
    };
  }

  if (best && best.score > 0) {
    const total = Math.max(1, tokenize(best.row.keywords).length);
    return {
      answer: best.row.answer,
      source: 'POLICY',
      confidence: Number(Math.min(1, best.score / Math.min(total, 4)).toFixed(2)) || 0.5,
    };
  }

  return {
    answer:
      'Pertanyaan Anda belum ada di basis pengetahuan. Anda dapat membuka tiket bantuan ke Human Capital atau melihat Pusat Bantuan untuk panduan lengkap.',
    source: 'FALLBACK',
    confidence: 0,
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
