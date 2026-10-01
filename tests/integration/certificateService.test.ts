import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { issueCertificate, getCertificatesForEmployee, verifyCertificate } from '@/lib/services/certificateService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('certificateService', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  const courseId = async (code: string) =>
    Number((await client.query<{ id: number }>(`SELECT id FROM moodle_courses WHERE course_code=$1`, [code])).rows[0].id);

  it('menerbitkan sertifikat; idempoten pada pemanggilan ulang', async () => {
    const cid = await courseId('LEAD-ESS');
    const c1 = await issueCertificate(db, BUDI, cid);
    expect(c1.certificateNo).toBeTruthy();
    expect(c1.verificationCode).toBeTruthy();
    const c2 = await issueCertificate(db, BUDI, cid);
    expect(c2.certificateNo).toBe(c1.certificateNo);
    const n = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM certificates WHERE employee_id=$1::uuid AND course_id=$2`, [BUDI, cid]);
    expect(Number(n.rows[0].c)).toBe(1);
  });

  it('getCertificatesForEmployee memuat sertifikat', async () => {
    const list = await getCertificatesForEmployee(db, BUDI);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('verifyCertificate valid untuk kode benar, false untuk kode asing', async () => {
    const c1 = await issueCertificate(db, BUDI, await courseId('PG-ADV'));
    const ok = await verifyCertificate(db, c1.verificationCode);
    expect(ok.valid).toBe(true);
    const bad = await verifyCertificate(db, 'TIDAKADA123');
    expect(bad.valid).toBe(false);
  });
});
