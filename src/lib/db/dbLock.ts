import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { hostname } from 'node:os';

/**
 * Penanda berkas untuk PGlite (`.eperformiq-lock`).
 *
 * Berkas ini mencatat PID + host proses yang membuka database, sehingga proses
 * asing yang menumpuk mudah diperiksa (isi berkasnya).
 *
 * PENTING: penanda ini TIDAK menolak pembukaan kedua. `next dev` menjalankan
 * server dan worker render sebagai proses terpisah yang keduanya memuat modul
 * database; menolak "proses kedua" akan memblokir aplikasi sendiri (seluruh API
 * gagal 500). Kesalahan itu pernah terjadi dan sudah diperbaiki di sini.
 */

interface IsiPenanda {
  pid: number;
  host: string;
  pada: string;
}

/** Apakah proses dengan pid ini masih hidup di mesin yang sama? */
function prosesHidup(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0); // sinyal 0 = hanya memeriksa keberadaan
    return true;
  } catch (e: any) {
    // EPERM = proses ada tetapi bukan milik kita.
    return e?.code === 'EPERM';
  }
}

function baca(berkas: string): IsiPenanda | null {
  try {
    const isi = JSON.parse(readFileSync(berkas, 'utf8'));
    return typeof isi?.pid === 'number' ? (isi as IsiPenanda) : null;
  } catch {
    return null;
  }
}

/**
 * Catat proses yang membuka database. Mengembalikan fungsi untuk melepas
 * penanda (dipanggil otomatis saat proses keluar).
 */
export function pasangPenandaDatabase(dataDir?: string): () => void {
  const dir = dataDir ?? process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), '.pglite');
  const berkas = join(dir, '.eperformiq-lock');

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* direktori akan dibuat sendiri oleh PGlite */
  }

  // Jika pemilik sebelumnya sudah mati, ini penanda basi: timpa.
  const lama = baca(berkas);
  if (lama && lama.pid !== process.pid && !prosesHidup(lama.pid)) {
    // penanda basi — aman ditimpa
  }

  try {
    writeFileSync(
      berkas,
      JSON.stringify({ pid: process.pid, host: hostname(), pada: new Date().toISOString() }),
      'utf8'
    );
  } catch {
    /* gagal menulis penanda bukan alasan menghentikan aplikasi */
  }

  let sudahLepas = false;
  const lepas = () => {
    if (sudahLepas) return;
    sudahLepas = true;
    try {
      // Hanya hapus bila penanda masih milik proses ini.
      const kini = baca(berkas);
      if ((!kini || kini.pid === process.pid) && existsSync(berkas)) unlinkSync(berkas);
    } catch {
      /* abaikan */
    }
  };

  process.once('exit', lepas);
  return lepas;
}

/** Apakah proses lain (selain milik kita) pernah membuka database ini? */
export function adaProsesLain(dataDir?: string): { pid: number; pada: string } | null {
  const dir = dataDir ?? process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), '.pglite');
  const isi = baca(join(dir, '.eperformiq-lock'));
  if (!isi || isi.pid === process.pid) return null;
  if (!prosesHidup(isi.pid)) return null;
  return { pid: isi.pid, pada: isi.pada };
}
