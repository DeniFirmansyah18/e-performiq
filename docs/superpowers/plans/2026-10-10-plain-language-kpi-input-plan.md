# Rencana: Sederhanakan Bahasa Indikator "Saat Kerja" + Menu Input KPI Ramah Karyawan

**Tanggal:** 2026-10-10
**Penulis:** HR/Tech Lead (planning mode)
**Rujukan PRD:** §3.2 (Fase 2 — DURING), §5.2, §6.1 (Employee Growth Portal).
**Tujuan:** Menghilangkan jargon teknis (GPA, BSC, Bradford, Kirkpatrick, DUR-0x) dari **permukaan UI karyawan**, ganti dengan bahasa awam + penjelasan inline. Rombak modal "Ajukan Sasaran Kerja/KPI" agar karyawan baru paham tanpa pelatihan.
**Prinsip:** hanya **label, salinan (copy), dan tata letak UI** berubah — **logika, API, dan rumus TIDAK diubah**. Istilah teknis tetap tersedia (opsional, tersembunyi) untuk auditor HR agar GCG tetap.

---

## 1. Diagnosis — Kenapa Sulit Dipahami

Jargon saat ini muncul di permukaan karyawan di `src/app/dashboard/employee-portal/page.tsx`:

| Lokasi | Teks sekarang | Masalah |
|---|---|---|
| Scorecard hero | "Cumulative Weighted GPA" | "GPA" ambigu (dikira IPK akademik) |
| Kartu komponen | "Composite Performance Scorecard", "SOP Compliance", "Core Values & 360°" | istilah asing/teknis |
| Panel OKR | "Cascading OKR Aktif", "Balanced Scorecard (BSC)", "Pilar Strategis BSC (PRD §8)" | jargon manajemen |
| Modal KPI | "Judul Sasaran KPI (SMART Target)", "Pilar Strategis Balanced Scorecard (BSC)", "Unit of Measure" | karyawan baru tak tahu SMART/BSC |
| Formula | "Formula bobot matematis transparan" | skare |
| Audit | "Audit Trail ID: #GPA-2026-Q3-0941" | tak relevan untuk karyawan |

**Prinsip perbaikan:** setiap istilah teknis → **frasa awam** + **tooltip 1 baris** ("Apa ini?"). Jargon asli tetap di `title=`/tooltip untuk HR/auditor.

---

## 2. Glosarium Bahasa Awam (sumber tunggal: `src/lib/employee/plainLanguage.ts`)

**Konsep:** satu file konstanta → dipakai semua komponen (hindari string tersebar).

| Istilah teknis | Sebutan awam (UI karyawan) | Penjelasan 1 baris (tooltip/inline) |
|---|---|---|
| Composite GPA (50/20/15/15) | **Nilai Kinerja Akhir** | "Gabungan nilai target kerja, kepatuhan proses, kemampuan, dan perilaku. Skala 1–4." |
| DUR-01 Cascaded KPI | **Target Kerja** | "Apa yang harus Anda capai. Bobotnya paling besar (50%)." |
| DUR-02 SOP Compliance | **Kepatuhan Prosedur** | "Seberapa tepat Anda mengikuti aturan, standar, dan tenggat kerja (20%)." |
| DUR-03 Competency Mastery | **Kemampuan & Pelatihan** | "Keterampilan kerja dan pelatihan yang Anda ikuti (15%)." |
| DUR-04 Core Values & 360° | **Sikap & Penilaian Rekan** | "Perilaku kerja dinilai atasan, rekan, dan bawahan (15%)." |
| Benchmark | **Standar Terbaik** | "Patokan dari perusahaan terbaik di industri." |
| 9-Box | **Peta Talenta** | "Posisi Anda dalam peta kinerja vs potensi." |
| Bradford Factor | **Pola Kehadiran** | "Seberapa sering dan lama Anda tidak hadir." |
| Kirkpatrick L2/L3 | **Efek Pelatihan** | "Seberapa besar peningkatan setelah pelatihan (pra vs pasca)." |
| Cascade / Pilar Strategis BSC | **Tujuan Perusahaan** | "Tujuan besar perusahaan yang Anda dukung." |
| Strategic Pillar | **Tujuan Perusahaan/Bagian** | "Bagian dari tujuan besar yang sasaran Anda bantu capai." |

**Isi file (usulan):**
```
export const GLOSSARY = {
  gpa:        { label: 'Nilai Kinerja Akhir', help: 'Gabungan {target, prosedur, kemampuan, sikap}. Skala 1–4.' },
  kpi:        { label: 'Target Kerja',          help: 'Capaian utama Anda. Bobot 50%.' },
  sop:        { label: 'Kepatuhan Prosedur',    help: 'Ketaatan aturan, standar, dan tenggat. Bobot 20%.' },
  competency: { label: 'Kemampuan & Pelatihan', help: 'Skill kerja + pelatihan yang diikuti. Bobot 15%.' },
  coreValues: { label: 'Sikap & Penilaian Rekan', help: 'Perilaku dinilai atasan/rekan/bawahan. Bobot 15%.' },
  ...
} as const;
export function glossaryLabel(key: string): string { /* fallback ke key */ }
export function glossaryHelp(key: string): string | null { /* null bila tak ada */ }
```

---

## 3. Komponen Baru: `TermTooltip` (info "Apa ini?")

**File:** `src/components/ui/TermTooltip.tsx`
- Ikon info kecil (ⓘ) di samping istilah; hover/klik → tooltip 1–2 baris dari `glossaryHelp`.
- Aksesibel (title + `aria-label`; fokus keyboard) — sesuai skill human/a11y.
- Dipakai di kartu scorecard, header panel OKR, label modal KPI.

