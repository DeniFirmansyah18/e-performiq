import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listPublicPostings, submitApplication, getApplicationStatus } from '@/lib/services/candidateService';
import type { Db } from '@/lib/db/client';

describe('candidateService', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('listPublicPostings mengembalikan lowongan publik', async () => {
    const postings = await listPublicPostings(db);
    expect(postings.length).toBeGreaterThanOrEqual(1);
  });

  it('submitApplication membuat kandidat + lamaran dengan nomor unik', async () => {
    const postings = await listPublicPostings(db);
    const res = await submitApplication(db, {
      fullName: 'Test Kandidat', email: 'test.kandidat@example.com', phone: '+62 812-0000-0000',
      address: 'Jl. Test', birthDate: '1995-01-01', education: 'S1', resumeUrl: 'https://x/cv.pdf',
      coverLetter: 'Saya tertarik.', jobPostingId: postings[0].id,
    });
    expect(res.applicationNo).toMatch(/^APP-/);
    const status = await getApplicationStatus(db, res.applicationNo);
    expect(status?.status).toBe('SUBMITTED');
  });

  it('getApplicationStatus mengembalikan null untuk nomor tak dikenal', async () => {
    expect(await getApplicationStatus(db, 'APP-TIDAK-ADA')).toBeNull();
  });
});
