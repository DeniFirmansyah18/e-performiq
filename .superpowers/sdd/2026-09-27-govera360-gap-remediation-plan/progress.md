# SDD ledger — plan: docs/superpowers/plans/2026-09-27-govera360-gap-remediation-plan.md

## Pre-flight scan
| Tasks | Interface/Shared File | Finding | Ruling |
|---|---|---|---|
| Task 1 & Task 3 | `attendance_records` | Task 1 defines table with PP 35/2021 constraints; Task 3 queries it | Consistent |
| Task 2 & Tasks 3, 5, 7 | Permissions `attendance:*`, `payroll:read`, `flight_risk:read`, `wbs:read` | Task 2 declares permissions; Tasks 3, 5, 7 enforce via `assertCan` | Consistent |
| Task 3 & Task 4 | `computeBradfordFactor`, `getAttendanceFactRows` | Task 3 exports them; Task 4 imports them to build risk profile | Consistent |
| Task 4 & Task 5 | `buildRiskProfile`, `calculateFlightRisk` | Task 4 exports; Task 5 route calls them | Consistent |
| Task 5 & Task 8 | `/api/v1/governance/flight-risk`, `/api/v1/finance/cost-of-workforce` | Task 5 creates endpoints; Task 8 consumes them in React UI | Consistent |
| Task 9 & Task 11 | `/api/v1/talent-acquisition/*` | Task 9 creates endpoints; Task 11 creates JobBoardModal & review | Consistent |
| Task 10 | `employees.payslip_pin_hash` | Task 10 migration 0005 adds bcrypt column & modifies `getVerifiedPayslip` | Consistent |

---
