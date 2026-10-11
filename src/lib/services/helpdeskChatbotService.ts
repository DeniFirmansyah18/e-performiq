import { getDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { HelpdeskTicket } from '@/types';
import { generateContent, isAiConfigured } from '@/lib/services/aiService';

export interface ChatbotResponse {
  answer: string;
  source: 'POLICY' | 'DATA' | 'AI' | 'FALLBACK';
  confidence: number;
}

interface PolicyRow {
  question: string;
  answer: string;
  keywords: string;
}

const STOPWORDS = new Set([
  'dan', 'atau', 'yang', 'untuk', 'dengan', 'pada', 'dari', 'ini', 'itu',
  'adalah', 'saya', 'kamu', 'anda', 'bagaimana', 'apa', 'apakah', 'berapa',
  'kapan', 'dimana', 'di', 'ke', 'the', 'dan', 'bisa', 'tidak', 'ya',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Skor kemiripan kata kunci KB vs pertanyaan (bobot kata kunci > kata tanya). */
function scoreRow(row: PolicyRow, qTokens: Set<string>): number {
  const kwTokens = tokenize(row.keywords);
  const qtokens = tokenize(row.question);
  let score = 0;
  const seen = new Set<string>();
  for (const kw of kwTokens) if (qTokens.has(kw) && !seen.has(kw)) { score += 2; seen.add(kw); }
  for (const kw of qtokens) if (qTokens.has(kw) && !seen.has(kw)) { score += 1; seen.add(kw); }
  return score;
}

/**
 * Knowledge Engine untuk Chatbot SOP & Peraturan Perusahaan (Kotak 6), Task 9.
 *
 * - DATA  : jawaban berbasis data nyata milik `employeeId` (mis. saldo cuti).
 * - AI    : sintesis AI (grounded) di atas top-K baris knowledge base + data karyawan.
 * - POLICY: jawaban terbaik dari tabel policy_knowledge_base (skor kata kunci) bila AI off.
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

  // 1) Ambil seluruh knowledge base, skor, urutkan untuk ambil top-K konteks.
  const kb = (await db.execute(sql`
    SELECT question, answer, keywords FROM policy_knowledge_base
  `)) as unknown as { rows: PolicyRow[] };

  const ranked = (kb.rows ?? [])
    .map((row) => ({ row, score: scoreRow(row, qTokens) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? null;
  const topK = ranked.filter((r) => r.score > 0).slice(0, 5).map((r) => r.row);

  // 2) DATA intent (query data nyata milik karyawan) — sinyal data personal.
  const dataIntent =
    (q.includes('saldo') && q.includes('cuti')) ||
    /saldo cuti|sisa cuti|cuti saya|berapa cuti/.test(q);
  let employeeContext = '';
  if (dataIntent) {
    const leave = (await db.execute(sql`
      SELECT COUNT(*)::int AS "used"
        FROM leave_requests
       WHERE employee_id = ${employeeId}::uuid AND status = 'APPROVED'
    `)) as unknown as { rows: Array<{ used: number }> };
    const used = Number(leave.rows[0]?.used ?? 0);
    employeeContext = `Data karyawan penanya: ${used} pengajuan cuti sudah DISETUJUI. Kuota cuti tahunan 12 hari kerja/tahun.`;
  }

  // 3) AI grounded: bila provider AI aktif, sintesis jawaban dari konteks KB + data.
  if (isAiConfigured()) {
    const kbContext = topK.length
      ? topK.map((r, i) => `[${i + 1}] T: ${r.question}\nJ: ${r.answer}`).join('\n')
      : '(tidak ada kebijakan yang sangat relevan di basis pengetahuan)';
    const prompt =
      `Pertanyaan karyawan: "${question}"\n\n` +
      `Kebijakan/SOP relevan dari basis pengetahuan perusahaan:\n${kbContext}\n\n` +
      (employeeContext ? `${employeeContext}\n\n` : '') +
      `Jawablah pertanyaan karyawan HANYA berdasarkan kebijakan di atas dan data karyawan ` +
      `(jika ada). Jika informasi tidak cukup, katakan dengan jujur bahwa hal itu belum diatur ` +
      `secara eksplisit dan sarankan menghubungi Human Capital. Jawaban 2-5 kalimat, jelas, ` +
      `profesional, dalam Bahasa Indonesia, langsung ke inti (tanpa pembuka menyapa).`;
    const ai = await generateContent(prompt, { maxOutputTokens: 1024, temperature: 0.3 });
    if (ai.configured && !ai.error && ai.text.trim()) {
      const grounded = topK.length > 0 || employeeContext;
      return {
        answer: ai.text.trim(),
        source: 'AI',
        confidence: grounded ? 0.92 : 0.6,
      };
    }
    // AI gagal → jatuh ke jawaban deterministik di bawah.
  }

  if (dataIntent) {
    const used = Number((employeeContext.match(/(\d+)/) ?? [])[1] ?? 0);
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
