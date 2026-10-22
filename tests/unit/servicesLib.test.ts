import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  parseEnvText, readEnvFile, resolveStorageConfig, resolveClamavConfig,
  buildWeedServerArgs, weedDataDir, bucketUrl, probePort, probeHttp,
} from '../../scripts/services-lib.mjs';

describe('parseEnvText', () => {
  it('membaca pasangan KEY=VALUE, melewati komentar dan baris kosong', () => {
    const env = parseEnvText(`
# komentar
S3_BUCKET=sop-files

CLAMAV_MODE=cli
`);
    expect(env.S3_BUCKET).toBe('sop-files');
    expect(env.CLAMAV_MODE).toBe('cli');
    expect(Object.keys(env)).toHaveLength(2);
  });

  it('membuang tanda kutip pembungkus', () => {
    const env = parseEnvText(`A="nilai satu"\nB='nilai dua'\nC=nilai tiga`);
    expect(env.A).toBe('nilai satu');
    expect(env.B).toBe('nilai dua');
    expect(env.C).toBe('nilai tiga');
  });

  it('mempertahankan tanda sama dengan di dalam nilai', () => {
    const env = parseEnvText('PASSWORD=abc=def==');
    expect(env.PASSWORD).toBe('abc=def==');
  });

  it('mengabaikan baris tanpa tanda sama dengan', () => {
    const env = parseEnvText('baris rusak\nOK=1');
    expect(env.OK).toBe('1');
    expect(env['baris rusak']).toBeUndefined();
  });

  it('nilai kosong tetap tercatat sebagai string kosong', () => {
    const env = parseEnvText('DATABASE_URL=');
    expect(env.DATABASE_URL).toBe('');
  });
});

describe('resolveStorageConfig', () => {
  it('lengkap → driver s3 dengan endpoint terurai', () => {
    const cfg = resolveStorageConfig({
      S3_BUCKET: 'sop-files',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_ENDPOINT: 'http://127.0.0.1:8333',
    });
    expect(cfg.driver).toBe('s3');
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(8333);
    expect(cfg.bucket).toBe('sop-files');
    expect(cfg.missing).toEqual([]);
  });

  it('tanpa kredensial → driver lokal dan melaporkan yang kurang', () => {
    const cfg = resolveStorageConfig({});
    expect(cfg.driver).toBe('local');
    expect(cfg.missing).toContain('S3_BUCKET');
    expect(cfg.missing).toContain('S3_SECRET_ACCESS_KEY');
  });

  it('endpoint tanpa skema tetap terbaca', () => {
    const cfg = resolveStorageConfig({
      S3_BUCKET: 'b', S3_REGION: 'r', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's',
      S3_ENDPOINT: '127.0.0.1:9000',
    });
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(9000);
  });

  it('endpoint tanpa port memakai 9000 (default MinIO)', () => {
    const cfg = resolveStorageConfig({
      S3_BUCKET: 'b', S3_REGION: 'r', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's',
      S3_ENDPOINT: 'http://minio.local',
    });
    expect(cfg.port).toBe(9000);
  });
});

describe('resolveClamavConfig', () => {
  it('mode cli dengan path yang ada → siap', () => {
    const cfg = resolveClamavConfig(
      { CLAMAV_MODE: 'cli', CLAMAV_CLI_PATH: 'C:/Program Files/ClamAV/clamscan.exe' },
      { fileExists: (p) => p.endsWith('clamscan.exe') },
    );
    expect(cfg.mode).toBe('cli');
    expect(cfg.ready).toBe(true);
    expect(cfg.problems).toEqual([]);
  });

  it('mode cli tanpa path → tidak siap, alasan jelas', () => {
    const cfg = resolveClamavConfig({ CLAMAV_MODE: 'cli' }, { fileExists: () => false });
    expect(cfg.ready).toBe(false);
    expect(cfg.problems.join(' ')).toMatch(/CLAMAV_CLI_PATH/);
  });

  it('mode cli dengan path tidak ada → tidak siap', () => {
    const cfg = resolveClamavConfig(
      { CLAMAV_MODE: 'cli', CLAMAV_CLI_PATH: 'C:/tidak/ada.exe' },
      { fileExists: () => false },
    );
    expect(cfg.ready).toBe(false);
    expect(cfg.problems.join(' ')).toMatch(/tidak ditemukan/i);
  });

  it('default mode adalah daemon', () => {
    const cfg = resolveClamavConfig({ CLAMAV_HOST: '127.0.0.1' }, { fileExists: () => true });
    expect(cfg.mode).toBe('daemon');
    expect(cfg.ready).toBe(true);
  });

  it('mode daemon tanpa host → tidak siap', () => {
    const cfg = resolveClamavConfig({}, { fileExists: () => true });
    expect(cfg.ready).toBe(false);
    expect(cfg.problems.join(' ')).toMatch(/CLAMAV_HOST/);
  });

  it('melaporkan apakah pemindaian diwajibkan', () => {
    expect(resolveClamavConfig({ CLAMAV_HOST: 'h', SOP_UPLOAD_REQUIRE_SCAN: '1' }, { fileExists: () => true }).requireScan).toBe(true);
    expect(resolveClamavConfig({ CLAMAV_HOST: 'h' }, { fileExists: () => true }).requireScan).toBe(false);
  });
});

