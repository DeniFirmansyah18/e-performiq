import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
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

  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), '.pglite'));
  globalForDb.__eperformiqSql = pgliteToSql(client);
  return drizzlePglite(client);
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

export const db: AppDb =
  globalForDb.__eperformiqDb ?? (globalForDb.__eperformiqDb = createDb() as unknown as AppDb);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__eperformiqDb = db;
}

/** Mengembalikan SqlClient ({ query, exec }) untuk driver yang aktif. */
export async function getDb(): Promise<SqlClient> {
  if (globalForDb.__eperformiqSql) return globalForDb.__eperformiqSql;
  // Fallback: PGlite menyimpan client di internal session.
  const pgliteClient = (db as any).session?.client;
  return (pgliteClient ?? db) as unknown as SqlClient;
}

/** True bila aplikasi memakai PostgreSQL server (DATABASE_URL), bukan PGlite. */
export function isPostgresServer(): boolean {
  return usePostgres;
}

export type Db = AppDb;
