import { describe, it, expect } from 'vitest';
import { requireDatabaseUrl } from '../../scripts/require-db-url.mjs';

describe('requireDatabaseUrl', () => {
  it('menolak DATABASE_URL kosong dengan pesan yang menyebut PGlite', () => {
    const res = requireDatabaseUrl('');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/DATABASE_URL kosong/);
    expect(res.message).toMatch(/db:migrate/);
  });

  it('menerima URL Postgres', () => {
    const res = requireDatabaseUrl('postgresql://u:p@localhost:5432/db');
    expect(res.ok).toBe(true);
    expect(res.message).toBe('');
  });
});
