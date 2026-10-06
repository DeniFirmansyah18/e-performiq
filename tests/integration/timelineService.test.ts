import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  upsertStage,
  syncApplicationTimeline,
  getTimelineByApplicationNo,
  buildTimelineView,
  STAGE_ORDER,
} from '@/lib/services/timelineService';
import { submitApplication } from '@/lib/services/candidateService';

describe('WS-5 timeline kandidat', () => {
  let client: PGlite;
  let db: any;
  let postingId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(
      `SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`,
    );
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  describe('buildTimelineView (murni)', () => {
    it('menyusun state DONE/CURRENT/UPCOMING secara berurutan', () => {
      const view = buildTimelineView('APP-TEST-1', 'SCREENING', 'Posisi Uji', 'Budi', [
        { stage: 'APPLIED', status: 'PASSED', note: null, created_at: null },
        { stage: 'ATS_REVIEW', status: 'IN_PROGRESS', note: null, created_at: null },
      ]);
      const applied = view.entries.find((e) => e.stage === 'APPLIED')!;
      const ats = view.entries.find((e) => e.stage === 'ATS_REVIEW')!;
      const psy = view.entries.find((e) => e.stage === 'PSYCHOMETRIC')!;
      expect(applied.state).toBe('DONE');
      expect(ats.state).toBe('CURRENT');
      expect(psy.state).toBe('UPCOMING');
      expect(view.currentStage).toBe('ATS_REVIEW');
      expect(view.entries.map((e) => e.stage)).toEqual(STAGE_ORDER);
    });

    it('menandai FAILED pada keputusan negatif', () => {
      const view = buildTimelineView('APP-TEST-2', 'REJECTED', 'Posisi Uji', 'Siti', [
        { stage: 'APPLIED', status: 'PASSED', note: null, created_at: null },
        { stage: 'ATS_REVIEW', status: 'PASSED', note: null, created_at: null },
        { stage: 'DECISION', status: 'FAILED', note: null, created_at: null },
      ]);
      expect(view.overallState).toBe('REJECTED');
      expect(view.entries.find((e) => e.stage === 'DECISION')!.state).toBe('FAILED');
    });

    it('HIRED → overallState ACCEPTED', () => {
      const view = buildTimelineView('APP-TEST-3', 'HIRED', 'Posisi Uji', 'Andi', [
        { stage: 'DECISION', status: 'PASSED', note: null, created_at: null },
      ]);
      expect(view.overallState).toBe('ACCEPTED');
    });
  });

  describe('upsertStage & sync (DB)', () => {
    it('upsertStage idempoten (tidak menduplikasi baris)', async () => {
      const app = await submitApplication(db, {
        fullName: 'Timeline Uji', email: 'timeline.uji@example.com', jobPostingId: postingId,
      });
      const applicationId = app.applicationId!;
      await upsertStage(db, { applicationId, stage: 'PSYCHOMETRIC', status: 'IN_PROGRESS' });
      await upsertStage(db, { applicationId, stage: 'PSYCHOMETRIC', status: 'PASSED', note: 'lolos' });
      const r = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM application_timeline WHERE application_id = $1::uuid AND stage = 'PSYCHOMETRIC'`,
        [applicationId],
      );
      expect(Number(r.rows[0].n)).toBe(1);
      const st = await client.query<{ status: string; note: string }>(
        `SELECT status, note FROM application_timeline WHERE application_id = $1::uuid AND stage = 'PSYCHOMETRIC'`,
        [applicationId],
      );
      expect(st.rows[0].status).toBe('PASSED');
      expect(st.rows[0].note).toBe('lolos');
    });

    it('submitApplication membuat tahap APPLIED otomatis', async () => {
      const app = await submitApplication(db, {
        fullName: 'Auto Timeline', email: 'auto.timeline@example.com', jobPostingId: postingId,
      });
      const r = await client.query<{ stage: string; status: string }>(
        `SELECT stage, status FROM application_timeline WHERE application_id = $1::uuid`,
        [app.applicationId],
      );
      expect(r.rows.some((x) => x.stage === 'APPLIED' && x.status === 'PASSED')).toBe(true);
    });

    it('syncApplicationTimeline mengisi tahap dari status lamaran (SCREENING → ATS_REVIEW)', async () => {
      const app = await submitApplication(db, {
        fullName: 'Sync Timeline', email: 'sync.timeline@example.com', jobPostingId: postingId,
      });
      const applicationId = app.applicationId!;
      await client.query(
        `UPDATE job_applications SET status = 'SCREENING'::application_status_enum WHERE id = $1::uuid`,
        [applicationId],
      );
      await syncApplicationTimeline(db, applicationId);
      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      expect(view).not.toBeNull();
      const ats = view!.entries.find((e) => e.stage === 'ATS_REVIEW')!;
      expect(['CURRENT', 'DONE']).toContain(ats.state);
    });

    it('Seleksi Berkas (ATS) otomatis Selesai setelah psikometri + teknis PASSED', async () => {
      const app = await submitApplication(db, {
        fullName: 'Lolos Berkas', email: 'lolos.berkas@example.com', jobPostingId: postingId,
      });
      const applicationId = app.applicationId!;
      // Status lamaran masih SCREENING (belum dipindah HR), namun kandidat sudah
      // menyelesaikan kedua tes.
      await client.query(
        `UPDATE job_applications SET status = 'SCREENING'::application_status_enum WHERE id = $1::uuid`,
        [applicationId],
      );
      await upsertStage(db, { applicationId, stage: 'PSYCHOMETRIC', status: 'PASSED' });
      await upsertStage(db, { applicationId, stage: 'TECHNICAL', status: 'PASSED' });

      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      expect(view).not.toBeNull();
      const ats = view!.entries.find((e) => e.stage === 'ATS_REVIEW')!;
      expect(ats.status).toBe('PASSED');
      expect(ats.state).toBe('DONE');
    });

    it('Seleksi Berkas (ATS) tidak dipromosikan bila tes belum selesai', async () => {
      const app = await submitApplication(db, {
        fullName: 'Belum Selesai', email: 'belum.selesai@example.com', jobPostingId: postingId,
      });
      const applicationId = app.applicationId!;
      await client.query(
        `UPDATE job_applications SET status = 'SCREENING'::application_status_enum WHERE id = $1::uuid`,
        [applicationId],
      );
      await upsertStage(db, { applicationId, stage: 'PSYCHOMETRIC', status: 'PASSED' });
      // TECHNICAL belum PASSED.
      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      const ats = view!.entries.find((e) => e.stage === 'ATS_REVIEW')!;
      expect(ats.status).toBe('IN_PROGRESS');
    });

    it('getTimelineByApplicationNo mengembalikan null untuk nomor tak dikenal', async () => {
      const view = await getTimelineByApplicationNo(db, 'APP-00000000-XXXXX');
      expect(view).toBeNull();
    });

    it('timeline selalu berisi 7 tahap dengan label', async () => {
      const app = await submitApplication(db, {
        fullName: 'Tujuh Tahap', email: 'tujuh.tahap@example.com', jobPostingId: postingId,
      });
      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      expect(view!.entries.length).toBe(7);
      expect(view!.entries[0].label).toBe('Lamaran Diterima');
      expect(view!.entries[6].label).toBe('Keputusan Akhir');
    });

    it('menyertakan tautan & jadwal wawancara pada tahap INTERVIEW', async () => {
      const app = await submitApplication(db, {
        fullName: 'Wawancara Uji', email: 'wawancara.uji@example.com', jobPostingId: postingId,
      });
      const applicationId = app.applicationId!;
      await client.query(
        `INSERT INTO interview_schedules (application_id, scheduled_at, meeting_url, status)
         VALUES ($1::uuid, '2026-11-01T09:00:00Z'::timestamptz, 'https://meet.example.com/abc-123', 'SCHEDULED')`,
        [applicationId],
      );
      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      expect(view).not.toBeNull();
      const iv = view!.entries.find((e) => e.stage === 'INTERVIEW')!;
      expect(iv.meetingUrl).toBe('https://meet.example.com/abc-123');
      expect(iv.scheduledAt).not.toBeNull();
      expect(iv.status).toBe('SCHEDULED');
    });

    it('tahap INTERVIEW tetap aman saat belum ada jadwal (meetingUrl null)', async () => {
      const app = await submitApplication(db, {
        fullName: 'Tanpa Jadwal', email: 'tanpa.jadwal@example.com', jobPostingId: postingId,
      });
      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      const iv = view!.entries.find((e) => e.stage === 'INTERVIEW')!;
      expect(iv.meetingUrl == null).toBe(true);
      expect(iv.scheduledAt == null).toBe(true);
    });

    it('jadwal tanpa meeting_url → meetingUrl null (UI tampilkan "menyusul")', async () => {
      const app = await submitApplication(db, {
        fullName: 'URL Kosong', email: 'url.kosong@example.com', jobPostingId: postingId,
      });
      await client.query(
        `INSERT INTO interview_schedules (application_id, scheduled_at, meeting_url, status)
         VALUES ($1::uuid, '2026-11-02T10:00:00Z'::timestamptz, NULL, 'SCHEDULED')`,
        [app.applicationId],
      );
      const view = await getTimelineByApplicationNo(db, app.applicationNo);
      const iv = view!.entries.find((e) => e.stage === 'INTERVIEW')!;
      expect(iv.meetingUrl == null).toBe(true);
      expect(iv.scheduledAt).not.toBeNull();
    });
  });
});
