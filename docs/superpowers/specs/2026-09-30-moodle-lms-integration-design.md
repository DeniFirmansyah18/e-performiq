# Spec: Integrasi Model Moodle (LMS) ke E-PerformIQ — Pre / During / Post

**Tanggal:** 2026-09-30
**Status:** Menunggu review
**Terkait:** PRD `PRD_Sistem_Penilaian_Karyawan (PT).md` §3.1/§3.2/§5, ADR 005/006/007
**Referensi:** Moodle (moodle/moodle) — `completion`, `competency`, `badges`, `admin/tool/lp`

---

## 1. Tujuan & Kriteria Sukses

Mengadopsi **model & logika Moodle** (course completion tracking, competency framework +
evidence, badges dengan kriteria, learning plan/IDP) ke dalam aplikasi secara **native**
(DB + engine aplikasi), lalu **memetakan ke tiga fase Employee Lifecycle**:

- **Pre-Employment** — kursus onboarding/kursus wajib + badge orientasi; completion
  onboarding berkontribusi ke kesiapan probation.
- **During-Employment** — competency framework + evidence dari kursus; training hours &
  Kirkpatrick gain → **komponen Competency (DUR-03)** pada GPA (bobot terkonfigurasi).
- **Post-Employment** — sertifikasi/legacy: badge & completed courses diarsipkan ke
  `lifetime_contributions`/legacy vault.

**Kriteria sukses:**
1. `npm run test` hijau (unit + integrasi baru) dan `npm run build` sukses.
2. `npm run db:reset` membuat skema + seed dari nol tanpa error (migrasi idempoten).
3. Karyawan dapat melihat katalog, mendaftar, menyelesaikan kursus, melihat progress,
   kompetensi, training hours, badge, dan learning plan — semua dari DB (tanpa alert palsu).
4. Data completion/competency dapat **memengaruhi skor DUR-03** secara terkonfigurasi dan
   **backward-compatible** (tanpa skor turunan, formula lama tetap identik).

---

## 2. Latar & Temuan

Aplikasi sudah memiliki seam setengah jadi: `moodle_course_enrollments` (completion_pct,
score, is_certified), `competency_scores` (level 1–5 + gap + score), `career_path_levels`,
dan `learningCareerService` (`matchCoursesToSkillGaps`, `enrollMoodleCourse`). Yang belum ada
dibanding model Moodle: **katalog kursus**, **competency framework formal + evidence**,
**badge dengan kriteria**, **learning plan (IDP)**, serta UI yang masih stub (`alert('...via
LTI SSO')`).

**Pendekatan terpilih: A — Adaptasi model native**, dengan seam `LmsConnector` tipis agar
adapter REST/LTI Moodle dapat ditambahkan nanti tanpa menulis ulang domain.

---

## 3. Ruang Lingkup

### WS-1 — Skema Data (migrasi `0009_moodle_lms.sql`)
Tabel baru (idempoten, `CREATE TABLE IF NOT EXISTS`):
- `competency_frameworks (id, code, name, description, is_active, created_at)`
- `competencies (id, framework_id→competency_frameworks, parent_id→competencies, name,
  taxonomy_level, description)`
- `moodle_courses (id, course_code UNIQUE, title, category, description,
  target_phase ENUM('PRE','DURING','POST'), is_mandatory, default_hours, level_min, is_active)`
- `course_competencies (id, course_id→moodle_courses, competency_id→competencies,
  outcome ENUM('COMPLETE','EVIDENCE','RECOMMEND','NONE'))`
- `competency_evidence (id, employee_id→employees, competency_id→competencies,
  source ENUM('COURSE','ACTIVITY','MANUAL'), course_id→moodle_courses, rating INT 1..5,
  action ENUM('COMPLETE','LOG','RECOMMEND'), notes, created_at)`
- `badges (id, code UNIQUE, name, description, badge_type ENUM('COURSE','COMPETENCY','PHASE'),
  is_active)`
- `badge_criteria (id, badge_id→badges, criteria_type ENUM('COURSE','COMPETENCY','COURSESET'),
  course_id→moodle_courses, competency_id→competencies, min_level)`
- `badge_awards (id, badge_id→badges, employee_id→employees, awarded_at, evidence_ref,
  UNIQUE(badge_id, employee_id))`
- `learning_plans (id, employee_id→employees, title, status ENUM('DRAFT','ACTIVE','COMPLETE'),
  period_id→appraisal_periods, created_at)`
- `learning_plan_items (id, plan_id→learning_plans, competency_id→competencies,
  course_id→moodle_courses, target_level, status ENUM('TODO','IN_PROGRESS','DONE'))`

