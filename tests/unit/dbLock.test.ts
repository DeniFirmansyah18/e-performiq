import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { pasangPenandaDatabase, adaProsesLain } from '@/lib/db/dbLock';

const dirs: string[] = [];
function dirBaru() {
  const d = mkdtempSync(join(tmpdir(), 'epq-penanda-'));
  dirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('penanda database', () => {
  it('mencatat PID & host proses ini', () => {
    const d = dirBaru();
    pasangPenandaDatabase(d);
    const isi = JSON.parse(readFileSync(join(d, '.eperformiq-lock'), 'utf8'));
    expect(isi.pid).toBe(process.pid);
    expect(isi.host).toBe(hostname());
  });

  it('TIDAK menolak pembukaan kedua (next dev memakai beberapa proses)', () => {
    const d = dirBaru();
    // Penanda milik proses induk yang masih hidup (mewakili worker Next.js).
    writeFileSync(
      join(d, '.eperformiq-lock'),
      JSON.stringify({ pid: process.ppid, host: hostname(), pada: new Date().toISOString() })
    );
    // Inti perbaikan: dulu ini melempar DatabaseLockedError dan memblokir API.
    expect(() => pasangPenandaDatabase(d)).not.toThrow();
    const isi = JSON.parse(readFileSync(join(d, '.eperformiq-lock'), 'utf8'));
    expect(isi.pid).toBe(process.pid);
  });

  it('melepas penanda saat diminta', () => {
    const d = dirBaru();
    const lepas = pasangPenandaDatabase(d);
    expect(existsSync(join(d, '.eperformiq-lock'))).toBe(true);
    lepas();
    expect(existsSync(join(d, '.eperformiq-lock'))).toBe(false);
  });

  it('penanda rusak tidak menghalangi aplikasi', () => {
    const d = dirBaru();
    writeFileSync(join(d, '.eperformiq-lock'), 'bukan json');
    expect(() => pasangPenandaDatabase(d)).not.toThrow();
  });

  it('adaProsesLain() mendeteksi pemilik lain yang masih hidup', () => {
    const d = dirBaru();
    writeFileSync(
      join(d, '.eperformiq-lock'),
      JSON.stringify({ pid: process.ppid, host: hostname(), pada: '2026-01-01T00:00:00.000Z' })
    );
    expect(adaProsesLain(d)?.pid).toBe(process.ppid);
  });

  it('adaProsesLain() mengabaikan pemilik yang sudah mati', () => {
    const d = dirBaru();
    writeFileSync(
      join(d, '.eperformiq-lock'),
      JSON.stringify({ pid: 999999, host: hostname(), pada: '2026-01-01T00:00:00.000Z' })
    );
    expect(adaProsesLain(d)).toBeNull();
  });
});
