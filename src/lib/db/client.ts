import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pasangPenandaDatabase } from './dbLock';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Antarmuka minimal yang dipenuhi kedua driver (PGlite & postgres-js), sehingga
 * runner migrasi/seed dan service dapat berjalan di keduanya. Driver dipilih
 * dari `DATABASE_URL`: bila ada → PostgreSQL server (produksi/Vercel);
 * bila tidak ada → PGlite (lokal & test, tanpa setup).
 */
export interface SqlClient {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[] }>;
  exec: (sql: string) => Promise<unknown>;
}

const usePostgres = !!process.env.DATABASE_URL;

/** Runtime serverless (Vercel/Lambda): FS read-only, PGlite tidak bisa dipakai. */
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const SERVERLESS_DB_HELP =
  'PGlite tidak dapat berjalan di runtime serverless (filesystem read-only). ' +
  'Set DATABASE_URL (PostgreSQL server, mis. Neon/Vercel Postgres) pada environment ' +
  'Variables, lalu jalankan `npm run db:migrate:pg` dan `npm run db:seed:pg` menuju database tersebut.';

const globalForDb = globalThis as unknown as {
  __eperformiqDb?: ReturnType<typeof drizzlePglite>;
  __eperformiqSql?: SqlClient;
};

/** Bungkus client PGlite menjadi SqlClient ({ query, exec }). */
function pgliteToSql(client: PGlite): SqlClient {
  return {
    query: async <T = any>(sql: string, params: any[] = []) => {
      const res = await client.query<T>(sql, params);
      return { rows: res.rows as T[] };
    },
    exec: (sql: string) => client.exec(sql),
  };
}

/** postgres-js: adapter ke SqlClient ({ query, exec }), positional ($1, $2). */
function postgresToSql(client: postgres.Sql): SqlClient {
  return {
    query: async <T = any>(statement: string, params: any[] = []) => {
      const rows = await client.unsafe<T[]>(statement, params);
      return { rows: rows as unknown as T[] };
    },
    exec: (statement: string) => client.unsafe(statement),
  };
}

function createDb() {
  if (usePostgres) {
    const client = postgres(process.env.DATABASE_URL as string, {
      max: 1, // serverless: satu koneksi per invocation
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false, // kompatibel dengan connection pooler (pgbouncer/Supavisor)
      connection: {
        TimeZone: 'Asia/Jakarta',
      },
    });
    globalForDb.__eperformiqSql = postgresToSql(client);
    return drizzlePostgres(client);
  }

  // Serverless tanpa DATABASE_URL: PGlite akan menulis ke FS read-only → gagal.
  // Berikan error yang jelas (bukan EROFS samar) lewat adapter yang melempar.
  if (isServerless) {
    const throwHelp = async () => {
      throw new Error(SERVERLESS_DB_HELP);
    };
    globalForDb.__eperformiqSql = { query: throwHelp as any, exec: throwHelp as any };
    return drizzlePglite(new PGlite());
  }

  // Pasang penangan penutupan SEBELUM PGlite membuka berkas, agar tidak ada
  // celah saat proses dimatikan di antara pembuatan client dan pemasangan.
  pasangPenutupanRapi();

  // Catat proses yang membuka database. Hanya penanda informatif — TIDAK
  // menolak pembukaan kedua, karena `next dev` memuat modul ini di beberapa
  // proses (server + worker render) yang semuanya sah.
  pasangPenandaDatabase();

  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), '.pglite'));
  // Set default timezone ke Asia/Jakarta (WIB, UTC+7)
  client.exec("SET timezone = 'Asia/Jakarta';").catch(() => {});
  globalForDb.__eperformiqSql = pgliteToSql(client);

  // Daftarkan client baru agar ikut ditutup saat proses berhenti.
  daftarkanClientUntukPenutupan(client);

  return drizzlePglite(client);
}

/**
 * Pastikan berkas PGlite ditutup sebelum proses berhenti.
 *
 * Dipanggil setiap kali client PGlite dibuat. Dua hal yang dijaga:
 *
 * 1. `next dev` memuat ulang modul, sehingga client bisa dibuat berkali-kali
 *    dalam satu proses. Penangan sinyalnya cukup dipasang sekali, tetapi
 *    daftar client yang perlu ditutup harus ikut diperbarui.
 * 2. Penangan dipasang SEBELUM client membuka berkas (lihat pemanggilannya),
 *    sehingga tidak ada celah saat proses dimatikan di antara keduanya.
 */
