-- 0031: Pisahkan bank soal teknis per posisi.
--
-- Masalah: soal hasil generate AI menempel ke template TECH-GEN (position_id NULL)
-- yang dipakai SEMUA posisi → soal Software Engineer muncul di tes Digital Marketing.
-- Perbaikan: buat template TECHNICAL khusus posisi untuk tiap soal AI yang ada di
-- template generik (di-derive dari source_ref → job_postings.position_id), lalu
-- pindahkan soal itu ke template posisi tersebut. Soal generik (source bukan AI)
-- tetap di TECH-GEN sebagai fallback.
--
-- Idempotent (ADR 003): aman dijalankan berulang.

-- 1) Template khusus posisi untuk tiap posisi yang punya soal AI nyasar di template generik.
INSERT INTO assessment_templates (code, title, type, weight, description, position_id, is_active)
SELECT DISTINCT
  'TECH-' || UPPER(SUBSTRING(REPLACE(jp.position_id::text, '-', '') FROM 1 FOR 8)),
  'Tes Teknis — ' || COALESCE(pos.position_title, 'Posisi'),
  'TECHNICAL'::assessment_type_enum,
  40,
  'Bank soal teknis khusus posisi ' || COALESCE(pos.position_title, 'Posisi') || '.',
  jp.position_id,
  TRUE
FROM assessment_questions q
JOIN assessment_templates t ON t.id = q.template_id
                    AND t.type = 'TECHNICAL'::assessment_type_enum
                    AND t.position_id IS NULL
JOIN job_postings jp ON jp.id::text = q.source_ref
JOIN job_positions pos ON pos.id = jp.position_id
WHERE q.source = 'AI'
  AND jp.position_id IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- 2) Pindahkan soal AI dari template generik ke template khusus posisi.
UPDATE assessment_questions q
   SET template_id = dest.id
  FROM assessment_templates t,
       job_postings jp,
       assessment_templates dest
 WHERE q.template_id = t.id
   AND t.type = 'TECHNICAL'::assessment_type_enum
   AND t.position_id IS NULL
   AND q.source = 'AI'
   AND jp.id::text = q.source_ref
   AND jp.position_id IS NOT NULL
   AND dest.type = 'TECHNICAL'::assessment_type_enum
   AND dest.position_id = jp.position_id
   AND dest.id <> q.template_id;
