import { describe, it, expect } from 'vitest';
import { buildCertificateNo, buildVerificationCode } from '@/lib/engines/certificate-engine';

describe('certificate-engine', () => {
  it('membangun nomor sertifikat deterministik', () => {
    const d = new Date('2026-10-01T00:00:00Z');
    expect(buildCertificateNo('EMP-2022-0042', 'CLOUD-ARCH', d)).toBe('CERT-EMP20220042-CLOUDARCH-20261001');
  });
  it('membangun kode verifikasi unik & berformat', () => {
    const c = buildVerificationCode('EMP-2022-0042-CLOUD-ARCH-2026-10-01');
    expect(c).toMatch(/^[A-Z0-9]{8,}$/);
    expect(buildVerificationCode('same')).toBe(buildVerificationCode('same'));
  });
});
