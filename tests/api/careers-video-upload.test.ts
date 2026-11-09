import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { POST as uploadVideo } from '@/app/api/v1/careers/upload-video/route';
import { GET as getMedia } from '@/app/api/v1/careers/media/[...key]/route';
import { POST as apply } from '@/app/api/v1/careers/apply/route';
import { getApplicationDetail } from '@/lib/services/candidateService';
import { db } from '@/lib/db/client';
import {
  validateVideoMetadata,
  extractMp4Duration,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/services/videoValidation';

function createMockMp4Buffer(durationSeconds = 60, timescale = 1000): Buffer {
  // Buat header kotak ftyp (16 byte) + moov dengan mvhd (versi 0)
  // Box ftyp: size 16 (0x10), type 'ftyp', major 'isom'
  const ftyp = Buffer.alloc(16);
  ftyp.writeUInt32BE(16, 0);
  ftyp.write('ftyp', 4, 'ascii');
  ftyp.write('isom', 8, 'ascii');

  // Box mvhd (108 byte versi 0)
  // size (4), type 'mvhd' (4), version+flags (4), creation (4), mod (4), timescale (4), duration (4), ...
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0);
  mvhd.write('mvhd', 4, 'ascii');
  mvhd.writeUInt8(0, 8); // version 0
  mvhd.writeUInt32BE(timescale, 20); // timescale
  mvhd.writeUInt32BE(Math.round(durationSeconds * timescale), 24); // duration

  // Box moov: wraps mvhd
  const moovSize = 8 + mvhd.length;
  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(moovSize, 0);
  moov.write('moov', 4, 'ascii');

  return Buffer.concat([ftyp, moov, mvhd]);
}

function videoMultipartReq(
  fileName: string,
  buffer: Buffer,
  type = 'video/mp4',
  duration?: number,
): NextRequest {
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array(buffer)], fileName, { type }));
  if (duration != null) fd.append('duration', String(duration));
  return new NextRequest('http://localhost:3000/api/v1/careers/upload-video', {
    method: 'POST',
    body: fd,
  });
}

