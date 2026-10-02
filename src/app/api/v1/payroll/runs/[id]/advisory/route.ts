import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { payrollRunSummary } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatIDR(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

/** Ringkasan deterministik (fallback bila AI tak tersedia). */
function fallback(summary: any): string {
  const lines = [
    `**Ringkasan:** Payroll periode ${summary.period ?? '-'} mencakup ${summary.employees ?? 0} karyawan. ` +
      `Total bruto ${formatIDR(summary.totalGross ?? 0)}, potongan ${formatIDR(summary.totalDeductions ?? 0)}, ` +
      `take-home ${formatIDR(summary.totalNet ?? 0)}.`,
    `**Temuan Penting:**\n- Rata-rata gaji bersih ${formatIDR(summary.avgNet ?? 0)}.` +
      `\n- Total pembayaran lembur ${formatIDR(summary.totalOvertime ?? 0)}.` +
      `\n- ${(summary.anomalies?.length ?? 0)} item perlu ditinjau (net ≤ 0 atau lembur tinggi).`,
    `**Rekomendasi Tindakan:**\n1. Verifikasi item anomali sebelum persetujuan.` +
      `\n2. Pastikan potongan BPJS & PPh 21 sesuai peraturan terbaru.`,
  ];
  return lines.join('\n\n');
}

// POST /api/v1/payroll/runs/:id/advisory — ringkasan & deteksi anomali (AI asistif)
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:read');
    const summary = await payrollRunSummary(db, ctx.params.id);

    try {
      const { generateContent, isAiConfigured } = await import('@/lib/services/aiService');
      if (!isAiConfigured()) return ok({ insight: fallback(summary), configured: false });
      const prompt =
        'Anda analis penggajian korporat. Data ringkasan run payroll (JSON):\n' + JSON.stringify(summary) +
        '\n\nTulis analisis SINGKAT dalam BAHASA INDONESIA dengan struktur TEPAT:\n' +
        '**Ringkasan:** (2 kalimat)\n**Temuan Penting:**\n- (poin)\n- (poin)\n' +
        '**Rekomendasi Tindakan:**\n1. (langkah)\n2. (langkah)\n' +
        'Gunakan hanya data di atas; jangan mengarang angka. Netral & profesional.';
      const res = await generateContent(prompt, { maxOutputTokens: 1200, temperature: 0.25 });
      const insight = res?.text && res.text.trim().length > 0 ? res.text.trim() : fallback(summary);
      return ok({ insight, configured: res?.configured ?? false, summary });
    } catch {
      return ok({ insight: fallback(summary), configured: false, summary });
    }
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs/[id]/advisory');
  }
}
