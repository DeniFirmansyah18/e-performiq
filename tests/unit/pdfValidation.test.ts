import { describe, it, expect } from 'vitest';
import { validatePdf } from '@/lib/storage/pdfValidation';

/** PDF minimal yang valid menurut struktur (header + trailer). */
function minimalPdf(extraPages = 0): Buffer {
  const pageObjects = Array.from({ length: extraPages })
    .map((_, i) => `${4 + i} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`)
    .join('');
  const count = 1 + extraPages;
  return Buffer.from(
    '%PDF-1.7\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count ${count} >>\nendobj\n` +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
    pageObjects +
    'trailer\n<< /Root 1 0 R >>\n%%EOF\n',
    'latin1',
  );
}

describe('validatePdf', () => {
  it('menerima PDF dengan header dan trailer lengkap', async () => {
    const res = await validatePdf(minimalPdf(), { maxPages: 10 });
    expect(res.ok).toBe(true);
    expect(res.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('menolak berkas tanpa magic bytes %PDF', async () => {
    const res = await validatePdf(Buffer.from('bukan pdf sama sekali'), { maxPages: 10 });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/bukan PDF/i);
  });

  it('menolak berkas yang diawali %PDF tetapi tanpa %%EOF', async () => {
    const res = await validatePdf(Buffer.from('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n'), { maxPages: 10 });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/tidak lengkap|rusak/i);
  });

  it('menolak berkas kosong', async () => {
    const res = await validatePdf(Buffer.alloc(0), { maxPages: 10 });
    expect(res.ok).toBe(false);
  });

  it('menolak PDF yang jumlah halamannya melebihi batas', async () => {
    const res = await validatePdf(minimalPdf(20), { maxPages: 5 });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/halaman/i);
  });

  it('menolak HTML yang menyamar sebagai PDF', async () => {
    const fake = Buffer.from('%PDF-1.4\n<html><script>alert(1)</script></html>\n%%EOF');
    const res = await validatePdf(fake, { maxPages: 10 });
    expect(res.ok).toBe(false);
  });
});
