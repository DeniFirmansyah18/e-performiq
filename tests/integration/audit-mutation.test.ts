import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

describe('Imutabilitas audit_logs (G-08)', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it('menolak UPDATE pada audit_logs (trigger trg_audit_logs_immutable)', async () => {
    const ins = await client.query<{ id: number }>(
      `INSERT INTO audit_logs (action_type, entity_name, record_id, description)
       VALUES ('LOGIN', 'users', 'u-1', 'awal') RETURNING id`
    );
    const id = ins.rows[0].id;

    await expect(
      client.query('UPDATE audit_logs SET description = $1 WHERE id = $2', ['diubah', id])
    ).rejects.toThrow(/immutable/i);

    const check = await client.query<{ description: string }>(
      'SELECT description FROM audit_logs WHERE id = $1',
      [id]
    );
    expect(check.rows[0].description).toBe('awal');
  });

  it('menolak DELETE pada audit_logs (trigger trg_audit_logs_immutable)', async () => {
    const ins = await client.query<{ id: number }>(
      `INSERT INTO audit_logs (action_type, entity_name, record_id)
       VALUES ('LOGOUT', 'users', 'u-1') RETURNING id`
    );
    const id = ins.rows[0].id;

    await expect(
      client.query('DELETE FROM audit_logs WHERE id = $1', [id])
    ).rejects.toThrow(/immutable/i);

    const check = await client.query<{ id: number }>(
      'SELECT id FROM audit_logs WHERE id = $1',
      [id]
    );
    expect(check.rows.length).toBe(1);
  });
});
