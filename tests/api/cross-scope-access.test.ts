import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import type { Db } from '@/lib/db/client';
import { runSeed } from '@/lib/db/seed';
import { getEmployeeKpis } from '@/lib/services/kpiService';
import { ForbiddenError } from '@/lib/auth/errors';
import { problem } from '@/lib/api/response';
import type { SessionPayload } from '@/lib/auth/session';

async function insertEmployee(
  client: PGlite,
  depId: string,
  posId: string,
  code: string,
  name: string,
  email: string,
  managerId: string | null
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO employees
       (employee_code, full_name, email, department_id, position_id,
        base_salary, join_date, manager_id)
     VALUES ($1, $2, $3, $4::uuid, $5::uuid, 10000000, CURRENT_DATE, $6::uuid)
     RETURNING id`,
    [code, name, email, depId, posId, managerId]
  );
  return res.rows[0].id;
}

describe('Penegakan scope akses lintas karyawan (G-08)', () => {
  let client: PGlite;
  let db: Db;
  let session: SessionPayload;
  let staffId: string;
  let outsiderId: string;

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    await runSeed(client);

    const depId = (
      await client.query<{ id: string }>('SELECT id FROM departments LIMIT 1')
    ).rows[0].id;
    const posId = (
      await client.query<{ id: string }>('SELECT id FROM job_positions LIMIT 1')
    ).rows[0].id;

    const managerId = await insertEmployee(
      client, depId, posId,
      'T-MGR-001', 'Manajer Uji', 'mgr.uji@example.com', null
    );
    staffId = await insertEmployee(
      client, depId, posId,
      'T-STF-001', 'Staf Uji', 'staf.uji@example.com', managerId
    );
    outsiderId = await insertEmployee(
      client, depId, posId,
      'T-OUT-001', 'Luar Uji', 'luar.uji@example.com', null
    );

    session = {
      userId: 'test-user-1',
      employeeId: managerId,
      role: 'PEOPLE_MANAGER',
      email: 'mgr.uji@example.com',
    };
  });

  afterAll(async () => {
    await client.close();
  });

  it('PEOPLE_MANAGER boleh membaca KPI bawahan langsungnya', async () => {
    await expect(getEmployeeKpis(db, session, staffId)).resolves.toEqual([]);
  });

  it('PEOPLE_MANAGER ditolak saat membaca KPI karyawan di luar scope (403)', async () => {
    const err: unknown = await getEmployeeKpis(db, session, outsiderId).catch(
      (e) => e
    );
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as { status?: number }).status).toBe(403);
  });

  it('penolakan scope dipetakan menjadi respons HTTP 403 (RFC 7807)', async () => {
    const err: unknown = await getEmployeeKpis(db, session, outsiderId).catch(
      (e) => e
    );
    const res = problem(err, 'cross-scope-access');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.status).toBe(403);
    expect(body.title).toBe('Forbidden');
  });
});
