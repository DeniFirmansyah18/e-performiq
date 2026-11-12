import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Pengunci berkas untuk PGlite.
 *
 * PGlite 0.2.x TIDAK mengunci direktori datanya: dua proses dapat membuka
 * `.pglite` yang sama dan menulis bersamaan. Hasilnya berkas rusak dan semua
 * query berikutnya gagal dengan "RuntimeError: Aborted()".
 *
 * Inilah penyebab utama error tersebut di proyek ini — biasanya karena dua
 * `next dev` (atau `next dev` + skrip) berjalan bersamaan. Pengunci ini
 * menolak pembukaan kedua dengan pesan yang jelas, bukan biarkan data rusak.
 */

export class DatabaseLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseLockedError';
  }
}

interface IsiLock {
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

function bacaLock(berkas: string): IsiLock | null {
  try {
    const isi = JSON.parse(readFileSync(berkas, 'utf8'));
    return typeof isi?.pid === 'number' ? (isi as IsiLock) : null;
  } catch {
    return null;
  }
}

/**
 * Ambil kunci untuk direktori data tertentu.
 *
 * Kunci basi (proses pemiliknya sudah mati) otomatis diambil alih, sehingga
 * crash sebelumnya tidak membuat aplikasi mustahil dijalankan.
 */
export function ambilKunciDatabase(dataDir?: string): () => void {
  const dir = dataDir ?? process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), '.pglite');
  const berkas = join(dir, '.eperformiq-lock');

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* direktori akan dibuat sendiri oleh PGlite */
  }

  const kunciLama = bacaLock(berkas);
  if (kunciLama && kunciLama.pid !== process.pid && prosesHidup(kunciLama.pid)) {
    // Kunci milik proses lain yang masih hidup.
    if (kunciLama.host !== require('node:os').hostname()) {
      throw new DatabaseLockedError(
        `Database sedang dipakai proses lain (PID ${kunciLama.pid}). ` +
          'Tutup proses tersebut, lalu jalankan ulang.'
      );
    }
    throw new DatabaseLockedError(
      `Database sedang dipakai proses lain (PID ${kunciLama.pid}, sejak ${kunciLama.pada}).\n` +
        'Kemungkinan ada server dev lain yang masih berjalan. Hentikan dengan `npm run dev:stop`, ' +
        'lalu jalankan ulang. Menjalankan dua proses sekaligus MERUSAK berkas database.'
    );
  }

  const isi: IsiLock = {
    pid: process.pid,
    host: require('node:os').hostname(),
    pada: new Date().toISOString(),
  };
  try {
    writeFileSync(berkas, JSON.stringify(isi), 'utf8');
  } catch {
    /* gagal menulis kunci bukan alasan menghentikan aplikasi */
  }

  let sudahLepas = false;
  const lepas = () => {
    if (sudahLepas) return;
    sudahLepas = true;
    try {
      // Hanya hapus bila kunci masih milik proses ini.
      const isiKini = bacaLock(berkas);
      if (!isiKini || isiKini.pid === process.pid) {
        if (existsSync(berkas)) unlinkSync(berkas);
      }
    } catch {
      /* abaikan */
    }
  };

  process.once('exit', lepas);
  return lepas;
}
