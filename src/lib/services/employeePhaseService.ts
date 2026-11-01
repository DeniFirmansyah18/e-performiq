import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';
import {
  NEXT_PHASES,
  PHASE_LABEL,
  deriveWorkPhase,
  type WorkPhase,
} from '@/lib/employee/phase';

export interface EmployeePhaseRow {
  employeeId: string;
  fullName: string;
  phase: WorkPhase;
  joinDate: string | null;
  history?: Array<{
    previousPhase: WorkPhase | null;
    newPhase: WorkPhase;
    effectiveDate: string;
    reason: string | null;
  }>;
}

export interface PhaseTransitionInput {
  employeeId: string;
  newPhase: WorkPhase;
  effectiveDate: string;
  reason: string;
  decidedBy: string;
}

/** Urutan numerik fase; hanya boleh naik (PRE → DURING → POST) kecuali koreksi manual. */
const RANK: Record<WorkPhase, number> = { PRE: 0, DURING: 1, POST: 2 };

export function canTransition(from: WorkPhase, to: WorkPhase): boolean {
  return NEXT_PHASES[from].includes(to);
}

interface PhaseQueryRow {
  employeeId: string;
  fullName: string;
  phase: WorkPhase | null;
  joinDate: string | null;
  status: string | null;
  offboardingStatus: string | null;
  programStatus: string | null;
  probationPassed: boolean | null;
  milestonesDone: number | string | null;
}

/**
 * Karyawan yang dibuat setelah migrasi 0060 (mis. lewat seed) belum punya baris
 * `employee_phase`. Untuk mereka fase diturunkan dari sinyal yang sama dengan
 * portal, lalu ditulis balik oleh `syncEmployeePhase` pada hook berikutnya.
 */
function resolvePhase(row: PhaseQueryRow): WorkPhase {
  if (row.phase) return row.phase;
  return deriveWorkPhase({
    offboardingStatus: row.offboardingStatus,
    probationPassed: row.probationPassed,
    programStatus: row.programStatus,
    milestonesDone: row.milestonesDone == null ? null : Number(row.milestonesDone),
    status: row.status,
  });
}

const PHASE_PROJECTION = sql`
  SELECT e.id AS "employeeId", e.full_name AS "fullName",
         e.employee_phase AS phase, e.join_date AS "joinDate",
         e.status::text AS status,
         (SELECT o.status::text FROM offboarding_requests o
           WHERE o.employee_id = e.id
           ORDER BY o.created_at DESC LIMIT 1) AS "offboardingStatus",
         (SELECT op.status::text FROM onboarding_programs op
           WHERE op.employee_id = e.id
           ORDER BY op.started_at DESC NULLS LAST LIMIT 1) AS "programStatus",
         (SELECT om.probation_passed FROM onboarding_milestones om
           WHERE om.employee_id = e.id LIMIT 1) AS "probationPassed",
         (SELECT num_nonnulls(om.day_30_score, om.day_60_score, om.day_90_score)
            FROM onboarding_milestones om
           WHERE om.employee_id = e.id LIMIT 1) AS "milestonesDone"
    FROM employees e
`;

function rowToPhaseFields(raw: PhaseQueryRow): Pick<EmployeePhaseRow, 'employeeId' | 'fullName' | 'phase' | 'joinDate'> {
  return {
    employeeId: raw.employeeId,
    fullName: raw.fullName,
    phase: resolvePhase(raw),
    joinDate: raw.joinDate,
  };
}

export async function getEmployeePhase(db: Db, employeeId: string): Promise<EmployeePhaseRow | null> {
  const res = (await db.execute(sql`
    ${PHASE_PROJECTION} WHERE e.id = ${employeeId}::uuid
  `)) as unknown as { rows: PhaseQueryRow[] };
  const raw = res.rows?.[0];
  if (!raw) return null;

  const hist = (await db.execute(sql`
    SELECT previous_phase AS "previousPhase", new_phase AS "newPhase",
           effective_date AS "effectiveDate", reason
      FROM employee_phase_history
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY effective_date DESC, created_at DESC
  `)) as unknown as { rows: NonNullable<EmployeePhaseRow['history']> };

  return { ...rowToPhaseFields(raw), history: hist.rows ?? [] };
}

export async function listByPhase(db: Db, phase?: WorkPhase): Promise<EmployeePhaseRow[]> {
  const res = (await db.execute(sql`
    ${PHASE_PROJECTION}
     ORDER BY e.full_name
  `)) as unknown as { rows: PhaseQueryRow[] };
  const rows = (res.rows ?? []).map(rowToPhaseFields);
  return phase ? rows.filter((r) => r.phase === phase) : rows;
}

/**
 * Pindahkan fase karyawan dan catat transisinya.
 *
 * `allowCorrection` dipakai untuk koreksi data (mis. karyawan yang terlanjur
 * POST karena salah input). Tanpa flag ini transisi hanya boleh maju satu
 * langkah sesuai `NEXT_PHASES` agar audit trail tidak melompati fase.
 */