Perluasan tabel lama (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`):
- `moodle_course_enrollments` += `completion_state ENUM('NOT_STARTED','IN_PROGRESS','COMPLETE')
  DEFAULT 'NOT_STARTED'`, `time_spent_minutes INT DEFAULT 0`, `last_activity_at TIMESTAMPTZ`.

ENUM dibuat idempoten via `DO $$ ... BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
(ADR 003). `schema.test.ts` diperbarui: 38 → 47 tabel.

### WS-2 — Engine & Service
Engine murni (pure, unit-tested):
- `completion-engine.ts`: `computeCourseProgress(items)`, `resolveCompletionState(progressPct, rule)`.
- `competency-evidence-engine.ts`: `deriveCompetencyRating(evidence[])`, `computeSkillGap(required, actual)`.
- `badge-award-engine.ts`: `evaluateBadgeCriteria(criteria, ctx)` (ALL/ANY), `selectAwardableBadges`.
- `training-hours-engine.ts`: `computeTrainingHours(enrollments)`, `kirkpatrickGain(pre, post)`.
- `competency-gpa-engine.ts`: `deriveCompetencyScore(levels, gaps, hours, cfg)` → 0–100.

Service (DB-backed, scope-aware):
- `learningLmsService.ts`: `listCourses(phase?)`, `enrollLocal(employeeId, courseId)`,
  `recordProgress(employeeId, courseId, pct)`, `completeCourse(employeeId, courseId)`.
- `competencyService.ts`: `getCompetencyProfile(employeeId)`, `upsertCompetencyEvidence(...)`.
- `learningPlanService.ts`: `createPlan`, `addPlanItem`, `advancePlanItem`.
- `lmsObserver.ts`: `onCourseCompleted(db, employeeId, courseId)` — orkestrasi idempoten:
  course completion → `competency_evidence` (via `course_competencies`) → evaluasi `badge_criteria`
  → `badge_awards` → (opsional) recompute competency score. Sinkron & idempoten (bukan queue).

**Integrasi GPA:** `gpa-engine.calculateCompositeGPA` menerima parameter opsional
`competencyScore` (0–100) yang, bila diberikan, menggantikan `W_comp × S_comp` statis.
Bobot/ambang dari `industry_benchmarks` (`TRAINING_HOURS_MIN`, dll.). Default tanpa parameter
= perilaku lama (backward-compatible).

### WS-3 — API (`/api/v1/learning/*`)
Permission baru: `learning:read` (semua role), `learning:write` (EMPLOYEE, PEOPLE_MANAGER,
HR_MANAGER, SUPER_ADMIN), `learning:manage` (HR_MANAGER, SUPER_ADMIN).
Endpoint:
- `GET /learning/courses?phase=` · `GET /learning/recommendations`
- `POST /learning/enrollments` · `PATCH /learning/enrollments/:id`
- `GET /learning/my-learning` · `GET /learning/competency-profile/:employeeId`
- `POST /learning/learning-plans` · `POST /learning/learning-plans/:id/items`
- `GET /learning/badges` · `GET /learning/training-summary`
- Rute lama `POST /learning/moodle` dipertahankan sebagai alias ke `enrollLocal`.
Semua: `getAuthSession` → `assertCan` → scope (`scope.ts`) → `ok()`; error via `problem()`.

### WS-4 — UI
**Employee Portal — modul "Learning & Development":**
- My Learning (kursus + progress % + training hours YTD vs 24 jam + badge).
- Katalog + rekomendasi skill-gap + tombol Daftar (native enroll).
- Competency profile (level 1–5 + gap).
- Learning Plan (IDP): buat/isi/selesaikan item.
- Perbaiki `CareerPathModal.tsx`: `alert('...via LTI SSO')` → aksi nyata ke `/learning/enrollments`.

**HR Command Center — panel "Learning & Certification":**
- Completion rate per fase, kursus wajib belum selesai, badge issued, distribusi training
  hours, kontribusi DUR-03 ke GPA. Form kelola katalog + badge criteria (`learning:manage`).

UI dibangun memakai **frontend-design** (skill terpisah) setelah spec+plan.

### WS-5 — Seed, Verifikasi, ADR
- Seed idempoten: 2 framework (AKHLAK, Cloud Engineering), ~8 kompetensi, ~6 kursus
  (2 Pre, 3 During, 1 Post), 2 badge + criteria, contoh learning plan, enrollment Budi
  (1 selesai → memicu evidence + award).
- Verifikasi: test hijau + build + `db:reset` + smoke UI.
- ADR: `008-moodle-native-adaptation.md`, `009-competency-training-to-gpa.md`.

---

## 4. Peta Lifecycle (ringkas)

| Fase | Kursus | Output | Dampak |
|---|---|---|---|
| PRE | Onboarding 101, AKHLAK Culture (mandatory) | completion + badge orientasi | kesiapan probation |
| DURING | Cloud Arch, PostgreSQL, Leadership | competency evidence, training hours | DUR-03 → GPA (terkonfigurasi) |
| POST | (arsip) sertifikasi & badge | legacy record | `lifetime_contributions` |

---

## 5. Non-Goals
- Server Moodle nyata, LTI 1.3, atau REST Web Services ke LMS eksternal (belum ada server).
- PHP/plugin Moodle (tidak mem-fork Moodle; hanya mengadopsi model).
- Queue async (BullMQ) — observer sinkron, memadai untuk skala PGlite single-node.
- Tidak menghapus/merusak formula GPA lama: tanpa skor turunan, hasil identik.

---

## 6. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Perubahan `schema.test.ts` (jumlah tabel) | Update ekspektasi ke 47 tabel + jalankan suite |
| Integrasi DUR-03 mengubah GPA test lama | Parameter opsional + jaminan default identik; test regresi |
| Duplikasi evidence/badge saat re-complete | Observer idempoten (`ON CONFLICT DO NOTHING`, `UNIQUE(badge_id, employee_id)`) |
| Scope bocor (lihat kompetensi karyawan lain) | `learning:read` + `assertEmployeeVisible` |

---

## 7. Keputusan Owner (brainstorm)
1. Bentuk: **adaptasi model native** (+ seam konektor tipis). 2. Fase: **Pre+During+Post**.
3. Fitur: **completion, competency, badge, learning plan**. 4. Katalog: **tabel + seed**.
5. GPA: **DUR-03 boleh terpengaruh** (terkonfigurasi, backward-compatible). 6. Cakupan: **menyeluruh (DB→API→UI)**.