---

## 4. Redesign Modal "Ajukan Sasaran Kerja/KPI" (bahasa awam)

**File:** `src/app/dashboard/employee-portal/page.tsx` (modal ~baris 1393–1560). **Perubahan hanya label/placeholder/urutan/help — `kpiForm` state & payload API tidak berubah.**

| Field sekarang | Jadi | Tambahan |
|---|---|---|
| Judul: "Ajukan Sasaran Kerja / KPI Baru" | **"Tambah Target Kerja Baru"** | Subjudul: "Isi 4 hal di bawah, ± 2 menit. Bisa diubah nanti bersama atasan." |
| "Judul Sasaran KPI (SMART Target)" | **"Target kerja Anda"** | Helper: "Tulis hasil yang ingin dicapai. Contoh: *Respon keluhan pelanggan < 2 jam*" |
| "Pilar Strategis Balanced Scorecard (BSC)" | **"Tersambung ke tujuan perusahaan mana?"** | ⓘ "Pilih tujuan besar perusahaan yang target ini bantu capai." Opsi pakai nama awam (lihat bawah) |
| "Target Angka" | **"Angka target"** | Helper: "Nilai yang ingin dicapai." |
| "Satuan Pengukuran" | **"Satuan"** | Helper: "% , jam, unit, sesi" |
| "Bobot Sasaran (%)" | **"Seberapa penting? (bobot %)"** | Helper + saran otomatis; indikator kuota yang lebih ramah |
| Banner "Total Bobot … 100%" | **"Bobot target sudah penuh (100%)"** | Sederhanakan pilihan: "Pakai periode baru" / "Ambil bobot dari target lain" |
| Tombol simpan | "Ajukan" → **"Simpan Target"** | |

**Opsi Pilar (nama awam):**
- "Meningkatkan keuangan & efisiensi" (Finansial)
- "Membuat pelanggan puas" (Pelanggan)
- "Memperbaiki cara kerja & ketepatan waktu" (Proses Internal)
- "Mengembangkan orang & budaya kerja" (Pembelajaran & Pertumbuhan)

**Panduan bobot (helper):** "Target utama biasanya 20–30%. Total semua target maksimal 100%."

---

## 5. Sederhanakan Scorecard & Panel OKR (hanya teks)

- Hero: "Cumulative Weighted GPA" → **"Nilai Kinerja Akhir"** + ⓘ; subteks "Skala 1–4, makin tinggi makin baik".
- Kartu 4 komponen: pakai istilah awam (Target Kerja / Kepatuhan Prosedur / Kemampuan & Pelatihan / Sikap & Penilaian Rekan) + ⓘ.
- Panel OKR: "Cascading OKR Aktif" → **"Target Kerja Saya"**; "Balanced Scorecard (BSC)" → "Tujuan Perusahaan" (jargon tetap di ⓘ).
- Hapus/sembunyikan "Audit Trail ID" & "Formula bobot matematis" dari tampilan karyawan (pindah ke tooltip HR-only bila perlu).
- Chip "Bobot Terpakai 100% / Sisa Kuota" → "Terpakai X% · Sisa Y%" + kalimat: "Y% masih bisa dipakai untuk target baru."

---

## 6. Perubahan File (ringkas)

1. **Baru** `src/lib/employee/plainLanguage.ts` — glosarium (label + help).
2. **Baru** `src/components/ui/TermTooltip.tsx` — ikon ⓘ aksesibel.
3. **Edit** `src/app/dashboard/employee-portal/page.tsx` — label modal KPI + scorecard + panel OKR (teks/urutan saja).
4. **Opsional** `src/components/calculations/GPACalculatorModal.tsx` & kartu lain — konsisten istilah.
5. **Tes:** `tests/unit/plain-language.test.ts` — (a) setiap kunci glosarium punya label+help; (b) label tidak memuat jargon terlarang (`GPA`, `BSC`, `cascading`, `Bradford`, `Kirkpatrick`, `DUR-`). Satu snapshot/aset kecil memastikan tidak ada jargon bocor ke label UI.

> **Tanpa migrasi DB. Tanpa perubahan API.** Hanya presentasi + satu util + satu komponen.

---

## 7. Validasi

- `npx vitest run tests/unit/plain-language.test.ts --reporter=basic`
- Regresi: `tests/api/dashboard-routes.test.ts` & tes KPI (pastikan field API tak berubah).
- `npm run build` (harap exit 0). Cek visual di `http://localhost:3000/dashboard/employee-portal` (modal "Tambah Target Kerja").
- Semua **UNCOMMITTED**; tidak push.

---

## 8. Pertanyaan Terbuka (sebelum implementasi)

1. **Nada bahasa:** semi-formal ("Anda") — atau lebih santai ("kamu")? Usulan: **"Anda"**.
2. **Jargon untuk HR/auditor:** tetap tampil (dengan ⓘ) atau benar-benar disembunyikan dari karyawan?
3. **Istilah "GPA":** ganti total jadi **"Nilai Kinerja"**, atau pertahankan "GPA" dengan penjelasan? Usulan: **ganti total di UI karyawan**.
4. Cakupan: cukup **employee-portal** dulu, atau sekalian **manager-cockpit/hr-command** (istilah teknis boleh tetap di sana)?
5. Perlu **halaman/section "Panduan Singkat"** (3–4 langkah cara isi KPI) di atas form, atau cukup helper per-field?
