import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ambilKunciDatabase, DatabaseLockedError } from '@/lib/db/dbLock';

const dirs: string[] = [];
function dirBaru() {
  const d = mkdtempSync(join(tmpdir(), 'epq-lock-'));
  dirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('pengunci database PGlite', () => {
  it('membuat berkas kunci berisi PID proses ini', () => {
    const d = dirBaru();
    ambilKunciDatabase(d);
    const berkas = join(d, '.eperformiq-lock');
    expect(existsSync(berkas)).toBe(true);
    const isi = JSON.parse(readFileSync(berkas, 'utf8'));
    expect(isi.pid).toBe(process.pid);
  });

  it('menolak pembukaan kedua oleh proses lain yang masih hidup', () => {
    const d = dirBaru();
    // Simulasikan proses lain yang hidup: pakai PID induk proses tes.
    writeFileSync(
      join(d, '.eperformiq-lock'),
      JSON.stringify({ pid: process.ppid, host: require('node:os').hostname(), pada: new Date().toISOString() })
    );
    expect(() => ambilKunciDatabase(d)).toThrow(DatabaseLockedError);
    // Pesannya harus memberi tahu cara memperbaiki.
    expect(() => ambilKunciDatabase(d)).toThrow(/dev:stop|MERUSAK|dipakai proses lain/i);
  });

  it('mengambil alih kunci basi (proses pemilik sudah mati)', () => {
    const d = dirBaru();
    // PID yang hampir pasti tidak ada.
    writeFileSync(
      join(d, '.eperformiq-lock'),
      JSON.stringify({ pid: 999999, host: require('node:os').hostname(), pada: new Date(0).toISOString() })
    );
    expect(() => ambilKunciDatabase(d)).not.toThrow();
    const isi = JSON.parse(readFileSync(join(d, '.eperformiq-lock'), 'utf8'));
    expect(isi.pid).toBe(process.pid);
  });

  it('melepas kunci saat diminta', () => {
    const d = dirBaru();
    const lepas = ambilKunciDatabase(d);
    expect(existsSync(join(d, '.eperformiq-lock'))).toBe(true);
    lepas();
    expect(existsSync(join(d, '.eperformiq-lock'))).toBe(false);
  });

  it('berkas kunci rusak tidak menghalangi aplikasi berjalan', () => {
    const d = dirBaru();
    writeFileSync(join(d, '.eperformiq-lock'), 'bukan json');
    expect(() => ambilKunciDatabase(d)).not.toThrow();
  });
});
