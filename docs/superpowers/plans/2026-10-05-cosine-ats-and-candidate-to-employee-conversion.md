# Cosine ATS & Kandidat → Karyawan (HIRED) — Implementation Plan

**Goal:** (1) Perbaiki analisis seleksi berkas dengan cosine similarity (mengadopsi repo `kanishksh4rma/Resume-Scanner-for-Job-Description--using-Cosine-Similarity`), (2) saat lamaran kandidat berstatus `HIRED`, otomatis provision record `employees` + `users` (role `EMPLOYEE`), nonaktifkan akun kandidat, dan arahkan ke `/login`, (3) tambah 3 tab fase "Sebelum/Saat/Setelah Kerja" di employee-portal (pengelompokan visual saja, fase "Setelah Kerja" read-only).

**Architecture:** Next.js 14 App Router + Drizzle dual-driver (PGlite dev / postgres-js prod). Business logic di `src/lib/services/*` (fungsi `db: Db`, driver-agnostic `db.execute(sql...)`); route handler tipis (parse → assert → service → `ok/fail/problem`). Konversi kandidat memakai pola `employeeRegistrationService` (idempoten, best-effort). Cosine ATS = modul murni tanpa dependency baru.

**Tech Stack:** TypeScript, Next.js 14, React 18, Tailwind, Zod, Drizzle, Vitest 2.1.9 (route tests share dev `.pglite`; integration tests pakai `createTestDb()`).

**Spec:** `docs/superpowers/specs/2026-10-05-cosine-ats-and-candidate-to-employee-conversion.md`

**Review Focus:** (1) cosine harus deterministik & tanpa dependency; (2) konversi harus idempoten (tak ada duplikat `employees`/`users`); (3) provisioning best-effort, tak memblokir update status; (4) fase = pengelompokan visual, JANGAN ubah logika fitur employee-portal (kecuali menambah panel POST baru); (5) fitur offboarding self (read & write) HARUS membatasi ke karyawan pemilik sesi (anti-spoof `employee_id`); (6) setiap route/service baru punya test Vitest; (7) satu migrasi aditif (kolom `knowledge_handovers.notes`) + ADR 019; (8) commit per task, **JANGAN push**.

---

## Global Constraints

- Node ≥ 18. Prefiks path bila `npm` tak ditemukan: `$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1`
- Test: `$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic`
- Jangan edit file di luar yang dicantumkan pada task.
- Branch `master`. **Commit tiap task. JANGAN push.**
- Komentar bahasa Indonesia sesuai gaya repo; jangan tambah komentar boilerplate.
- Dual-driver aman: service menerima `db: Db`, pakai `db.execute(sql...)`.
- Route HR baru: `getAuthSession` + `assertCan`; route kandidat: `getCandidateSession`/`...OrNull`.
- Sebelum menjalankan suite: `npm run db:reset` dan pastikan server dev mati (cegah PGlite abort).

---

## Task 1 — Modul Cosine Similarity (murni)

**Files:**
- Create: `src/lib/services/cosineSimilarity.ts`
- Create: `tests/unit/cosineSimilarity.test.ts`

**Interfaces:**
- Produces: `tokenize(text):string[]`, `buildVocabulary(docs):Map<string,number>`, `termCounts(tokens, vocab):number[]`, `cosineSimilarity(a,b):number` (0..1), `matchPercentage(resumeText, jobText):number` (0..100, 2 desimal).
- Consumes: nothing (pure).

- [ ] **Step 1: Tulis test yang gagal** `tests/unit/cosineSimilarity.test.ts`

Cover: (1) identik → 100; (2) tanpa irisan → 0; (3) simetri a,b == b,a; (4) kosong → 0 (tak NaN); (5) deterministik; (6) teks beririsan → 0<n<100.

- [ ] **Step 2: Jalankan test — pastikan GAGAL**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run tests/unit/cosineSimilarity.test.ts --reporter=basic
```

- [ ] **Step 3: Implementasi** `src/lib/services/cosineSimilarity.ts`

```ts
/**
 * Cosine similarity antar teks (bag-of-words unigram) — replikasi pendekatan
 * CountVectorizer() + cosine_similarity dari repo acuan ATS, tanpa dependency.
 * Deterministik; tidak pernah melempar error.
 */
