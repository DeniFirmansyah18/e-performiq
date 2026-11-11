import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { decideTimesheet } from '@/lib/services/attendanceLogService';
import { decideCorrection } from '@/lib/services/attendanceCorrectionService';

const SITI_USER = 'e0000000-0000-4000-8000-000000000002';
const SITI_EMP = 'b0000000-0000-4000-8000-000000000002';
const BUDI_EMP = 'b0000000-0000-4000-8000-000000000004';

let client: PGlite;
let db: Db;

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;
}, 60000);

afterAll(async () => { await client.close(); });

async function buatTimesheet(employeeId: string): Promise<string> {
  // Tanggal unik agar constraint unik tidak bentrok.
  const unik = new Date(2021, 0, 1 + (Date.now() % 3000)).toISOString().slice(0, 10);
  const r = await client.query<{ id: string }>(
    `INSERT INTO daily_timesheets
       (id, employee_id, work_date, regular_hours, overtime_hours, task_summary, activity_category, approval_status)
     VALUES (gen_random_uuid(), $1, $2::date, 8, 0, 'Uji self-approval', 'DEVELOPMENT', 'SUBMITTED')
     RETURNING id`,
    [employeeId, unik]
  );
  return r.rows[0].id;
}

async function buatKoreksi(employeeId: string): Promise<string> {
  const log = await client.query<{ id: string }>(
    `INSERT INTO attendance_logs (id, employee_id, work_date)
     VALUES (gen_random_uuid(), $1, '2026-09-15')
     RETURNING id`,
    [employeeId]
  );
  const r = await client.query<{ id: string }>(
    `INSERT INTO attendance_corrections
       (id, attendance_log_id, employee_id, requested_check_in_at, reason, status)
     VALUES (gen_random_uuid(), $1, $2, '2026-09-15T08:00:00Z', 'Uji self-approval koreksi', 'SUBMITTED')
     RETURNING id`,
    [log.rows[0].id, employeeId]
  );
  return r.rows[0].id;
}

/**
 * Menyetujui absensi adalah keputusan atas orang lain. Pemohon tidak boleh
 * menyetujui miliknya sendiri meski memegang izin persetujuan.
 */
describe('persetujuan absensi menolak self-approval', () => {
  it('timesheet: penyetuju tidak boleh menyetujui timesheet miliknya sendiri', async () => {
    const id = await buatTimesheet(SITI_EMP);
    await expect(
      decideTimesheet(db, {
        timesheetId: id,
        approverUserId: SITI_USER,
        approverEmployeeId: SITI_EMP,
        decision: 'APPROVED',
      } as any)
    ).rejects.toThrow(/sendiri/i);

    const r = await client.query<{ approval_status: string }>(
      'SELECT approval_status FROM daily_timesheets WHERE id = $1',
      [id]
    );
    expect(r.rows[0].approval_status).not.toBe('APPROVED');
  });

  it('timesheet: atasan tetap boleh menyetujui timesheet pegawai lain', async () => {
    const id = await buatTimesheet(BUDI_EMP);
    const row = await decideTimesheet(db, {
      timesheetId: id,
      approverUserId: SITI_USER,
      approverEmployeeId: SITI_EMP,
      decision: 'APPROVED',
    } as any);
    expect(row).toBeTruthy();
  });

  it('koreksi absensi: pemohon tidak boleh memutuskan koreksinya sendiri', async () => {
    const id = await buatKoreksi(SITI_EMP);
    await expect(
      decideCorrection(db, {
        id,
        deciderId: SITI_USER,
        deciderEmployeeId: SITI_EMP,
        decision: 'APPROVED',
      } as any)
    ).rejects.toThrow(/sendiri/i);

    const r = await client.query<{ status: string }>(
      'SELECT status FROM attendance_corrections WHERE id = $1',
      [id]
    );
    expect(r.rows[0].status).not.toBe('APPROVED');
  });

  it('koreksi absensi: atasan tetap boleh memutuskan koreksi pegawai lain', async () => {
    const id = await buatKoreksi(BUDI_EMP);
    const row = await decideCorrection(db, {
      id,
      deciderId: SITI_USER,
      deciderEmployeeId: SITI_EMP,
      decision: 'APPROVED',
    } as any);
    expect(row).toBeTruthy();
  });
});
