import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { generateContent } from './aiService';
import { readiness } from './careerLadderService';

export interface CoachContext {
  employeeName: string;
  employmentStatus: string;
  recentSnapshots: Array<{ date: string; score: number | null; trafficLight: string }>;
  weakestIndicators: Array<{ name: string; actual: number; target: number }>;
  attendance: { present: number; absent: number };
  leaveBalanceDays: number;
  trainingsCompleted: number;
  activeSanctions: number;
  careerReadinessPercent: number;
}

/**
 * Allow-list: hanya kolom di bawah ini yang boleh masuk prompt.
 * Gaji, payroll, nomor BPJS, data medis, dan isi pesan TIDAK PERNAH dipilih.
 * Sanksi hanya muncul sebagai jumlah, bukan alasan/bukti pemeriksaan.
 */
export async function buildCoachContext(db: Db, employeeId: string): Promise<CoachContext> {
  const emp = (await db.execute(sql`
    SELECT full_name AS "employeeName", employment_status AS "employmentStatus"
      FROM employees WHERE id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ employeeName: string; employmentStatus: string }> };

  const snaps = (await db.execute(sql`
    SELECT snapshot_date AS date, dpi_score::float8 AS score, traffic_light AS "trafficLight"
      FROM daily_performance_snapshots
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY snapshot_date DESC LIMIT 30
  `)) as unknown as { rows: CoachContext['recentSnapshots'] };

  const weak = (await db.execute(sql`
    SELECT i.indicator_name AS name, e.actual_value::float8 AS actual,
           i.target_value::float8 AS target
      FROM kpi_daily_entries e
      JOIN kpi_indicators i ON i.id = e.indicator_id
     WHERE e.employee_id = ${employeeId}::uuid
       AND e.entry_date >= CURRENT_DATE - INTERVAL '30 days'
       AND e.actual_value < i.target_value
     ORDER BY (e.actual_value / NULLIF(i.target_value, 0)) ASC
     LIMIT 5
  `)) as unknown as { rows: CoachContext['weakestIndicators'] };

  const att = (await db.execute(sql`
    SELECT count(*) FILTER (WHERE check_in_at IS NOT NULL)::int AS present,
           count(*) FILTER (WHERE check_in_at IS NULL)::int AS absent
      FROM attendance_logs
     WHERE employee_id = ${employeeId}::uuid
       AND work_date >= CURRENT_DATE - INTERVAL '30 days'
  `)) as unknown as { rows: Array<{ present: number; absent: number }> };

  const leave = (await db.execute(sql`
    SELECT COALESCE(sum(total_days), 0)::int AS used
      FROM leave_requests
     WHERE employee_id = ${employeeId}::uuid
       AND status = 'APPROVED'
       AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `)) as unknown as { rows: Array<{ used: number }> };

  const training = (await db.execute(sql`
    SELECT count(*)::int AS n FROM course_completions WHERE employee_id = ${employeeId}::uuid
  `)) as unknown as { rows: Array<{ n: number }> };

  const sanctions = (await db.execute(sql`
    SELECT count(*)::int AS n FROM disciplinary_actions
     WHERE employee_id = ${employeeId}::uuid
       AND appeal_status <> 'APPEAL_ACCEPTED'
       AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
  `)) as unknown as { rows: Array<{ n: number }> };

  const career = await readiness(db, employeeId);

  return {
    employeeName: emp.rows?.[0]?.employeeName ?? 'Karyawan',
    employmentStatus: emp.rows?.[0]?.employmentStatus ?? 'UNKNOWN',
    recentSnapshots: snaps.rows ?? [],
    weakestIndicators: weak.rows ?? [],
    attendance: {
      present: Number(att.rows?.[0]?.present ?? 0),
      absent: Number(att.rows?.[0]?.absent ?? 0),
    },
    leaveBalanceDays: Math.max(0, 12 - Number(leave.rows?.[0]?.used ?? 0)),
    trainingsCompleted: Number(training.rows?.[0]?.n ?? 0),
    activeSanctions: Number(sanctions.rows?.[0]?.n ?? 0),
    careerReadinessPercent: career.percent,
  };
}

export function buildCoachPrompt(context: CoachContext, question: string): string {
  return (
    'Anda adalah pelatih performa karyawan. Jawab dalam Bahasa Indonesia, maksimal 6 kalimat, ' +
    'berdasarkan HANYA data berikut. Konteks ini tidak memuat gaji, BPJS, data medis, atau pesan pribadi; ' +
    'bila pengguna menanyakannya, arahkan ke kanal resmi HRD.\n\n' +
    `Data performa (JSON):\n${JSON.stringify(context)}\n\n` +
    `Pertanyaan: ${question}\n\n` +
    'Sebutkan sumber data yang Anda pakai (tanggal snapshot atau nama indikator). ' +
    'Bila data tidak tersedia, katakan tidak tahu; jangan mengarang angka.'
  );
}

export async function answerPerformanceQuestion(
  db: Db,
  input: { employeeId: string; question: string; role: string },
): Promise<{ reply: string; configured: boolean; sources: string[] }> {
  const context = await buildCoachContext(db, input.employeeId);
  const res = await generateContent(buildCoachPrompt(context, input.question), {
    maxOutputTokens: 1024,
    temperature: 0.25,
  });

  const sources: string[] = [];
  for (const s of context.recentSnapshots.slice(0, 3)) sources.push(`snapshot ${s.date}`);
  for (const w of context.weakestIndicators.slice(0, 3)) sources.push(`indikator ${w.name}`);

  return { reply: res.text, configured: res.configured, sources };
}