const STOPWORDS = new Set([
  'dan','atau','yang','untuk','dengan','pada','di','ke','dari','the','a','an','of','to','and','or','for','in','on','with','is','are','be','as','by','at','it','this','that',
]);

export function tokenize(text: string): string[] {
  const t = String(text ?? '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ');
  const out: string[] = [];
  for (const raw of t.split(/\s+/)) {
    const tok = raw.replace(/^\.+|\.+$/g, '');
    if (tok.length >= 2 && !STOPWORDS.has(tok)) out.push(tok);
  }
  return out;
}

export function buildVocabulary(docs: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const d of docs) for (const tok of tokenize(d)) if (!vocab.has(tok)) vocab.set(tok, vocab.size);
  return vocab;
}

export function termCounts(tokens: string[], vocab: Map<string, number>): number[] {
  const v = new Array(vocab.size).fill(0);
  for (const tok of tokens) { const i = vocab.get(tok); if (i !== undefined) v[i] += 1; }
  return v;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Persentase kecocokan 0..100 (dibulatkan 2 desimal). */
export function matchPercentage(resumeText: string, jobText: string): number {
  const vocab = buildVocabulary([resumeText ?? '', jobText ?? '']);
  const a = termCounts(tokenize(resumeText ?? ''), vocab);
  const b = termCounts(tokenize(jobText ?? ''), vocab);
  const sim = cosineSimilarity(a, b);
  return Math.round(sim * 100 * 100) / 100;
}
```

- [ ] **Step 4: Jalankan test — pastikan LULUS** (perintah sama Step 2).

- [ ] **Step 5: Commit**

```
git add src/lib/services/cosineSimilarity.ts tests/unit/cosineSimilarity.test.ts
git commit -m "feat(ats): add bag-of-words cosine similarity module"
```

---

## Task 2 — Integrasi cosine ke ATS service

**Files:**
- Modify: `src/lib/services/atsService.ts`
- Modify: `tests/integration/atsService.test.ts`

**Interfaces:**
- Consumes: `matchPercentage` dari `@/lib/services/cosineSimilarity`.
- Produces: `AtsResult.cosine:number` (0..100), `AtsScoreBreakdown.cosine:number` (0..1); `computeAtsScore(parsed, requiredSkills, jobText='', resumeText='')`.

- [ ] **Step 1: Tulis test yang gagal** (tambahkan ke `tests/integration/atsService.test.ts`)

Cover: (1) `computeAtsScore(..., jobText)` → `result.cosine > 0` & `result.score > 0`; (2) CV relevan beri `cosine` lebih tinggi daripada CV tak relevan; (3) `runAts` posting seed `87000000-...-001` dengan CV relevan → `matched` mencakup TypeScript/Next.js/PostgreSQL dan `cosine` tinggi (>10).

- [ ] **Step 2: Jalankan test — pastikan GAGAL.**

- [ ] **Step 3: Implementasi**

- Import `matchPercentage`.
- `AtsScoreBreakdown` + `cosine:number`; `AtsResult` + `cosine:number`.
- `computeAtsScore(parsed, requiredSkills, jobText='', resumeText='')`: `skillsScore = matchRatio*100`; `cosine = matchPercentage(resumeText || (parsed.summary ?? '') + ' ' + (parsed.skills ?? []).join(' '), jobText)`; `score = clamp(round(0.5*skillsScore + 0.5*cosine), 0..100)`; `breakdown.cosine = cosine/100`.
- Bobot 50/50 sebagai konstanta `const WEIGHTS = { skills: 0.5, cosine: 0.5 }` (gantikan/menyesuaikan `WEIGHTS` lama — CATATAN: komponen contact/experience/education/summary lama tetap dihitung untuk breakdown informasi tetapi **tidak** lagi masuk skor akhir, ATAU keep keduanya dengan penjumlahan berbobot. **Keputusan: skor akhir = 0.5*skills + 0.5*cosine**; pertahankan field breakdown lama apa adanya untuk kompatibilitas tampilan.)
- `runAts`: query `job_postings` ambil `posting_title`, `description`, `required_skills`; `jobText = [title, description, (required||[]).join(' ')].join(' ')`; panggil `computeAtsScore(parsed, required, jobText, text)`.
- Sertakan `cosine` dalam `parsed_json` saat `saveResumeParse` (mis. `JSON.stringify({...parsed, _ats:{ cosine: result.cosine }})`) — tanpa kolom baru.

- [ ] **Step 4: Jalankan test — pastikan LULUS.**

- [ ] **Step 5: Commit**

```
git add src/lib/services/atsService.ts tests/integration/atsService.test.ts
git commit -m "feat(ats): blend cosine text-match into ATS score"
```

---

## Task 3 — Konversi kandidat → karyawan saat HIRED

**Files:**
- Create: `src/lib/services/candidateConversionService.ts`
- Modify: `src/lib/services/candidateService.ts` (`updateApplicationStatus`)
- Modify: `src/lib/services/candidateReviewService.ts` (`recordDecision` bila memetakan HIRED)
- Create: `tests/integration/candidateConversion.test.ts`

**Interfaces:**
- Produces: `convertHiredCandidate(db, { applicationId, actorUserId? }): Promise<{ employeeId:string; userId:string; created:boolean }>`
- Consumes: `job_applications`, `candidates`, `candidate_accounts`, `job_postings`, `employees`, `users`.

- [ ] **Step 1: Tulis test yang gagal** `tests/integration/candidateConversion.test.ts`

`createTestDb()` + `runSeed`. Setup: `candidate_accounts` + `candidates.account_id` + `job_applications` (status INTERVIEW). Cover: (1) konversi → `created:true`, `employees` ada (dept/posisi = posting), `users` ada (role EMPLOYEE, email kandidat, hash == hash kandidat, is_active true); (2) `candidate_accounts.is_active=false`; (3) idempoten (panggil 2× → `created:false`, count user=1); (4) `updateApplicationStatus(db, appId, 'HIRED')` memicu pembuatan user+employee.

- [ ] **Step 2: Jalankan test — pastikan GAGAL.**

- [ ] **Step 3: Implementasi** `candidateConversionService.ts`

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

function randomCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Konversi kandidat HIRED → karyawan (employees + users), nonaktifkan akun kandidat.
 * Idempoten & best-effort: pemanggilan ulang memakai record yang sudah ada.
 */
export async function convertHiredCandidate(
  db: Db,
  input: { applicationId: string; actorUserId?: string | null },
): Promise<{ employeeId: string; userId: string; created: boolean }> {
  const info = (await db.execute(sql`
    SELECT ja.candidate_id AS "candidateId", c.full_name AS "fullName", c.email,
           c.account_id AS "accountId", c.phone AS "phone",
           jp.department_id AS "departmentId", jp.position_id AS "positionId"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE ja.id = ${input.applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const row = info.rows?.[0];
  if (!row) throw new Error('Lamaran tidak ditemukan.');
  const email = String(row.email).toLowerCase();

  const existingUser = (await db.execute(sql`
    SELECT u.id AS "userId", u.employee_id AS "employeeId"
      FROM users u WHERE LOWER(u.email) = ${email} LIMIT 1
  `)) as unknown as { rows: Array<{ userId: string; employeeId: string | null }> };
  if (existingUser.rows[0]?.employeeId) {
    await db.execute(sql`UPDATE candidate_accounts SET is_active = FALSE WHERE id = ${row.accountId}::uuid`);
    return { employeeId: existingUser.rows[0].employeeId!, userId: existingUser.rows[0].userId, created: false };
  }

  const hashRow = (await db.execute(sql`
    SELECT password_hash AS "hash" FROM candidate_accounts WHERE id = ${row.accountId}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ hash: string }> };
  const passwordHash = hashRow.rows[0]?.hash ?? '';

  const empRes = (await db.execute(sql`
    INSERT INTO employees (employee_code, full_name, email, phone_number, department_id, position_id, status, base_salary, join_date)
    VALUES (${randomCode('EMP')}, ${row.fullName}, ${email}, ${row.phone ?? null},
            ${row.departmentId}::uuid, ${row.positionId}::uuid, 'PROBATION', 0, CURRENT_DATE)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const employeeId = empRes.rows[0].id;

  const userRes = (await db.execute(sql`
    INSERT INTO users (employee_id, email, password_hash, role, is_active)
    VALUES (${employeeId}::uuid, ${email}, ${passwordHash}, 'EMPLOYEE', TRUE)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const userId = userRes.rows[0].id;

  await db.execute(sql`UPDATE candidate_accounts SET is_active = FALSE WHERE id = ${row.accountId}::uuid`);
  return { employeeId, userId, created: true };
}
```

> Verifikasi tipe kolom (`employees.phone_number`/`department_id`/`position_id` nullable, `users.role` enum) sesuai skema; sesuaikan bila perlu. Reuse util `randomCode` bila sudah ada (jangan duplikasi).

- [ ] **Step 4: Trigger di `updateApplicationStatus`** (dan `recordDecision` bila relevan)

```ts
if (status === 'HIRED') {
  try {
    const { convertHiredCandidate } = await import('@/lib/services/candidateConversionService');
    await convertHiredCandidate(db, { applicationId });
  } catch (err) {
    console.warn('[candidateService] konversi HIRED gagal:', (err as Error)?.message);
  }
}
```

- [ ] **Step 5: Jalankan test — pastikan LULUS.**

- [ ] **Step 6: Commit**

```
git add src/lib/services/candidateConversionService.ts src/lib/services/candidateService.ts src/lib/services/candidateReviewService.ts tests/integration/candidateConversion.test.ts
git commit -m "feat(recruitment): auto-provision employee+user when candidate is HIRED"
```

---

## Task 4 — Kandidat HIRED diarahkan keluar dari portal kandidat

**Files:**
- Modify: `src/app/api/v1/careers/auth/login/route.ts`
- Modify: `src/app/careers/portal/page.tsx`
- Create: `tests/api/candidate-converted-redirect.test.ts`

**Interfaces:**
- Consumes: `candidate_accounts.is_active`.
- Produces: login kandidat akun nonaktif → 403 dengan pesan arahan ke `/login`; portal kandidat menampilkan banner + tombol "Login Portal Karyawan" bila `me` mengembalikan status converted.

- [ ] **Step 1: Tulis test yang gagal** `tests/api/candidate-converted-redirect.test.ts`

Route test (dev `.pglite`, `getDb()` + `runSeed`). Siapkan akun kandidat, set `is_active=false`. Cover: (1) `POST /api/v1/careers/auth/login` dengan kredensial akun nonaktif → 403 & pesan memuat "portal karyawan"; (2) akun aktif → 200. (Alternatif: uji via `me` mengembalikan `converted:true`.)

- [ ] **Step 2: Jalankan test — pastikan GAGAL.**

- [ ] **Step 3: Implementasi**

- Di `careers/auth/login/route.ts`: setelah verifikasi password, bila `acc.is_active === false` → `fail('ACCOUNT_CONVERTED', 'Anda telah menjadi karyawan. Silakan login di portal karyawan (/login).', 403)`.
- Di `careers/auth/me/route.ts` (bila perlu): sertakan `converted: !is_active` pada respons akun.
- Di `careers/portal/page.tsx`: bila `me` mengembalikan `converted`, tampilkan banner + tautan ke `/login`; nonaktifkan aksi lamaran.
- (Opsional) Di `careers/status/page.tsx`: bila status lamaran `HIRED`, tampilkan banner "Selamat! Anda diterima — silakan login di portal karyawan" + tombol `/login`.

- [ ] **Step 4: Jalankan test — pastikan LULUS.**

- [ ] **Step 5: Commit**

```
git add src/app/api/v1/careers/auth/login/route.ts src/app/api/v1/careers/auth/me/route.ts src/app/careers/portal/page.tsx src/app/careers/status/page.tsx tests/api/candidate-converted-redirect.test.ts
git commit -m "feat(careers): redirect converted candidates to employee portal"
```

---

## Task 5 — Tab fase "Sebelum/Saat/Setelah Kerja" + fitur Offboarding karyawan (read & write)

**Files:**
- Modify: `src/app/dashboard/employee-portal/page.tsx`
- Create: `src/lib/employee/phase.ts` (util pemetaan fase, dapat diuji)
- Create: `src/components/employee/OffboardingSelfPanel.tsx`
- Create: `src/lib/services/offboardingSelfService.ts` (service read/write sisi karyawan)
- Create: `src/app/api/v1/offboarding/me/route.ts` (GET + POST)
- Create: `src/app/api/v1/offboarding/me/handover/[id]/route.ts` (PATCH)
- Create: `src/app/api/v1/offboarding/me/exit-interview/route.ts` (POST)
- Create: `src/lib/db/migrations/00XX_exit_interviews_and_handover_notes.sql`
- Modify: `src/lib/auth/rbac.ts` (tambah `offboarding:read`/`offboarding:write` bila belum ada; sertakan `EMPLOYEE`)
- Create: `tests/unit/employeePhases.test.ts`
- Create: `tests/api/offboarding-self.test.ts`

**Interfaces:**
- Produces: state `activePhase: 'PRE'|'DURING'|'POST'`; `phaseOf(feature): 'PRE'|'DURING'|'POST'`.
- Produces (offboarding self):
  - `getMyOffboarding(db, employeeId)` → `{ request: null } | { request: {...}, handovers: [...], handoverProgress: number, severance: {...} | null }`
  - `initiateMyOffboarding(db, session, { reasonForLeaving, resignationNoticeDate, lastWorkingDay })` → membuat request dengan `employee_id = session.employeeId` (dipaksa; tak bisa spoof).
  - `markMyHandover(db, session, handoverId)` → menandai item milik karyawan (kolom `notes`/atau field aman); verifikasi resmi tetap HR.
- Consumes: `offboarding_requests`, `knowledge_handovers`, `severance_calculations` + `offboardingRepository`.

- [ ] **Step 1: Tulis test unit fase — GAGAL** `tests/unit/employeePhases.test.ts`

Cover: `phaseOf('onboarding')==='PRE'`; `phaseOf('scorecard'|'okr'|'development'|'timesheet'|'payslip'|'profile')==='DURING'`; `phaseOf('offboarding')==='POST'`.

- [ ] **Step 2: Tulis test route offboarding self — GAGAL** `tests/api/offboarding-self.test.ts`

Route test (dev `.pglite`, `getDb()` + `runSeed`, `signSession` role EMPLOYEE). Cover:
1. `GET /api/v1/offboarding/me` tanpa request → `{ request: null }`.
2. `POST /api/v1/offboarding/me` membuat request; `employee_id` di DB == `session.employeeId`; body yang mencoba `employee_id` lain **diabaikan** (anti-spoof).
3. `GET .../me` lalu mengembalikan request tsb.
4. `PATCH .../me/handover/[id]` menolak (403/404) handover milik karyawan lain.
5. `POST .../me/exit-interview` menyimpan feedback; `GET .../me` menyertakan `exitInterview`.

- [ ] **Step 3: Jalankan test — pastikan GAGAL.**

- [ ] **Step 4: Implementasi util fase** `src/lib/employee/phase.ts`

```ts
export type WorkPhase = 'PRE' | 'DURING' | 'POST';
const MAP: Record<string, WorkPhase> = {
  onboarding: 'PRE',
  scorecard: 'DURING', okr: 'DURING', development: 'DURING',
  timesheet: 'DURING', payslip: 'DURING', career: 'DURING', reimbursement: 'DURING',
  helpdesk: 'DURING', evidence: 'DURING', jobboard: 'DURING', profile: 'DURING',
  offboarding: 'POST',
};
export function phaseOf(feature: string): WorkPhase { return MAP[feature] ?? 'DURING'; }
export const PHASE_LABEL: Record<WorkPhase, string> = {
  PRE: 'Sebelum Kerja', DURING: 'Saat Kerja', POST: 'Setelah Kerja',
};
```

- [ ] **Step 5: Implementasi service** `src/lib/services/offboardingSelfService.ts`

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { insertOffboardingRequest, selectHandoversByRequest } from '@/lib/repositories/offboardingRepository';

export async function getMyOffboarding(db: Db, employeeId: string | null) {
  if (!employeeId) return { request: null };
  const res = (await db.execute(sql`
    SELECT id, reason_for_leaving AS "reasonForLeaving", resignation_notice_date AS "resignationNoticeDate",
           last_working_day AS "lastWorkingDay", status::text AS status, created_at AS "createdAt"
      FROM offboarding_requests WHERE employee_id = ${employeeId}::uuid
      ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: any[] };
  const request = res.rows?.[0];
  if (!request) return { request: null };
  const handovers = await selectHandoversByRequest(db, request.id);
  const verified = handovers.filter((h: any) => h.isVerified).length;
  const handoverProgress = handovers.length ? Math.round((verified / handovers.length) * 100) : 100;
  const sev = (await db.execute(sql`
    SELECT service_years AS "serviceYears", base_salary::float8 AS "baseSalary",
           total_disbursement::float8 AS "totalDisbursement", is_paid AS "isPaid"
      FROM severance_calculations WHERE offboarding_request_id = ${request.id}::uuid LIMIT 1
  `)) as unknown as { rows: any[] };
  return { request, handovers, handoverProgress, severance: sev.rows?.[0] ?? null };
}

export async function initiateMyOffboarding(
  db: Db, session: SessionPayload,
  data: { reasonForLeaving: string; resignationNoticeDate: string; lastWorkingDay: string },
) {
  if (!session.employeeId) throw new Error('Akun Anda tidak tertaut ke karyawan.');
  // employee_id DIPAKSA dari sesi (anti-spoof).
  return insertOffboardingRequest(db, { employeeId: session.employeeId, ...data });
}

export async function markMyHandover(db: Db, session: SessionPayload, handoverId: string) {
  if (!session.employeeId) throw new Error('Akun Anda tidak tertaut ke karyawan.');
  const res = (await db.execute(sql`
    UPDATE knowledge_handovers SET notes = COALESCE(notes, 'Ditandai siap oleh karyawan')
     WHERE id = ${handoverId}::uuid
       AND offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id = ${session.employeeId}::uuid)
    RETURNING id
  `)) as unknown as { rows: any[] };
  if (!res.rows?.[0]) throw new Error('Item serah terima tidak ditemukan atau bukan milik Anda.');
  return res.rows[0];
}

export async function saveMyExitInterview(
  db: Db, session: SessionPayload,
  data: { feedback: string; overallRating?: number; wouldRecommend?: boolean },
) {
  if (!session.employeeId) throw new Error('Akun Anda tidak tertaut ke karyawan.');
  const reqRow = (await db.execute(sql`
    SELECT id FROM offboarding_requests WHERE employee_id = ${session.employeeId}::uuid ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  const reqId = reqRow.rows[0]?.id ?? null;
  const res = (await db.execute(sql`
    INSERT INTO exit_interviews (employee_id, offboarding_request_id, feedback, overall_rating, would_recommend)
    VALUES (${session.employeeId}::uuid, ${reqId}::uuid, ${data.feedback}, ${data.overallRating ?? null}, ${data.wouldRecommend ?? null})
    ON CONFLICT (employee_id, offboarding_request_id)
    DO UPDATE SET feedback = EXCLUDED.feedback, overall_rating = EXCLUDED.overall_rating, would_recommend = EXCLUDED.would_recommend
    RETURNING id
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}
```

> CATATAN: `knowledge_handovers` **belum punya kolom `notes`**, dan exit interview butuh tabel `exit_interviews`. Migrasi aditif `00XX_exit_interviews_and_handover_notes.sql` menambahkan keduanya + ADR 019.

- [ ] **Step 6: Implementasi route** `offboarding/me/route.ts` (GET/POST) + `offboarding/me/handover/[id]/route.ts` (PATCH) + `offboarding/me/exit-interview/route.ts` (POST)

- GET: `getAuthSession` → `getMyOffboarding(db, session.employeeId)` (sertakan `exitInterview`).
- POST (`/me`): `getAuthSession` + `assertCan(session,'offboarding:write')` + Zod `{ reasonForLeaving, resignationNoticeDate, lastWorkingDay }` → `initiateMyOffboarding`.
- PATCH (`/me/handover/[id]`): `getAuthSession` + `assertCan(session,'offboarding:write')` → `markMyHandover`; error → `fail('NOT_FOUND', msg, 404)`.
- POST (`/me/exit-interview`): `getAuthSession` + `assertCan(session,'offboarding:write')` + Zod `{ feedback, overallRating?, wouldRecommend? }` → `saveMyExitInterview`.

- [ ] **Step 7: RBAC** — tambah `offboarding:read`/`offboarding:write` (sertakan EMPLOYEE) bila belum ada; import di route.- [ ] **Step 5b: Migrasi** `src/lib/db/migrations/00XX_exit_interviews_and_handover_notes.sql` — `ALTER TABLE knowledge_handovers ADD COLUMN IF NOT EXISTS notes TEXT;` + `CREATE TABLE IF NOT EXISTS exit_interviews (...)` (sesuai spec 6.4). Jalankan `npm run db:migrate`.
- [ ] **Step 8: UI** `src/components/employee/OffboardingSelfPanel.tsx`

Read: status request, tanggal, progress handover, ringkasan pesangon. Write: form "Ajukan Resign" (reason, notice date, last working day) bila belum ada request; tombol "Tandai Siap" per item handover; form **Exit Interview** (rating 1..5, rekomendasi, feedback). Bahasa & gaya Tailwind konsisten.

- [ ] **Step 9: Integrasi tab fase** di `employee-portal/page.tsx`

Tambah tab `activePhase` (PRE/DURING/POST) di atas grid; render kartu sesuai `phaseOf`; fase POST render `OffboardingSelfPanel`. **Tidak mengubah handler fitur lain.** Aksesibilitas: `role="tablist"`/`aria-selected`.

- [ ] **Step 10: Jalankan test — pastikan LULUS** (unit fase + route offboarding self).

- [ ] **Step 11: Verifikasi browser** — login karyawan; cek 3 tab; di POST: ajukan resign, tandai handover, lihat status/pesangon.

- [ ] **Step 12: Commit**

```
git add src/app/dashboard/employee-portal/page.tsx src/lib/employee/phase.ts src/components/employee/OffboardingSelfPanel.tsx src/lib/services/offboardingSelfService.ts src/app/api/v1/offboarding/me src/lib/auth/rbac.ts src/lib/db/migrations tests/unit/employeePhases.test.ts tests/api/offboarding-self.test.ts
git commit -m "feat(employee): pre/during/post phase tabs + self-service offboarding (read & write) + exit interview"
```

---

## Task 6 — Verifikasi end-to-end, ADR, README

**Files:**
- Modify: `README.md`
- Create: `docs/decisions/019-cosine-ats-and-candidate-conversion.md`
- (Migrasi `00XX_exit_interviews_and_handover_notes.sql` dibuat pada Task 5 Step 5b; task ini hanya memverifikasi sudah diterapkan.)

- [ ] **Step 1: Reset DB + seed** — `npm run db:reset` (menerapkan migrasi `knowledge_handovers.notes`).

- [ ] **Step 2: Walk-through manual**

Lamar (CV relevan) → skor ATS (cosine) wajar & skill cocok → HR set `HIRED` → `employees`/`users` dibuat, akun kandidat nonaktif → login kandidat ditolak (diarahkan) → login karyawan baru (sandi kandidat) sukses → employee-portal tampil dengan 3 tab fase → di tab **Setelah Kerja**: ajukan resign, tandai handover, lihat status & pesangon.

- [ ] **Step 3: README** — tambah bagian "Cosine ATS & konversi HIRED" (cara skor dihitung; perilaku konversi; password karyawan = sandi kandidat; akses kandidat dinonaktifkan).

- [ ] **Step 4: ADR** — tulis ADR 019 bila ada keputusan skema/perilaku permanen (mis. bobot 50/50, nonaktifkan akun kandidat).

- [ ] **Step 5: Full suite + build**

```
$env:Path += ";C:\Program Files\nodejs"; $env:NO_COLOR=1; .\node_modules\.bin\vitest.cmd run --reporter=basic
npm run build
```

- [ ] **Step 6: Commit**

```
git add README.md docs/decisions
git commit -m "docs: cosine ATS + candidate-to-employee conversion"
```

---

## Self-Review Checklist

- [ ] Setiap task punya file eksplisit + loop test (gagal → implement → lulus → commit).
- [ ] Cosine deterministik, tanpa dependency, punya unit test.
- [ ] Konversi idempoten (uji panggil ganda) & best-effort (tak memblokir update status).
- [ ] Akun kandidat nonaktif hanya setelah provisioning sukses; pesan jelas + jalur `/login`.
- [ ] Tab fase = pengelompokan visual; **logika fitur employee-portal tidak diubah** (hanya menambah panel POST offboarding).
- [ ] Fitur offboarding self membatasi aksi ke karyawan pemilik sesi (`employee_id` dari sesi; anti-spoof).
- [ ] Satu migrasi aditif (`knowledge_handovers.notes`) + ADR 019.
- [ ] Full suite hijau + build sukses sebelum commit akhir.
- [ ] **JANGAN push.**