describe('Career Introduction Video Upload & Validation', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('videoValidation service', () => {
    it('menolak berkas > 10 MB', () => {
      const res = validateVideoMetadata({
        fileName: 'intro.mp4',
        size: MAX_VIDEO_SIZE_BYTES + 1024,
        mimeType: 'video/mp4',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('10 MB');
    });

    it('menolak berkas ekstensi/mime bukan video', () => {
      const res = validateVideoMetadata({
        fileName: 'cv.pdf',
        size: 1024 * 1024,
        mimeType: 'application/pdf',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Format video tidak didukung');
    });

    it('mendukung format MP4, WebM, dan MOV', () => {
      expect(validateVideoMetadata({ fileName: 'video.mp4', size: 1024, mimeType: 'video/mp4' }).valid).toBe(true);
      expect(validateVideoMetadata({ fileName: 'video.webm', size: 1024, mimeType: 'video/webm' }).valid).toBe(true);
      expect(validateVideoMetadata({ fileName: 'video.mov', size: 1024, mimeType: 'video/quicktime' }).valid).toBe(true);
    });

    it('menolak video dengan durasi terlaporkan > 120 detik', () => {
      const res = validateVideoMetadata({
        fileName: 'intro.mp4',
        size: 5 * 1024 * 1024,
        mimeType: 'video/mp4',
        reportedDuration: 135,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('2 menit');
    });

    it('dapat membaca durasi container MP4 sintetis', () => {
      const mp4Buf = createMockMp4Buffer(75); // 75 detik
      const dur = extractMp4Duration(mp4Buf);
      expect(dur).toBeCloseTo(75, 1);
    });
  });

  describe('POST /api/v1/careers/upload-video', () => {
    it('menolak request tanpa file dengan status 400', async () => {
      const fd = new FormData();
      const req = new NextRequest('http://localhost:3000/api/v1/careers/upload-video', {
        method: 'POST',
        body: fd,
      });
      const res = await uploadVideo(req);
      expect(res.status).toBe(400);
    });

    it('menolak video > 10 MB dengan status 413', async () => {
      // Buat buffer besar 10.5 MB
      const bigBuffer = Buffer.alloc(10.5 * 1024 * 1024);
      const req = videoMultipartReq('large.mp4', bigBuffer, 'video/mp4');
      const res = await uploadVideo(req);
      expect(res.status).toBe(413);
      const j = await res.json();
      expect(j.detail).toContain('10 MB');
    });

    it('menolak format non-video dengan status 415', async () => {
      const fakePdf = Buffer.from('fake pdf content');
      const req = videoMultipartReq('document.pdf', fakePdf, 'application/pdf');
      const res = await uploadVideo(req);
      expect(res.status).toBe(415);
    });

    it('menolak video dengan durasi > 2 menit dengan status 400', async () => {
      const mp4TooLong = createMockMp4Buffer(150); // 150 detik (2.5 menit)
      const req = videoMultipartReq('intro-long.mp4', mp4TooLong, 'video/mp4', 150);
      const res = await uploadVideo(req);
      expect(res.status).toBe(400);
      const j = await res.json();
      expect(j.detail).toContain('2 menit');
    });

    it('berhasil mengunggah video valid (MP4 <= 10MB, durasi <= 120s)', async () => {
      const validMp4 = createMockMp4Buffer(60); // 1 menit
      const req = videoMultipartReq('perkenalan-spesialisasi.mp4', validMp4, 'video/mp4', 60);
      const res = await uploadVideo(req);
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(j.data.key).toBeTruthy();
      expect(j.data.fileUrl).toContain('/api/v1/careers/media/');
      expect(j.data.fileName).toBe('perkenalan-spesialisasi.mp4');
      expect(j.data.duration).toBeCloseTo(60, 0);

      // Verifikasi streaming melalui GET /api/v1/careers/media/[...key]
      const mediaReq = new NextRequest(`http://localhost:3000${j.data.fileUrl}`);
      const mediaRes = await getMedia(mediaReq, { params: { key: j.data.key.split('/') } });
      expect(mediaRes.status).toBe(200);
      expect(mediaRes.headers.get('content-type')).toContain('video');
      expect(mediaRes.headers.get('accept-ranges')).toBe('bytes');

      // Verifikasi HTTP 206 Partial Content (Range request)
      const rangeReq = new NextRequest(`http://localhost:3000${j.data.fileUrl}`, {
        headers: { Range: 'bytes=0-49' },
      });
      const rangeRes = await getMedia(rangeReq, { params: { key: j.data.key.split('/') } });
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get('content-range')).toContain('bytes 0-49/');
    });

    it('berhasil mengunggah format .mov', async () => {
      const validMov = createMockMp4Buffer(45);
      const req = videoMultipartReq('intro-iphone.mov', validMov, 'video/quicktime', 45);
      const res = await uploadVideo(req);
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(j.data.fileName).toBe('intro-iphone.mov');
    });
  });

  describe('POST /api/v1/careers/apply dengan INTRODUCTION_VIDEO', () => {
    it('menerima dokumen INTRODUCTION_VIDEO dan menyimpannya di candidate_documents', async () => {
      const q = await client.query<{ id: string }>(
        `SELECT id FROM job_postings WHERE is_public = TRUE AND status = 'OPEN' LIMIT 1`,
      );
      const postingId = q.rows[0].id;

      const applyReq = new NextRequest('http://localhost:3000/api/v1/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Bambang Spesialis Cloud',
          email: 'bambang.cloud@example.com',
          phone: '081299998888',
          jobPostingId: postingId,
          documents: [
            {
              docType: 'INTRODUCTION_VIDEO',
              fileName: 'bambang-spesialisasi-devops.mp4',
              mimeType: 'video/mp4',
              fileUrl: '/api/v1/careers/media/candidates%2Fvideos%2Fmock.mp4',
            },
          ],
        }),
      });

      const res = await apply(applyReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.applicationId).toBeTruthy();

      // Cek getApplicationDetail (yang dipakai panel HR)
      const detail = await getApplicationDetail(db, json.data.applicationId);
      expect(detail).toBeTruthy();
      const videoDoc = detail?.documents?.find((d: any) => d.docType === 'INTRODUCTION_VIDEO');
      expect(videoDoc).toBeTruthy();
      expect(videoDoc.fileName).toBe('bambang-spesialisasi-devops.mp4');
      expect(videoDoc.fileUrl).toBe('/api/v1/careers/media/candidates%2Fvideos%2Fmock.mp4');
    });
  });
});
