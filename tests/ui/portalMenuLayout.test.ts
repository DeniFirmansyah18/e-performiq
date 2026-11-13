// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Penataan menu fase "Saat Kerja" pada portal pegawai.
 *
 * Dibaca dari sumber halaman agar dapat memastikan kartu yang harus dihapus
 * benar-benar hilang, urutan grup benar, dan tidak ada kode mati tersisa.
 */
const SUMBER = fs.readFileSync(
  path.join(process.cwd(), 'src/app/dashboard/employee-portal/page.tsx'),
  'utf8'
);

describe('menu fase Saat Kerja — penataan kartu', () => {
  it('"Profil & Bantuan" berada di URUTAN PERTAMA', () => {
    const semuaJudul = (SUMBER.match(/judul: '([^']+)'/g) ?? []).map((m) =>
      m.replace(/^judul: '|'$/g, '')
    );
    expect(semuaJudul[0]).toBe('Profil & Bantuan');
  });

  it('kartu yang diminta dihapus sudah tidak ada', () => {
    for (const judul of ['Tanya Chatbot HR', 'Peta Karir & Moodle', 'Chat Pimpinan', 'Unggah Bukti']) {
      expect(SUMBER, judul).not.toContain(`title: '${judul}'`);
    }
    // "Ajukan Finalisasi" memakai template literal pada `title:`.
    expect(SUMBER).not.toMatch(/title:\s*`Ajukan Finalisasi/);
  });

  it('"Sanksi & Penghargaan" sudah berganti menjadi "Sanksi & Pelanggaran"', () => {
    expect(SUMBER).not.toContain('Sanksi & Penghargaan');
    expect(SUMBER).toContain('Sanksi & Pelanggaran');
  });

  it('kartu penting lain tetap ada', () => {
    for (const judul of ['Profil Saya', 'Target Kerja', 'Nilai Kinerja', 'Isi Timesheet Harian', 'Cuti & Izin',
      'Ajukan Lembur', 'Reimbursement', 'Slip Gaji PIN', 'e-Surat & Disposisi', 'SOP & Peraturan',
      'Sanksi & Pelanggaran', 'Bursa Kerja Internal', 'Tiket Bantuan', 'Unduh Portofolio KPI']) {
      expect(SUMBER, judul).toMatch(new RegExp(`title: [\`']${judul.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
  });

  it('tidak menyisakan state modal untuk fitur yang dihapus', () => {
    for (const nama of ['isChatbotOpen', 'isCareerOpen', 'isChatOpen', 'isEvidenceOpen', 'isFinalizeOpen']) {
      expect(SUMBER, nama).not.toContain(nama);
    }
  });

  it('tidak menyisakan impor komponen yang tak terpakai', () => {
    for (const komponen of ['HelpdeskChatbotDrawer', 'CareerPathModal', 'ChatDrawer',
      'KpiEvidenceUploadModal', 'FinalizationRequestModal']) {
      expect(SUMBER, komponen).not.toContain(komponen);
    }
  });

  it('Profil Saya dibuka sebagai panel (openFeature), bukan modal', () => {
    expect(SUMBER).toContain("setOpenFeature('profile')");
    expect(SUMBER).toContain('openFeature === \'profile\'');
  });
});

afterEach(() => cleanup());
