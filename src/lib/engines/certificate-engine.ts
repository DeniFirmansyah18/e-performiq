// Certificate Engine — nomor sertifikat & kode verifikasi deterministik.
export function buildCertificateNo(employeeCode: string, courseCode: string, date: Date): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  const emp = employeeCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const crs = courseCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `CERT-${emp}-${crs}-${d}`;
}

export function buildVerificationCode(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().padStart(8, '0').slice(0, 12);
}
