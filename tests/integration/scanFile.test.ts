import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { clamavConfigured, scanBuffer } from '@/lib/storage/scanFile';

/** clamd palsu: menerima perintah zINSTREAM dan membalas verdict. */
function startFakeClamd(verdict: string): Promise<{ server: Server; received: number }> {
  const state = { received: 0 };
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      // Perintah selesai saat potongan berukuran 0 diterima.
      if (buffer.includes('zINSTREAM')) {
        const marker = Buffer.from([0, 0, 0, 0]);
        if (buffer.includes(marker)) {
          state.received += 1;
          socket.end(`${verdict}\0`);
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, received: state.received }));
  });
}

describe('scanFile — hook ClamAV opsional', () => {
  const saved = { host: process.env.CLAMAV_HOST, port: process.env.CLAMAV_PORT };

  afterAll(() => {
    if (saved.host === undefined) delete process.env.CLAMAV_HOST; else process.env.CLAMAV_HOST = saved.host;
    if (saved.port === undefined) delete process.env.CLAMAV_PORT; else process.env.CLAMAV_PORT = saved.port;
  });

  it('tanpa CLAMAV_HOST → SKIPPED, tidak melempar', async () => {
    delete process.env.CLAMAV_HOST;
    expect(clamavConfigured()).toBe(false);

    const res = await scanBuffer(Buffer.from('%PDF-1.7'));
    expect(res.status).toBe('SKIPPED');
    expect(res.engine).toBe('none');
  });

  it('clamd menjawab OK → CLEAN', async () => {
    const server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.includes('zINSTREAM') && buffer.includes(Buffer.from([0, 0, 0, 0]))) {
          socket.end('stream: OK\0');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;

    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = String(port);
    expect(clamavConfigured()).toBe(true);

    const res = await scanBuffer(Buffer.from('%PDF-1.7 bersih %%EOF'));
    expect(res.status).toBe('CLEAN');
    expect(res.engine).toBe('clamav');

    await new Promise<void>((r) => server.close(() => r()));
  });

  it('clamd menemukan virus → INFECTED beserta signature', async () => {
    const server = createServer((socket) => {
      let buffer = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.includes('zINSTREAM') && buffer.includes(Buffer.from([0, 0, 0, 0]))) {
          socket.end('stream: Eicar-Test-Signature FOUND\0');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;

    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = String(port);

    const res = await scanBuffer(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR'));
    expect(res.status).toBe('INFECTED');
    expect(res.signature).toMatch(/Eicar/i);

    await new Promise<void>((r) => server.close(() => r()));
  });

  it('clamd tidak dapat dihubungi → SKIPPED dengan alasan, bukan melempar', async () => {
    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = '1'; // tidak ada yang mendengarkan

    const res = await scanBuffer(Buffer.from('%PDF-1.7'));
    expect(res.status).toBe('SKIPPED');
    expect(res.reason).toMatch(/tidak dapat dihubungi/i);
  });
});
