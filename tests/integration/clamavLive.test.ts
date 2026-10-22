/**
 * Uji hook ClamAV terhadap clamscan SUNGGUHAN (mode CLI).
 * Dilewati bila CLAMAV_CLI_PATH tidak tersedia.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { scanBuffer, clamavConfigured } from '@/lib/storage/scanFile';

const CLI = process.env.CLAMAV_CLI_PATH ?? 'C:\\Program Files\\ClamAV\\clamscan.exe';
const DB = process.env.CLAMAV_DATABASE_DIR;

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const available = existsSync(CLI) && Boolean(DB) && existsSync(DB as string);

describe('scanFile — clamscan sungguhan (mode CLI)', () => {
  beforeAll(() => {
    if (!available) {
      console.warn('[skip] clamscan/database tidak tersedia di mesin ini');
      return;
    }
    process.env.CLAMAV_MODE = 'cli';
    process.env.CLAMAV_CLI_PATH = CLI;
    process.env.CLAMAV_DATABASE_DIR = DB;
  });

  it('mendeteksi berkas uji EICAR sebagai INFECTED', async () => {
    if (!available) return;

    const res = await scanBuffer(Buffer.from(EICAR, 'ascii'));
    expect(res.status).toBe('INFECTED');
    expect(res.engine).toBe('clamav');
    expect(res.signature).toMatch(/Eicar/i);
  });

  it('PDF bersih dinyatakan CLEAN', async () => {
    if (!available) return;

    const pdf = Buffer.from('%PDF-1.7\nisi dokumen resmi\n%%EOF', 'latin1');
    const res = await scanBuffer(pdf);
    expect(res.status).toBe('CLEAN');
    expect(res.engine).toBe('clamav');
  });

  it('konfigurasi terbaca', () => {
    if (!available) return;
    expect(clamavConfigured()).toBe(true);
  });
});
