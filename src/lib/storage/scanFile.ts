import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type ScanStatus = 'CLEAN' | 'INFECTED' | 'SKIPPED';

export interface ScanResult {
  status: ScanStatus;
  engine: 'clamav' | 'none';
  signature?: string;
  reason?: string;
}

/**
 * Mode pemindaian:
 *  - `daemon` (default): kirim ke clamd lewat TCP (INSTREAM). Cocok untuk
 *    container/Linux tempat clamd berjalan sebagai service.
 *  - `cli`: jalankan `clamscan` per berkas. Dipakai di Windows tanpa hak admin,
 *    karena clamd di Windows memerlukan instalasi sebagai service.
 */
function scanMode(): 'daemon' | 'cli' {
  return process.env.CLAMAV_MODE === 'cli' ? 'cli' : 'daemon';
}

/** Hook ClamAV aktif bila CLAMAV_HOST diisi (daemon) atau CLAMAV_CLI_PATH (cli). */
export function clamavConfigured(): boolean {
  if (scanMode() === 'cli') return Boolean(process.env.CLAMAV_CLI_PATH);
  return Boolean(process.env.CLAMAV_HOST);
}

/** Membaca verdict baris `clamscan`/`clamd` menjadi ScanResult. */
function parseVerdict(text: string, engine: 'clamav'): ScanResult {
  const clean = text.replace(/\0/g, '').trim();
  const found = clean.match(/(?:stream|.+):\s*(.+?)\s+FOUND/);
  if (found) return { status: 'INFECTED', engine, signature: found[1] };
  if (/\bOK$/.test(clean) || /:\s*OK\b/.test(clean)) return { status: 'CLEAN', engine };
  return { status: 'SKIPPED', engine, reason: `Balasan pemindai tidak dikenali: ${clean.slice(-200)}` };
}

/**
 * Menerjemahkan keluaran `clamscan` menjadi verdict.
 *
 * Aturan penting: **kode keluar 1 saja tidak cukup** untuk menyatakan
 * INFECTED. Di Windows, clamscan kadang keluar dengan kode 1 tanpa keluaran
 * apa pun (mis. gagal membuat direktori sementara); memperlakukannya sebagai
 * INFECTED membuat berkas bersih ditolak dan signature-nya kosong. Tanpa bukti
 * `FOUND`, hasilnya SKIPPED — pemanggil yang memutuskan (lihat
 * SOP_UPLOAD_REQUIRE_SCAN) daripada menebak.
 */
export function verdictFromScan(code: number | null, stdout: string, stderr: string): ScanResult {
  if (code === null) {
    return {
      status: 'SKIPPED',
      engine: 'clamav',
      reason: `clamscan gagal dijalankan: ${stderr.trim().slice(-160) || 'tidak ada keluaran'}`,
    };
  }

  const combined = `${stdout}\n${stderr}`;
  const parsed = parseVerdict(combined, 'clamav');

  // FOUND selalu menang, bahkan bila baris OK juga muncul.
  if (parsed.status === 'INFECTED') return parsed;
  if (parsed.status === 'CLEAN' && code === 0) return parsed;

  if (code === 1) {
    return {
      status: 'SKIPPED',
      engine: 'clamav',
      reason:
        'clamscan keluar dengan kode 1 tanpa keterangan signature yang dapat dibaca: ' +
        (combined.replace(/\0/g, '').trim().slice(-160) || '(tidak ada keluaran)'),
    };
  }

  if (parsed.status === 'CLEAN') {
    return {
      status: 'SKIPPED',
      engine: 'clamav',
      reason: `Kode keluar ${code} tidak konsisten dengan balasan OK.`,
    };
  }

  return {
    ...parsed,
    reason:
      `Kode keluar ${code}. ` +
      (parsed.reason ?? `Keluaran: ${combined.replace(/\0/g, '').trim().slice(-160) || '(kosong)'}`),
  };
}

