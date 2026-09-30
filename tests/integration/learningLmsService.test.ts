import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listCourses, enrollLocal, recordProgress, completeCourse } from '@/lib/services/learningLmsService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('learningLmsService', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  const courseId = async (code: string) =>
    Number((await client.query<{ id: number }>(`SELECT id FROM moodle_courses WHERE course_code=$1`, [code])).rows[0].id);

  it('listCourses(phase) memfilter berdasarkan fase', async () => {
    const pre = await listCourses(db, 'PRE');
    expect(pre.length).toBeGreaterThanOrEqual(2);
    expect(pre.every((c) => c.targetPhase === 'PRE')).toBe(true);
  });

  it('enrollLocal + recordProgress menetapkan completion_state', async () => {
    const cid = await courseId('LEAD-ESS');
    await enrollLocal(db, BUDI, cid);
    await recordProgress(db, BUDI, cid, 50, 30);
    const r = await client.query<{ completion_pct: string; completion_state: string }>(
      `SELECT completion_pct::text, completion_state FROM moodle_course_enrollments WHERE employee_id=$1::uuid AND moodle_course_id=$2`, [BUDI, cid]);
    expect(Number(r.rows[0].completion_pct)).toBe(50);
    expect(r.rows[0].completion_state).toBe('IN_PROGRESS');
  });

  it('completeCourse menandai COMPLETE dan mengisi completed_at', async () => {
    const cid = await courseId('LEAD-ESS');
    const res = await completeCourse(db, BUDI, cid);
    expect(res.completionState).toBe('COMPLETE');
    const r = await client.query<{ completed_at: string | null }>(
      `SELECT completed_at FROM moodle_course_enrollments WHERE employee_id=$1::uuid AND moodle_course_id=$2`, [BUDI, cid]);
    expect(r.rows[0].completed_at).not.toBeNull();
  });
});
