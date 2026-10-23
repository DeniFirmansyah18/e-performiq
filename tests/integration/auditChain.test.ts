import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { insertAuditLog, verifyAuditChain } from '@/lib/repositories/auditRepository';

const HEX64 = /^[0-9a-f]{64}$/;

describe('rantai hash audit_logs (anti-tamper)', () => {
  let client: PGlite;
  let db: any;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it('setiap baris baru mendapat entry_hash 64 heksadesimal', async () => {
    const a = await insertAuditLog(db, {
      actionType: 'CREATE', entityName: 'kpi_indicators', recordId: 'r1',
      description: 'uji rantai 1',
    });
    const b = await insertAuditLog(db, {
      actionType: 'UPDATE', entityName: 'kpi_indicators', recordId: 'r2',
      description: 'uji rantai 2',
    });

    expect(a.entry_hash).toMatch(HEX64);
    expect(b.entry_hash).toMatch(HEX64);
    expect(a.entry_hash).not.toBe(b.entry_hash);
  });

  it('baris kedua menunjuk hash baris pertama (prev_hash)', async () => {
    const first = await insertAuditLog(db, {
      actionType: 'CREATE', entityName: 'probe', recordId: 'p1', description: 'awal',
    });
    const second = await insertAuditLog(db, {
      actionType: 'CREATE', entityName: 'probe', recordId: 'p2', description: 'lanjut',
    });

    expect(second.prev_hash).toBe(first.entry_hash);
  });

  it('verifikasi menyatakan rantai utuh', async () => {
    const res = await verifyAuditChain(db);
    expect(res.ok).toBe(true);
    expect(res.checked).toBeGreaterThanOrEqual(2);
    expect(res.firstBrokenId).toBeNull();
  });

  it('mengubah isi baris membuat verifikasi menunjuk baris itu', async () => {
    const target = await insertAuditLog(db, {
      actionType: 'APPROVE', entityName: 'probe', recordId: 'p3', description: 'asli',
    });

    // Trigger immutability dimatikan untuk meniru penyalahgunaan hak DBA.
    await client.exec('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable');
    await client.query('UPDATE audit_logs SET description = $1 WHERE id = $2', ['diubah diam-diam', target.id]);
    await client.exec('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable');

    const res = await verifyAuditChain(db);
    expect(res.ok).toBe(false);
    expect(res.firstBrokenId).toBe(String(target.id));
  });

  it('baris warisan tanpa hash tidak dianggap rusak', async () => {
    // Baris lama (sebelum migrasi 0055) tidak punya entry_hash.
    await client.query(
      `INSERT INTO audit_logs (action_type, entity_name, record_id, description, created_at)
       VALUES ('CREATE', 'warisan', 'w1', 'baris lama', '2025-01-01T00:00:00Z')`,
    );

    const res = await verifyAuditChain(db);
    expect(res.legacy).toBeGreaterThanOrEqual(1);
    // Rantai yang sudah rusak oleh uji sebelumnya tetap terdeteksi, bukan
    // dilaporkan utuh hanya karena ada baris warisan.
    expect(res.ok).toBe(false);
  });

  it('rantai yang konsisten setelah baris warisan tetap valid', async () => {
    const { client: freshClient, db: freshDb } = await createTestDb();
    try {
      await freshClient.query(
        `INSERT INTO audit_logs (action_type, entity_name, record_id, description, created_at)
         VALUES ('CREATE', 'warisan', 'w1', 'baris lama', '2025-01-01T00:00:00Z')`,
      );
      await insertAuditLog(freshDb, {
        actionType: 'CREATE', entityName: 'baru', recordId: 'n1', description: 'setelah warisan',
      });
      await insertAuditLog(freshDb, {
        actionType: 'CREATE', entityName: 'baru', recordId: 'n2', description: 'lanjutan',
      });

      const res = await verifyAuditChain(freshDb);
      expect(res.ok).toBe(true);
      expect(res.legacy).toBe(1);
      expect(res.checked).toBe(2);
    } finally {
      await freshClient.close();
    }
  });
});
