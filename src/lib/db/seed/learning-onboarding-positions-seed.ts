/**
 * Seed kursus onboarding PER POSISI + pemetaannya ke `position_courses`.
 *
 * MASALAH YANG DIPERBAIKI: kursus "Onboarding <nama posisi>" dulu hanya dibuat
 * saat HR menekan "Generate dengan AI". Akibatnya di LMS HR (kursus
 * terpetakan) kursus itu tidak muncul sampai digenerate, padahal onboarding
 * pegawai bisa sudah memakainya — HR tidak dapat mengeditnya lebih dulu.
 *
 * Sekarang seed membuat kursus onboarding untuk SELURUH posisi, lengkap dengan
 * materi, sehingga selalu tampil di kursus terpetakan dan siap diedit.
 */

import type { SqlClient } from '@/lib/db/client';
import { bangunModulKursusDefault, type KursusDefault } from './learning-default-seed';

/**
 * Kode kursus onboarding per posisi.
 *
 * Memakai id posisi LENGKAP; versi lama memakai 8 huruf pertama sehingga semua
 * posisi berbagi satu kode dan hanya posisi pertama yang berhasil.
 */
export function kodeOnboardingPosisi(positionId: string): string {
  return `ONB-${positionId.replace(/-/g, '').toUpperCase()}`;
}

/** Materi dasar kursus onboarding posisi (disesuaikan nama posisinya). */
function kursusOnboardingPosisi(positionTitle: string, department: string | null): KursusDefault {
  const dept = department ? ` di ${department}` : '';
  return {
    courseCode: 'TIDAK-DIPAKAI',
    materi: [
      {
        title: `Selamat Datang & Peran ${positionTitle}`,
        paragraf: [
          `Peran ${positionTitle}${dept} bertanggung jawab memastikan target kerja tim tercapai sesuai rencana.`,
          `Setiap ${positionTitle} wajib memahami alur pelaporan, saluran komunikasi, dan kode etik perusahaan.`,
          `Ekspektasi kinerja ${positionTitle} dinilai melalui sasaran kerja dan perilaku kerja pada masa orientasi.`,
        ],
      },
      {
        title: 'Tata Kelola & Kepatuhan',
        paragraf: [
          'Tata kelola perusahaan menerapkan prinsip transparansi, akuntabilitas, tanggung jawab, independensi, dan kewajaran.',
          'Setiap dugaan pelanggaran wajib dilaporkan melalui saluran pelaporan resmi perusahaan.',
          'Dokumen resmi perusahaan hanya boleh dibagikan kepada pihak yang berwenang.',
        ],
      },
      {
        title: 'Sistem Kerja & Komunikasi',
        paragraf: [
          'Komunikasi resmi dilakukan melalui surel perusahaan, bukan akun pribadi.',
          'Setiap pekerjaan dicatat dalam sistem agar dapat ditelusuri dan dinilai secara objektif.',
          'Atasan langsung bertugas memantau dan membimbing karyawan di departemennya.',
        ],
      },
    ],
    kuisPenutup: [
      {
        text: `Apa fokus utama masa onboarding posisi ${positionTitle}?`,
        options: [
          'Adaptasi budaya dan penguasaan kompetensi dasar',
          'Mengajukan cuti tahunan lebih awal',
          'Menunda seluruh pekerjaan sampai evaluasi',
          'Mengabaikan prosedur standar perusahaan',
        ],
      },
    ],
  };
}

/**
 * Buat kursus onboarding + materi + pemetaan untuk semua posisi.
 *
 * Idempoten: kursus memakai `ON CONFLICT DO UPDATE` dan materi diganti seluruhnya
 * sehingga seed berulang tidak menggandakan.
 */
export async function seedOnboardingPerPosisi(client: SqlClient): Promise<void> {
  const posisi = await client.query<{
    id: string;
    title: string;
    dept: string | null;
  }>(`
    SELECT p.id::text AS id, p.position_title AS title, d.department_name AS dept
      FROM job_positions p LEFT JOIN departments d ON d.id = p.department_id
     ORDER BY p.position_title
  `);

  for (const p of posisi.rows) {
    const kode = kodeOnboardingPosisi(p.id);
    const judul = `Onboarding ${p.title}`;

    // 1) Kursus: buat atau pastikan judulnya benar.
    await client.query(
      `INSERT INTO moodle_courses (course_code, title, category, description, target_phase, is_mandatory, default_hours)
       VALUES ($1, $2, 'Onboarding', $3, 'PRE', TRUE, 8)
       ON CONFLICT (course_code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description`,
      [kode, judul, `Kurikulum orientasi khusus posisi ${p.title}.`]
    );

    const c = await client.query<{ id: number }>(
      'SELECT id FROM moodle_courses WHERE course_code = $1',
      [kode]
    );
    const courseId = c.rows[0].id;

    // 2) Materi: bangun ulang agar isi selalu sesuai posisi.
    await client.query('DELETE FROM course_modules WHERE course_id = $1', [courseId]);
    const modul = bangunModulKursusDefault(kursusOnboardingPosisi(p.title, p.dept));
    for (const m of modul) {
      await client.query(
        `INSERT INTO course_modules (course_id, title, order_index, content_type, content_body, quiz_key)
         VALUES ($1, $2, $3, $4::content_type_enum, $5, $6::jsonb)`,
        [courseId, m.title, m.orderIndex, m.contentType, m.contentBody,
         m.quizKey ? JSON.stringify(m.quizKey) : null]
      );
    }

    // 3) Petakan ke posisinya (WAJIB) agar tampil di kursus terpetakan.
    await client.query(
      `INSERT INTO position_courses (position_id, course_id, is_mandatory, order_index)
       VALUES ($1::uuid, $2, TRUE, 5)
       ON CONFLICT (position_id, course_id) DO NOTHING`,
      [p.id, courseId]
    );
  }
}
