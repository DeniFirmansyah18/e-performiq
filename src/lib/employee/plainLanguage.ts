// Glosarium bahasa awam (keputusan D6). Hanya LABEL & TEKS — logika/API tak berubah.
// Jargon tetap tampil lewat ikon ⓘ (tooltip) agar HR/auditor GCG aman.

export const PLAIN_TERMS = {
  GPA: {
    plain: 'Nilai Kinerja',
    technical: 'Composite GPA (50/20/15/15)',
    tooltip: 'Gabungan target, prosedur, kemampuan, sikap. Skala 1–4.',
  },
  KPI: {
    plain: 'Target Kerja',
    technical: 'Cascaded Individual KPI (DUR-01)',
    tooltip: 'Capaian utama Anda. Bobot 50%.',
  },
  SOP: {
    plain: 'Kepatuhan Prosedur',
    technical: 'SOP & SLA Compliance (DUR-02)',
    tooltip: 'Ketaatan aturan & tenggat waktu. Bobot 20%.',
  },
  COMPETENCY: {
    plain: 'Kemampuan & Pelatihan',
    technical: 'Competency Mastery (DUR-03)',
    tooltip: 'Skill + jam pelatihan. Bobot 15%.',
  },
  CORE_VALUES: {
    plain: 'Sikap & Penilaian Rekan',
    technical: 'Core Values / 360° (DUR-04)',
    tooltip: 'Perilaku, dinilai atasan/rekan. Bobot 15%.',
  },
  BRADFORD: {
    plain: 'Pola Kehadiran',
    technical: 'Bradford Factor',
    tooltip: 'Seberapa sering tidak hadir.',
  },
  KIRKPATRICK: {
    plain: 'Efek Pelatihan',
    technical: 'Kirkpatrick L2/L3',
    tooltip: 'Peningkatan nilai pra vs pasca pelatihan.',
  },
} as const;

export type PlainTermKey = keyof typeof PLAIN_TERMS;
