/**
 * Video Validation Service
 * Validasi berkas video perkenalan diri kandidat:
 * - Ukuran maksimal: 10 MB (10 * 1024 * 1024 byte)
 * - Durasi maksimal: 2 menit (120 detik)
 * - Format: MP4, WebM, MOV (QuickTime), OGG
 */

export const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_DURATION_SECONDS = 120; // 2 menit

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg', '.m4v'] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-m4v',
] as const;

export function isAllowedVideoExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isAllowedVideoMime(mimeType: string): boolean {
  const clean = mimeType.toLowerCase().split(';')[0].trim();
  return ALLOWED_VIDEO_MIME_TYPES.includes(clean as any);
}

export function validateVideoMetadata(meta: {
  fileName: string;
  size: number;
  mimeType?: string | null;
  reportedDuration?: number | null;
}): { valid: boolean; error?: string } {
  if (meta.size <= 0) {
    return { valid: false, error: 'Berkas video kosong.' };
  }
  if (meta.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMb = (meta.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Ukuran berkas video melebihi batas maksimal 10 MB (terdeteksi: ${sizeMb} MB).`,
    };
  }

  const hasValidExt = isAllowedVideoExtension(meta.fileName);
  const hasValidMime = meta.mimeType ? isAllowedVideoMime(meta.mimeType) : false;

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: 'Format video tidak didukung. Harap unggah video format MP4, WebM, atau MOV.',
    };
  }

  if (meta.reportedDuration != null && Number.isFinite(meta.reportedDuration)) {
    // Toleransi 1.5 detik untuk rounding durasi frame/audio container
    if (meta.reportedDuration > MAX_VIDEO_DURATION_SECONDS + 1.5) {
      const minutes = Math.floor(meta.reportedDuration / 60);
      const seconds = Math.floor(meta.reportedDuration % 60);
      const durStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
      return {
        valid: false,
        error: `Durasi video melebihi batas maksimal 2 menit (terdeteksi: ${durStr}).`,
      };
    }
  }

  return { valid: true };
}

/**
 * Parser durasi ISO BMFF (MP4 / MOV) murni Node.js Buffer (tanpa binary ffmpeg).
 * Menelusuri kotak `moov` -> `mvhd` untuk membaca timescale & duration.
 */
export function extractMp4Duration(buffer: Buffer): number | null {
  try {
    let offset = 0;
    while (offset + 8 <= buffer.length) {
      const size = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);

      if (size === 0) break; // Sampai akhir berkas
      const actualSize = size === 1 ? Number(buffer.readBigUInt64BE(offset + 8)) : size;
      if (actualSize <= 0 || offset + actualSize > buffer.length) break;

      if (type === 'moov') {
        // Cari mvhd di dalam moov
        let moovOffset = offset + (size === 1 ? 16 : 8);
        const moovEnd = offset + actualSize;

        while (moovOffset + 8 <= moovEnd) {
          const subSize = buffer.readUInt32BE(moovOffset);
          const subType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);
          if (subSize <= 0 || moovOffset + subSize > moovEnd) break;

          if (subType === 'mvhd' && moovOffset + 24 <= moovEnd) {
            const version = buffer.readUInt8(moovOffset + 8);
            if (version === 0 && moovOffset + 28 <= moovEnd) {
              const timescale = buffer.readUInt32BE(moovOffset + 20);
              const duration = buffer.readUInt32BE(moovOffset + 24);
              if (timescale > 0) return duration / timescale;
            } else if (version === 1 && moovOffset + 40 <= moovEnd) {
              const timescale = buffer.readUInt32BE(moovOffset + 28);
              const duration = Number(buffer.readBigUInt64BE(moovOffset + 32));
              if (timescale > 0) return duration / timescale;
            }
          }
          moovOffset += subSize;
        }
      }

      offset += actualSize;
    }
  } catch {
    // Best-effort
  }
  return null;
}

