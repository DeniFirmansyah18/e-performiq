# ADR 011 - Course Materials and Automatic Certification

**Status:** Accepted (2026-10-01)
**Context:** Feature set `2026-10-01-materials-careers-certification-profile` (Tasks 3-5, 10).

## Decision
Courses gain learnable **materials**: `course_modules` (a lesson sequence of TEXT/VIDEO/PDF/QUIZ),
with per-employee progress in `course_completions`. Completing all modules of a course sets the
enrollment to COMPLETE. When the course is a **mandatory onboarding** course, a **certificate** is
issued automatically (`certificates`, unique per employee+course, with a public `verification_code`).

- `quiz-engine.gradeQuiz` grades QUIZ modules (pass >= 70).
- `courseContentService.completeModule` recomputes progress via the existing `completion-engine`,
  then calls `lmsObserver.onCourseCompleted` (competency evidence + badge) and, for mandatory
  courses, `certificateService.issueCertificate`.
- `certificate-engine` builds deterministic certificate numbers + verification codes.

## Rationale
- The Moodle model integration (ADR 008) introduced courses but not their content; employees could
  enrol but had nothing to study. Materials + quizzes close that gap.
- Certification on mandatory training satisfies the Pre-Employment requirement that new hires
  complete required training and receive a verifiable credential.
- Reusing `lmsObserver` keeps one orchestration path (course completion -> evidence -> badge ->
  certificate) and keeps everything idempotent (`ON CONFLICT DO NOTHING`, unique constraints).

## Consequences
- New tables `course_modules`, `course_completions`, `certificates`; enums `content_type_enum`.
- Certificates are publicly verifiable (`/api/v1/certificates/verify/:code`).
- No change to the GPA engine; DUR-03 integration remains as in ADR 009.

## Cost if wrong
Certificate issuance is tied to `is_mandatory`; changing which courses certify is a data change.
