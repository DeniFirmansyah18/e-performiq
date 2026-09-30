import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const NEW_TABLES = [
  'competency_frameworks', 'competencies', 'moodle_courses', 'course_competencies',
  'competency_evidence', 'badges', 'badge_criteria', 'badge_awards',
  'learning_plans', 'learning_plan_items',
];

describe('migration 0009: Moodle LMS tables', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('membuat seluruh tabel LMS', async () => {
    for (const t of NEW_TABLES) {
      const r = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT FROM information_schema.tables
          WHERE table_schema='public' AND table_name=$1) AS exists`, [t]);
      expect(r.rows[0].exists, `missing ${t}`).toBe(true);
    }
  });

  it('menambah kolom completion_state, time_spent_minutes, last_activity_at pada moodle_course_enrollments', async () => {
    const r = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name='moodle_course_enrollments'`);
    const cols = r.rows.map((x) => x.column_name);
    expect(cols).toEqual(expect.arrayContaining(['completion_state', 'time_spent_minutes', 'last_activity_at']));
  });
});
