import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { appendActivity, listActivity } from '@/lib/services/activityFeedService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

describe('activity feed', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('menyimpan dan membaca kembali kejadian', async () => {
    await appendActivity(db, { employeeId: BUDI, eventType: 'KPI_DAILY', summary: 'Mengisi 3 indikator' });
    const rows = await listActivity(db, BUDI, 10);
    expect(rows[0].summary).toBe('Mengisi 3 indikator');
    expect(rows[0].eventType).toBe('KPI_DAILY');
  });

  it('menolak visibilitas RESTRICTED pada feed', async () => {
    await expect(
      appendActivity(db, { employeeId: BUDI, eventType: 'KPI_DAILY', summary: 'gaji', visibility: 'RESTRICTED' }),
    ).rejects.toThrow(/RESTRICTED/);
  });
});