export async function changeEmployeePhase(
  db: Db,
  input: PhaseTransitionInput & { allowCorrection?: boolean },
): Promise<EmployeePhaseRow> {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new BusinessRuleError('Alasan perubahan fase wajib diisi (minimal 5 karakter).');
  }

  const before = await getEmployeePhase(db, input.employeeId);
  if (!before) throw new BusinessRuleError('Karyawan tidak ditemukan.');
  if (before.phase === input.newPhase) {
    throw new BusinessRuleError(`Fase sudah ${PHASE_LABEL[input.newPhase]}; tidak ada perubahan untuk dicatat.`);
  }

  if (!canTransition(before.phase, input.newPhase)) {
    if (!input.allowCorrection) {
      const allowed = NEXT_PHASES[before.phase];
      const allowedText = allowed.length
        ? allowed.map((p) => PHASE_LABEL[p]).join(' atau ')
        : 'tidak ada (fase akhir)';
      throw new BusinessRuleError(
        `Transisi ${PHASE_LABEL[before.phase]} → ${PHASE_LABEL[input.newPhase]} tidak sah. ` +
          `Transisi yang diizinkan: ${allowedText}. Gunakan koreksi fase bila ini perbaikan data.`,
      );
    }
    // Koreksi data hanya boleh mundur, bukan melompati fase ke depan.
    if (RANK[input.newPhase] > RANK[before.phase]) {
      throw new BusinessRuleError(
        `Koreksi fase hanya untuk memundurkan fase; gunakan transisi normal untuk memajukan.`,
      );
    }
  }

  await db.execute(sql`
    WITH prev AS (
      SELECT employee_phase FROM employees WHERE id = ${input.employeeId}::uuid
    ), upd AS (
      UPDATE employees
         SET employee_phase = ${input.newPhase}::employee_phase_enum
       WHERE id = ${input.employeeId}::uuid
      RETURNING id
    )
    INSERT INTO employee_phase_history
      (employee_id, previous_phase, new_phase, effective_date, reason, decided_by)
    SELECT ${input.employeeId}::uuid, prev.employee_phase,
           ${input.newPhase}::employee_phase_enum, ${input.effectiveDate}::date,
           ${input.reason}, ${input.decidedBy}::uuid
      FROM prev
  `);

  const after = await getEmployeePhase(db, input.employeeId);
  if (!after) throw new BusinessRuleError('Fase gagal dibaca setelah perubahan.');
  return after;
}

/**
 * Sinkronisasi idempoten untuk hook otomatis (konversi kandidat, onboarding,
 * offboarding). Tidak melakukan apa pun bila fase sudah sesuai atau transisi
 * tidak sah, sehingga aman dipanggil berulang dari alur yang ada.
 * Mengembalikan fase efektif setelah pemanggilan.
 */
export async function syncEmployeePhase(
  db: Db,
  input: {
    employeeId: string;
    targetPhase: WorkPhase;
    effectiveDate: string;
    reason: string;
    decidedBy?: string | null;
  },
): Promise<WorkPhase | null> {
  const current = await getEmployeePhase(db, input.employeeId);
  if (!current) return null;
  if (current.phase === input.targetPhase) return current.phase;
  if (!canTransition(current.phase, input.targetPhase)) return current.phase;

  await db.execute(sql`
    WITH prev AS (
      SELECT employee_phase FROM employees WHERE id = ${input.employeeId}::uuid
    ), upd AS (
      UPDATE employees
         SET employee_phase = ${input.targetPhase}::employee_phase_enum
       WHERE id = ${input.employeeId}::uuid
      RETURNING id
    )
    INSERT INTO employee_phase_history
      (employee_id, previous_phase, new_phase, effective_date, reason, decided_by)
    SELECT ${input.employeeId}::uuid, prev.employee_phase,
           ${input.targetPhase}::employee_phase_enum, ${input.effectiveDate}::date,
           ${input.reason}, ${input.decidedBy ?? null}::uuid
      FROM prev
  `);

  return input.targetPhase;
}

export async function listPhaseHistory(db: Db, employeeId: string) {
  const res = (await db.execute(sql`
    SELECT h.id, h.previous_phase AS "previousPhase", h.new_phase AS "newPhase",
           h.effective_date AS "effectiveDate", h.reason, h.created_at AS "createdAt",
           d.full_name AS "decidedByName"
      FROM employee_phase_history h
      LEFT JOIN users u ON u.id = h.decided_by
      LEFT JOIN employees d ON d.id = u.employee_id
     WHERE h.employee_id = ${employeeId}::uuid
     ORDER BY h.effective_date DESC, h.created_at DESC
  `)) as unknown as { rows: Record<string, unknown>[] };
  return res.rows ?? [];
}