describe('buildWeedServerArgs', () => {
  it('menyusun argumen server S3 dengan port dan direktori', () => {
    const args = buildWeedServerArgs({ dataDir: 'C:/data/epq', s3Port: 8333, ip: '127.0.0.1' });
    expect(args).toContain('server');
    expect(args).toContain('-s3');
    expect(args).toContain('-s3.port=8333');
    expect(args).toContain('-ip=127.0.0.1');
    expect(args).toContain('-dir=C:/data/epq');
  });

  it('memakai port default bila tidak diberikan', () => {
    const args = buildWeedServerArgs({ dataDir: 'C:/d' });
    expect(args).toContain('-s3.port=8333');
  });
});

describe('weedDataDir', () => {
  it('memakai S3_DATA_DIR bila diisi', () => {
    expect(weedDataDir({ S3_DATA_DIR: 'D:/s3data' })).toBe('D:/s3data');
  });

  it('memakai LOCALAPPDATA dari .env bila ada', () => {
    const dir = weedDataDir({ LOCALAPPDATA: 'C:/Users/x/AppData/Local' });
    expect(dir.replace(/\\/g, '/')).toMatch(/AppData\/Local\/epq-s3\/data$/);
  });

  it('jatuh ke LOCALAPPDATA proses bila .env tidak memuatnya', () => {
    const saved = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = 'C:/Proses/Local';
    try {
      expect(weedDataDir({}).replace(/\\/g, '/')).toBe('C:/Proses/Local/epq-s3/data');
    } finally {
      if (saved === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = saved;
    }
  });
});

describe('bucketUrl', () => {
  it('menyusun URL path-style', () => {
    expect(bucketUrl('http://127.0.0.1:8333', 'sop-files')).toBe('http://127.0.0.1:8333/sop-files');
  });

  it('tidak menggandakan garis miring', () => {
    expect(bucketUrl('http://127.0.0.1:8333/', 'sop-files')).toBe('http://127.0.0.1:8333/sop-files');
  });
});

describe('CLI', () => {
  const runCli = (arg: string): string =>
    execFileSync(process.execPath, ['scripts/services-lib.mjs', arg], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

  it('--config tidak pernah mencetak kredensial S3', () => {
    const env = readEnvFile(process.cwd());
    const out = runCli('--config');
    const cfg = JSON.parse(out);
    expect(cfg.storage).toHaveProperty('driver');

    const secrets = [env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY]
      .filter((v): v is string => typeof v === 'string' && v.length >= 8);
    for (const secret of secrets) {
      expect(out).not.toContain(secret);
    }
  });

  it('--weed-args mencetak argumen `weed server -s3`', () => {
    const args = JSON.parse(runCli('--weed-args'));
    expect(Array.isArray(args)).toBe(true);
    expect(args[0]).toBe('server');
    expect(args).toContain('-s3');
    expect(args.some((a: string) => a.startsWith('-s3.port='))).toBe(true);
    expect(args.some((a: string) => a.startsWith('-dir='))).toBe(true);
  });
});

describe('probePort / probeHttp', () => {
  it('port tertutup → false tanpa melempar', async () => {
    expect(await probePort('127.0.0.1', 1, 800)).toBe(false);
  });

  it('port terbuka pada server uji → true', async () => {
    const { createServer } = await import('node:net');
    const server = createServer(() => {});
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('alamat server uji tidak terbaca');
    }
    const port = address.port;

    expect(await probePort('127.0.0.1', port, 1500)).toBe(true);

    await new Promise<void>((r) => server.close(() => r()));
  });

  it('probeHttp false untuk URL tak terjangkau', async () => {
    expect(await probeHttp('http://127.0.0.1:1/', 800)).toBe(false);
  });
});
