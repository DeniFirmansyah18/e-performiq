# ADR 010 - Public Careers Portal and Candidate Intake

**Status:** Accepted (2026-10-01)
**Context:** Feature set `2026-10-01-materials-careers-certification-profile` (Task 9/11).

## Decision
External candidates can apply to public job postings through a **session-less** public
portal (`/careers`) backed by public API routes:
- `GET /api/v1/careers/postings` - open public postings (`job_postings.is_public = TRUE`).
- `POST /api/v1/careers/apply` - creates a `candidates` row + `job_applications` row and returns a
  unique `application_no`.
- `GET /api/v1/careers/status/:applicationNo` - public status lookup.
- `GET /api/v1/certificates/verify/:code` - public certificate verification.

## Rationale
- Candidates are not employees and never hold a session; requiring auth would block the funnel.
- The PRD (Pre-Employment phase) expects external intake (MPP-filling), previously only modelled
  as HR-entered `recruitment_assessments`.
- `internal_applications` remains for employee mobility; `job_applications` is the external path.

## Safeguards
- `zod` strict validation on every field (length caps, email format, uuid posting id).
- A hidden honeypot field `website` must be empty; non-empty -> 400.
- No binary upload - `resume_url` is a link (per ADR 007 non-goals for object storage).

## Consequences
- New tables `candidates`, `job_applications`; `job_postings.is_public`.
- HR views/updates applications via `/api/v1/recruitment/candidates*` (`recruitment:read/manage`).

## Non-goals
- Full ATS (multi-stage scorecards, interview scheduling from applications), file storage,
  captcha services. A rate-limit beyond the honeypot is deferred.

## Cost if wrong
Public intake could attract spam without a real rate limiter; the honeypot + validation mitigate,
and a proper limiter can be added without schema change.
