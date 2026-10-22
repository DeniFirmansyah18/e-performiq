/**
 * Helper untuk script startup layanan lokal (S3 + ClamAV).
 *
 * Fungsi di sini murni (kecuali probe jaringan) supaya bisa diuji tanpa
 * menyalakan layanan sungguhan. `dev-services.ps1` hanya mengorkestrasi.
 */
import { readFileSync, existsSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {Record<string, string>} EnvMap
 * @typedef {{ host: string, port: number, url: string }} Endpoint
 * @typedef {object} StorageConfig
 * @property {'s3' | 'local'} driver
 * @property {string | null} bucket
 * @property {string | null} region
 * @property {string} host
 * @property {number} port
 * @property {string} endpoint
 * @property {boolean} forcePathStyle
 * @property {string[]} missing
 * @typedef {object} ClamavConfig
 * @property {'cli' | 'daemon'} mode
 * @property {string | null} cliPath
 * @property {string | null} daemonHost
 * @property {number} daemonPort
 * @property {string | null} databaseDir
 * @property {number} timeoutMs
 * @property {boolean} requireScan
 * @property {boolean} ready
 * @property {string[]} problems
 * @typedef {{ fileExists?: (path: string) => boolean }} ClamavDeps
 */

/**
 * Parse teks .env: KEY=VALUE, komentar dilewati, tanda kutip dibuang.
 * @param {string} text
 * @returns {EnvMap}
 */
export function parseEnvText(text) {
  const env = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * Baca .env lalu .env.local (yang terakhir menang), seperti Next.js.
 * @param {string} [cwd]
 * @returns {EnvMap}
 */
export function readEnvFile(cwd = process.cwd()) {
  const merged = {};
  for (const name of ['.env', '.env.local']) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    Object.assign(merged, parseEnvText(readFileSync(path, 'utf8')));
  }
  return merged;
}

/**
 * @param {string | undefined} endpoint
 * @returns {Endpoint}
 */
function parseEndpoint(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return { host: '127.0.0.1', port: 9000, url: 'http://127.0.0.1:9000' };
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const u = new URL(withScheme);
    const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 9000);
    const scheme = u.protocol.replace(':', '');
    return { host: u.hostname, port, url: `${scheme}://${u.hostname}:${port}` };
  } catch {
    return { host: '127.0.0.1', port: 9000, url: 'http://127.0.0.1:9000' };
  }
}

const STORAGE_KEYS = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];

/**
 * Tentukan driver penyimpanan efektif + apa yang kurang.
 * @param {EnvMap} [env]
 * @returns {StorageConfig}
 */
export function resolveStorageConfig(env = {}) {
  const missing = STORAGE_KEYS.filter((k) => !env[k]);
  const endpoint = parseEndpoint(env.S3_ENDPOINT);
  return {
    driver: missing.length === 0 ? 's3' : 'local',
    bucket: env.S3_BUCKET || null,
    region: env.S3_REGION || null,
    host: endpoint.host,
    port: endpoint.port,
    endpoint: endpoint.url,
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
    missing,
  };
}

/**
 * Konfigurasi ClamAV. `fileExists` disuntikkan agar bisa diuji tanpa disk.
 * `ready=false` berarti unggahan akan berstatus SKIPPED (atau ditolak 503
 * bila SOP_UPLOAD_REQUIRE_SCAN=1).
 * @param {EnvMap} [env]
 * @param {ClamavDeps} [deps]
 * @returns {ClamavConfig}
 */
