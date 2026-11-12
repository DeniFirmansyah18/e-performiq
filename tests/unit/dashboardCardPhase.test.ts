import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { phaseOf, FEATURE_PHASE } from '@/lib/employee/phase';

/**
 * Daftar fitur pada kartu dashboard HR diambil langsung dari sumbernya.
 *
 * Kesalahan yang pernah terjadi: kartu memakai kode 'job-postings' (jamak),
 * sedangkan FEATURE_PHASE mendaftarkan 'job-posting' (tunggal). phaseOf()
 * jatuh ke default DURING sehingga kartu tidak pernah muncul di fase
 * Perencanaan Kebutuhan. Tes ini memastikan SETIAP fitur yang dipasang pada
 * kartu benar-benar terdaftar, dan fasenya cocok dengan golongannya.
 */
const BERKAS = resolve(process.cwd(), 'src/app/dashboard/hr-command/page.tsx');

interface Kartu {
  kode: string;
  grup: string;
  fase: string | null;
}

/** Ambil daftar kartu beserta fase golongannya dari halaman dashboard. */
export function bacaKartuDashboard(sumber: string): Kartu[] {
  // Pisahkan blok per fase: PRE: [ ... ], DURING: [ ... ], POST: [ ... ]
  const faseGrup = new Map<string, string>();
  for (const fase of ['PRE', 'DURING', 'POST'] as const) {
    const polaBlok = new RegExp(`${fase}:\\s*\\[([\\s\\S]*?)\\n  \\]`, 'm');
    const blok = polaBlok.exec(sumber)?.[1] ?? '';
    const polaJudul = /judul:\s*"([^"]+)"/g;
    let jd: RegExpExecArray | null;
    while ((jd = polaJudul.exec(blok))) {
      faseGrup.set(jd[1], fase);
    }
  }

  // Tiap kartu: { judul: "...", ket: "...", fitur: ["mpp", "job-postings"] }
  const hasil: Kartu[] = [];
  const pola = /\{\s*judul:\s*"([^"]+)",\s*ket:[^}]*?fitur:\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(sumber))) {
    const judul = m[1];
    const polaKode = /"([^"]+)"/g;
    let kd: RegExpExecArray | null;
    while ((kd = polaKode.exec(m[2]))) {
      hasil.push({ kode: kd[1], grup: judul, fase: faseGrup.get(judul) ?? null });
    }
  }
  return hasil;
}

describe('fase fitur kartu dashboard HR', () => {
  const sumber = readFileSync(BERKAS, 'utf8');
  const kartu = bacaKartuDashboard(sumber);

  it('berhasil membaca daftar kartu (bukan kosong)', () => {
    expect(kartu.length, 'daftar kartu terbaca').toBeGreaterThan(10);
    // Grup "Perencanaan Kebutuhan" harus terbaca bersama fasenya.
    const pre = kartu.filter((k) => k.grup === 'Perencanaan Kebutuhan');
    expect(pre.length, 'kartu di Perencanaan Kebutuhan').toBeGreaterThan(0);
    expect(pre.every((k) => k.fase === 'PRE'), 'Perencanaan Kebutuhan = fase PRE').toBe(true);
  });

  it('setiap fitur kartu terdaftar di FEATURE_PHASE', () => {
    const tidakTerdaftar = kartu
      .filter((k) => !(k.kode in FEATURE_PHASE))
      .map((k) => `${k.kode} (grup: ${k.grup})`);
    expect(tidakTerdaftar, `fitur tanpa fase eksplisit: ${tidakTerdaftar.join(', ')}`).toEqual([]);
  });

  it('fase fitur kartu sesuai dengan fase golongannya', () => {
    const salahFase = kartu
      .filter((k) => k.fase && phaseOf(k.kode) !== k.fase)
      .map((k) => `${k.kode}: grup "${k.grup}" (${k.fase}) tapi phaseOf=${phaseOf(k.kode)}`);
    expect(salahFase, `kartu yang tidak akan tampil di golongannya: ${salahFase.join('; ')}`).toEqual([]);
  });

  it('Kelola Lowongan terdaftar di golongan Perencanaan Kebutuhan (fase Pra-Kerja)', () => {
    const kelola = kartu.find((k) => k.kode === 'job-postings');
    expect(kelola, 'kartu job-postings ada di halaman').toBeTruthy();
    expect(kelola!.grup).toBe('Perencanaan Kebutuhan');
    expect(phaseOf('job-postings')).toBe('PRE');
  });
});
