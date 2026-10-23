import { describe, it, expect } from 'vitest';
import { verdictFromScan } from '@/lib/storage/scanFile';

const EICAR_LINE = 'C:\\Users\\x\\AppData\\Local\\Temp\\epq-scan-1\\upload.bin: Eicar-Test-Signature.UNOFFICIAL FOUND';
const OK_LINE = 'C:\\Users\\x\\AppData\\Local\\Temp\\epq-scan-1\\upload.bin: OK';

describe('verdictFromScan', () => {
  it('kode keluar 0 + OK → CLEAN', () => {
    const res = verdictFromScan(0, OK_LINE, '');
    expect(res.status).toBe('CLEAN');
    expect(res.engine).toBe('clamav');
  });

  it('kode keluar 1 + FOUND → INFECTED dengan nama signature', () => {
    const res = verdictFromScan(1, EICAR_LINE, '');
    expect(res.status).toBe('INFECTED');
    expect(res.signature).toBe('Eicar-Test-Signature.UNOFFICIAL');
  });

  it('kode keluar 1 tanpa keluaran apa pun → SKIPPED, bukan INFECTED', () => {
    const res = verdictFromScan(1, '', '');
    expect(res.status).toBe('SKIPPED');
    expect(res.reason).toMatch(/tanpa keterangan/i);
  });

  it('kode keluar 1 dengan keluaran tak dikenal → SKIPPED, bukan INFECTED', () => {
    const res = verdictFromScan(1, 'LibClamAV Warning: something odd', '');
    expect(res.status).toBe('SKIPPED');
    expect(res.reason).toBeTruthy();
  });

  it('verdict dibaca dari stderr juga bila clamscan menulis ke sana', () => {
    const res = verdictFromScan(1, '', EICAR_LINE);
    expect(res.status).toBe('INFECTED');
    expect(res.signature).toMatch(/Eicar/i);
  });

  it('kode keluar null (timeout / gagal spawn) → SKIPPED', () => {
    expect(verdictFromScan(null, '', 'timeout').status).toBe('SKIPPED');
  });

  it('kode keluar 2 (galat pemindai) → SKIPPED dengan alasan', () => {
    const res = verdictFromScan(2, '', "ERROR: Can't open file");
    expect(res.status).toBe('SKIPPED');
    expect(res.reason).toMatch(/Can't open file|tidak dikenali/i);
  });

  it('FOUND menang atas OK bila keduanya muncul', () => {
    const res = verdictFromScan(1, `${OK_LINE}\n${EICAR_LINE}`, '');
    expect(res.status).toBe('INFECTED');
  });
});