export function resolveClamavConfig(env = {}, deps = {}) {
  const fileExists = deps.fileExists ?? ((p) => existsSync(p));
  const mode = env.CLAMAV_MODE === 'cli' ? 'cli' : 'daemon';
  const problems = [];

  let cliPath = env.CLAMAV_CLI_PATH || null;
  let daemonHost = env.CLAMAV_HOST || null;
  const daemonPort = Number(env.CLAMAV_PORT || 3310);

  if (mode === 'cli') {
    if (!cliPath) {
      problems.push('CLAMAV_CLI_PATH kosong (mode cli memerlukan path clamscan).');
    } else if (!fileExists(cliPath)) {
      problems.push(`clamscan tidak ditemukan di ${cliPath}.`);
    }
  } else if (!daemonHost) {
    problems.push('CLAMAV_HOST kosong (mode daemon memerlukan host clamd).');
  }

  const databaseDir = env.CLAMAV_DATABASE_DIR || null;
  if (databaseDir && !fileExists(databaseDir)) {
    problems.push(`Direktori signature tidak ditemukan: ${databaseDir}.`);
  }

  return {
    mode,
    cliPath,
    daemonHost,
    daemonPort,
    databaseDir,
    timeoutMs: Number(env.CLAMAV_TIMEOUT_MS || 30000),
    requireScan: env.SOP_UPLOAD_REQUIRE_SCAN === '1',
    ready: problems.length === 0,
    problems,
  };
}

/**
 * Argumen `weed server` untuk gateway S3.
 * @param {{ dataDir: string, s3Port?: number, ip?: string }} options
 * @returns {string[]}
 */
export function buildWeedServerArgs({ dataDir, s3Port = 8333, ip = '127.0.0.1' }) {
  const args = ['server', `-dir=${dataDir}`, '-s3', `-s3.port=${s3Port}`, `-ip=${ip}`];
  return args;
}

/**
 * Direktori data SeaweedFS.
 * @param {EnvMap} [env]
 * @returns {string}
 */
export function weedDataDir(env = {}) {
  if (env.S3_DATA_DIR) return env.S3_DATA_DIR;
  const base = env.LOCALAPPDATA || process.env.LOCALAPPDATA || process.env.HOME || homedir();
  return join(base, 'epq-s3', 'data');
}

/**
 * URL path-style untuk sebuah bucket.
 * @param {string} endpoint
 * @param {string} bucket
 * @returns {string}
 */
export function bucketUrl(endpoint, bucket) {
  return `${String(endpoint).replace(/\/+$/, '')}/${bucket}`;
}

/**
 * Cek port terbuka; tidak pernah melempar.
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function probePort(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
  });
}

/**
 * Cek URL merespons status < 500; tidak pernah melempar.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export async function probeHttp(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tunggu sampai `check` mengembalikan true atau waktu habis.
 * @param {() => boolean | Promise<boolean>} check
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
export async function waitFor(check, { timeoutMs = 30000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* CLI: dipakai scripts/dev-services.ps1                               */
/* ------------------------------------------------------------------ */

/**
 * Mencetak konfigurasi turunan sebagai JSON. Sengaja TIDAK memuat nilai
 * rahasia (access key, secret) — hanya host/port/nama bucket/mode/path.
 * @param {EnvMap} [env]
 * @returns {object}
 */
export function configSummary(env = readEnvFile()) {
  const storage = resolveStorageConfig(env);
  const clamav = resolveClamavConfig(env);
  return {
    storage: {
      driver: storage.driver,
      bucket: storage.bucket,
      host: storage.host,
      port: storage.port,
      endpoint: storage.endpoint,
      forcePathStyle: storage.forcePathStyle,
      missing: storage.missing,
    },
    clamav: {
      mode: clamav.mode,
      cliPath: clamav.cliPath,
      daemonHost: clamav.daemonHost,
      daemonPort: clamav.daemonPort,
      databaseDir: clamav.databaseDir,
      requireScan: clamav.requireScan,
      ready: clamav.ready,
      problems: clamav.problems,
    },
    dataDir: weedDataDir(env),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  if (arg === '--config') {
    console.log(JSON.stringify(configSummary()));
  } else if (arg === '--weed-args') {
    const env = readEnvFile();
    const storage = resolveStorageConfig(env);
    console.log(JSON.stringify(buildWeedServerArgs({
      dataDir: weedDataDir(env),
      s3Port: storage.port,
      ip: storage.host,
    })));
  } else {
    console.error('Usage: node scripts/services-lib.mjs --config | --weed-args');
    process.exit(2);
  }
}