export interface CliRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface CliScanDeps {
  runOnce?: (file: string) => Promise<CliRunResult>;
  retryDelayMs?: number;
}

function spawnClamscan(cli: string, args: string[], timeoutMs: number): Promise<CliRunResult> {
  return new Promise<CliRunResult>((resolve) => {
    const child = spawn(cli, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stdout, stderr: `${stderr}\ntimeout` });
    }, timeoutMs);

    child.stdout.on('data', (c) => { stdout += String(c); });
    child.stderr.on('data', (c) => { stderr += String(c); });
    child.on('error', () => { clearTimeout(timer); resolve({ code: null, stdout, stderr: `${stderr}\nspawn error` }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

/**
 * Mode CLI: tulis ke berkas sementara, pindai dengan clamscan, lalu hapus.
 *
 * Satu percobaan ulang dilakukan bila hasilnya SKIPPED (spawn gagal sesaat
 * seperti EAGAIN di Windows, atau kode keluar tanpa keluaran). Tanpa ini,
 * unggahan yang sah bisa tercatat "tidak dipindai" hanya karena mesin sibuk.
 */
export async function scanWithCli(body: Buffer, deps: CliScanDeps = {}): Promise<ScanResult> {
  const cli = process.env.CLAMAV_CLI_PATH as string;
  const database = process.env.CLAMAV_DATABASE_DIR;
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? 30000);
  const retryDelayMs = deps.retryDelayMs ?? 250;

  const dir = await mkdtemp(join(tmpdir(), 'epq-scan-'));
  const file = join(dir, 'upload.bin');

  const runOnce = deps.runOnce ?? ((target: string) => {
    const args = ['--no-summary', '--stdout'];
    if (database) args.push(`--database=${database}`);
    args.push(target);
    return spawnClamscan(cli, args, timeoutMs);
  });

  try {
    await writeFile(file, body);

    let result = await runOnce(file);
    let verdict = verdictFromScan(result.code, result.stdout, result.stderr);

    if (verdict.status === 'SKIPPED') {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      result = await runOnce(file);
      verdict = verdictFromScan(result.code, result.stdout, result.stderr);
    }

    return verdict;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Memindai buffer. Tidak pernah melempar: bila pemindai tidak tersedia,
 * hasilnya SKIPPED beserta alasannya — pemanggil yang memutuskan apakah
 * SKIPPED boleh diterima (lihat SOP_UPLOAD_REQUIRE_SCAN).
 */
export async function scanBuffer(body: Buffer): Promise<ScanResult> {
  if (!clamavConfigured()) {
    return {
      status: 'SKIPPED',
      engine: 'none',
      reason: scanMode() === 'cli'
        ? 'ClamAV CLI tidak dikonfigurasi (CLAMAV_CLI_PATH kosong).'
        : 'ClamAV daemon tidak dikonfigurasi (CLAMAV_HOST kosong).',
    };
  }

  if (scanMode() === 'cli') return scanWithCli(body);

  const host = process.env.CLAMAV_HOST as string;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? 10000);

  return new Promise<ScanResult>((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs, () => {
      finish({ status: 'SKIPPED', engine: 'clamav', reason: 'clamd tidak merespons (timeout).' });
    });

    socket.on('error', () => {
      finish({ status: 'SKIPPED', engine: 'clamav', reason: 'clamd tidak dapat dihubungi.' });
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');

      const CHUNK = 64 * 1024;
      for (let offset = 0; offset < body.length; offset += CHUNK) {
        const slice = body.subarray(offset, offset + CHUNK);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(slice.length, 0);
        socket.write(size);
        socket.write(slice);
      }
      // Penanda akhir: potongan berukuran 0.
      socket.write(Buffer.from([0, 0, 0, 0]));
    });

    let response = '';
    socket.on('data', (chunk) => { response += chunk.toString(); });
    socket.on('end', () => {
      finish(parseVerdict(response, 'clamav'));
    });
  });
}
