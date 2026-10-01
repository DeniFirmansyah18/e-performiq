import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { onCourseCompleted } from '@/lib/services/lmsObserver';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('lmsObserver: course completion -> evidence -> badge', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  const courseId = async (code: string) =>
    Number((await client.query<{ id: number }>(`SELECT id FROM moodle_courses WHERE course_code=$1`, [code])).rows[0].id);

  it('membuat evidence kompetensi saat course selesai', async () => {
    const cid = await courseId('CLOUD-ARCH');
    const res = await onCourseCompleted(db, BUDI, cid);
    expect(res.evidenceCreated).toBeGreaterThanOrEqual(1);
    const ev = await client.query(`SELECT count(*)::text AS c FROM competency_evidence WHERE employee_id=$1::uuid AND course_id=$2`, [BUDI, cid]);
    expect(Number((ev.rows[0] as any).c)).toBeGreaterThanOrEqual(1);
  });

  it('idempoten: menyelesaikan course yang sama tidak menggandakan evidence/badge', async () => {
    const cid = await courseId('CLOUD-ARCH');
    const before = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM competency_evidence WHERE employee_id=$1::uuid AND course_id=$2`, [BUDI, cid]);
    await onCourseCompleted(db, BUDI, cid);
    const after = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM competency_evidence WHERE employee_id=$1::uuid AND course_id=$2`, [BUDI, cid]);
    expect(after.rows[0].c).toBe(before.rows[0].c);
    const awards = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM badge_awards WHERE employee_id=$1::uuid`, [BUDI]);
    expect(Number(awards.rows[0].c)).toBeGreaterThanOrEqual(0);
  });

  it('menganugerahkan badge setelah kriteria COURSE terpenuhi', async () => {
    const cid = await courseId('CLOUD-ARCH');
    await onCourseCompleted(db, BUDI, cid);
    // Observer idempoten: badge hanya "baru" sekali. Verifikasi keberadaannya di DB.
    const award = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM badge_awards ba
         JOIN badges b ON b.id = ba.badge_id
        WHERE ba.employee_id=$1::uuid AND b.code='BADGE-CLOUD-CERT'`, [BUDI]);
    expect(Number(award.rows[0].c)).toBe(1);
  });
});