function pasangPenutupanRapi(): void {
  const g = globalThis as any;

  // Daftar client hidup; dipakai agar semua instance ditutup, bukan hanya yang
  // terakhir dibuat.
  if (!Array.isArray(g.__eperformiqPgliteClients)) {
    g.__eperformiqPgliteClients = [];
  }

  if (g.__eperformiqPenutupanTerpasang) return;
  g.__eperformiqPenutupanTerpasang = true;

  let sedangMenutup = false;
  const tutupSemua = async (kode?: number) => {
    if (sedangMenutup) return;
    sedangMenutup = true;
    const daftar: PGlite[] = g.__eperformiqPgliteClients ?? [];
    // Tutup berurutan: PGlite tidak aman ditutup bersamaan.
    for (const c of daftar) {
      try {
        await c.close();
      } catch {
        /* abaikan: yang penting percobaan penutupan sudah dilakukan */
      }
    }
    g.__eperformiqPgliteClients = [];
    if (typeof kode === 'number') process.exit(kode);
  };

  process.once('SIGINT', () => void tutupSemua(130));
  process.once('SIGTERM', () => void tutupSemua(143));

  // `exit` menangkap proses yang berakhir karena sebab apa pun (termasuk
  // TerminateProcess yang tidak mengirim SIGTERM di Windows). Di sini hanya
  // ada waktu untuk percobaan penutupan singkat; PGlite tidak punya jalur
  // sinkron, jadi hasilnya bergantung pada cepatnya close() dimulai.
  process.once('exit', () => {
    if (sedangMenutup) return;
    sedangMenutup = true;
    const daftar: PGlite[] = g.__eperformiqPgliteClients ?? [];
    for (const c of daftar) {
      try {
        void c.close();
      } catch {
        /* abaikan */
      }
    }
  });

  process.once('beforeExit', () => void tutupSemua());
}

/** Tambahkan client ke daftar yang akan ditutup saat proses berhenti. */
function daftarkanClientUntukPenutupan(client: PGlite): void {
  const g = globalThis as any;
  if (!Array.isArray(g.__eperformiqPgliteClients)) {
    g.__eperformiqPgliteClients = [];
  }
  g.__eperformiqPgliteClients.push(client);
}

/**
 * Singleton: Next.js dev me-reload modul, dan setiap reload membuat instance
 * baru sehingga koneksi menumpuk serta file dataDir terkunci.
 *
 * `db` di-tipe sebagai Drizzle PGlite (kontrak yang dipakai aplikasi) agar
 * `.execute()/.select()` tetap menghasilkan tipe `{ rows }` yang stabil,
 * meski runtime-nya dapat berupa postgres-js bila DATABASE_URL di-set.
 */
export type AppDb = ReturnType<typeof drizzlePglite>;

/**
 * Normalisasi hasil `.execute()` agar SELALU berbentuk `{ rows: T[] }`
 * untuk kedua driver. `drizzle-orm/pglite` mengembalikan `{ rows }`,
 * sedangkan `drizzle-orm/postgres-js` mengembalikan array polos — perbedaan
 * ini dulu membuat `result.rows[0]` undefined di produksi (PostgreSQL).
 *
 * Diekspor agar objek transaksi (`tx`) juga dapat dinormalisasi: transaksi
 * tidak diambil dari `db` ter-normalisasi, sehingga tanpa ini seluruh query
 * di dalam transaksi kehilangan bentuk `{ rows }` pada driver PostgreSQL.
 */
export function withNormalizedExecute<T extends object>(instance: T): T {
  const original = (instance as any).execute.bind(instance);
  (instance as any).execute = async (query: any) => {
    const result = await original(query);
    if (Array.isArray(result)) return { rows: result };
    if (result && Array.isArray((result as any).rows)) return result;
    if (result && typeof result === 'object') return { rows: [result] };
    return { rows: [] };
  };
  return instance;
}

const rawDb = globalForDb.__eperformiqDb ?? (globalForDb.__eperformiqDb = createDb() as unknown as AppDb);

export const db: AppDb = withNormalizedExecute(rawDb) as unknown as AppDb;

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__eperformiqDb = rawDb;
}

/** Mengembalikan SqlClient ({ query, exec }) untuk driver yang aktif. */
export async function getDb(): Promise<SqlClient> {
  if (globalForDb.__eperformiqSql) return globalForDb.__eperformiqSql;
  // Fallback: PGlite menyimpan client di internal session.
  const pgliteClient = (rawDb as any).session?.client;
  return (pgliteClient ?? rawDb) as unknown as SqlClient;
}

/** True bila aplikasi memakai PostgreSQL server (DATABASE_URL), bukan PGlite. */
export function isPostgresServer(): boolean {
  return usePostgres;
}

export type Db = AppDb;
