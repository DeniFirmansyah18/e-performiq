import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanWithCli } from '@/lib/storage/scanFile';

const EICAR_LINE = 'C:\\tmp\\upload.bin: Eicar-Test-Signature.UNOFFICIAL FOUND';
const OK_LINE = 'C:\\tmp\\upload.bin: OK';

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved.mode = process.env.CLAMAV_MODE;
  saved.cli = process.env.CLAMAV_CLI_PATH;
  process.env.CLAMAV_MODE = 'cli';
  process.env.CLAMAV_CLI_PATH = 'C:\\ClamAV\\clamscan.exe';
});

afterEach(() => {
  if (saved.mode === undefined) delete process.env.CLAMAV_MODE; else process.env.CLAMAV_MODE = saved.mode;
  if (saved.cli === undefined) delete process.env.CLAMAV_CLI_PATH; else process.env.CLAMAV_CLI_PATH = saved.cli;
});

describe('scanWithCli — retry pada kegagalan sesaat', () => {
  it('gagal spawn sekali lalu berhasil → verdict sebenarnya dipakai', async () => {
    let calls = 0;
    const runOnce = async () => {
      calls += 1;
      if (calls === 1) return { code: null, stdout: '', stderr: 'spawn EAGAIN' };
      return { code: 1, stdout: EICAR_LINE, stderr: '' };
    };

    const res = await scanWithCli(Buffer.from('isi'), { runOnce, retryDelayMs: 1 });

    expect(calls).toBe(2);
    expect(res.status).toBe('INFECTED');
    expect(res.signature).toMatch(/Eicar/i);
  });

  it('kegagalan berulang → SKIPPED dengan alasan, tidak melempar', async () => {
    let calls = 0;
    const runOnce = async () => {
      calls += 1;
      return { code: null, stdout: '', stderr: 'spawn EAGAIN' };
    };

    const res = await scanWithCli(Buffer.from('isi'), { runOnce, retryDelayMs: 1 });

    expect(calls).toBe(2);
    expect(res.status).toBe('SKIPPED');
    expect(res.reason).toMatch(/EAGAIN|gagal dijalankan/i);
  });

  it('verdict pasti pada percobaan pertama tidak diulang', async () => {
    let calls = 0;
    const runOnce = async () => {
      calls += 1;
      return { code: 0, stdout: OK_LINE, stderr: '' };
    };

    const res = await scanWithCli(Buffer.from('isi'), { runOnce, retryDelayMs: 1 });

    expect(calls).toBe(1);
    expect(res.status).toBe('CLEAN');
  });

  it('kode 1 tanpa keluaran pada percobaan pertama diulang sekali', async () => {
    let calls = 0;
    const runOnce = async () => {
      calls += 1;
      if (calls === 1) return { code: 1, stdout: '', stderr: '' };
      return { code: 0, stdout: OK_LINE, stderr: '' };
    };

    const res = await scanWithCli(Buffer.from('isi'), { runOnce, retryDelayMs: 1 });

    expect(calls).toBe(2);
    expect(res.status).toBe('CLEAN');
  });
});
