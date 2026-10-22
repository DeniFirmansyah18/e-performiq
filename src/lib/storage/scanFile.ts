import { connect } from 'node:net';

export type ScanStatus = 'CLEAN' | 'INFECTED' | 'SKIPPED';

export interface ScanResult {
  status: ScanStatus;
  engine: 'clamav' | 'none';
  signature?: string;
  reason?: string;
}

/** Hook ClamAV aktif hanya bila CLAMAV_HOST diisi. */
export function clamavConfigured(): boolean {
  return Boolean(process.env.CLAMAV_HOST);
}

/**
 * Memindai buffer lewat clamd (protokol INSTREAM). Tidak pernah melempar:
 * bila clamd tidak tersedia, hasilnya SKIPPED beserta alasannya — pemanggil
 * yang memutuskan apakah SKIPPED boleh diterima (lihat SOP_UPLOAD_REQUIRE_SCAN).
 */
export async function scanBuffer(body: Buffer): Promise<ScanResult> {
  if (!clamavConfigured()) {
    return { status: 'SKIPPED', engine: 'none', reason: 'ClamAV tidak dikonfigurasi.' };
  }

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
      // clamd mengakhiri balasan dengan byte NUL; trim() tidak membuangnya.
      const text = response.replace(/\0/g, '').trim();
      if (/OK$/.test(text)) {
        finish({ status: 'CLEAN', engine: 'clamav' });
        return;
      }
      const found = text.match(/stream:\s*(.+?)\s+FOUND/);
      if (found) {
        finish({ status: 'INFECTED', engine: 'clamav', signature: found[1] });
        return;
      }
      finish({ status: 'SKIPPED', engine: 'clamav', reason: `Balasan clamd tidak dikenali: ${text}` });
    });
  });
}
