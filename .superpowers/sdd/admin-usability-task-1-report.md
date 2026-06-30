# Admin Usability Task 1 Report

Date: 2026-07-01
Task: Academic Semester Filtering Backend

## Scope

- `core/academic-semester.mjs`
- `core/admin-lists.mjs`
- `core.mjs`
- `scripts/security-smoke-test.mjs`

## Requirements Source

- `/Users/taejun-yun/Desktop/WEB_data/school_reservation/.superpowers/sdd/admin-usability-task-1-brief.md`

## TDD Evidence

### RED

1. Added the semester filtering smoke tests in `scripts/security-smoke-test.mjs` using the exact fixture values and assertions from the brief.
2. Ran:

```bash
npm run test:security
```

3. Result: FAIL as expected before implementation.

Relevant failure:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

true !== false

at scripts/security-smoke-test.mjs:328:8
```

Interpretation: `/api/admin/reservations?semester=2026-S2` still included `res_semester_s1`, proving the `semester` query was ignored before implementation.

### GREEN

Implemented:

- `dateToAcademicSemesterKey`
- `academicSemesterLabel`
- `dateMatchesAcademicSemester`
- `academicSemesterOptionsFromDates`
- `adminLectureList`
- semester-aware list filtering and metadata for reservations, reports, and lectures
- lecture route list/query branch in `core.mjs`

Ran:

```bash
npm run test:security
```

Result:

```text
security smoke test passed
```

## Syntax Verification

Ran:

```bash
npm run check
```

Result: PASS

## Commands Run

```bash
sed -n '1,260p' /Users/taejun-yun/Desktop/WEB_data/school_reservation/.superpowers/sdd/admin-usability-task-1-brief.md
sed -n '1,260p' core/admin-lists.mjs
sed -n '1,320p' core.mjs
sed -n '1,320p' scripts/security-smoke-test.mjs
rg -n "lectureDetail|/api/admin/lectures|createAdminListHelpers|hasListQuery" core.mjs core/admin-lists.mjs scripts/security-smoke-test.mjs
sed -n '1180,1310p' core.mjs
sed -n '2108,2150p' core.mjs
npm run test:security
npm run test:security
npm run check
git diff -- core/academic-semester.mjs core/admin-lists.mjs core.mjs scripts/security-smoke-test.mjs
git status --short
```

## Changed Files

- `/Users/taejun-yun/Desktop/WEB_data/school_reservation/core/academic-semester.mjs`
- `/Users/taejun-yun/Desktop/WEB_data/school_reservation/core/admin-lists.mjs`
- `/Users/taejun-yun/Desktop/WEB_data/school_reservation/core.mjs`
- `/Users/taejun-yun/Desktop/WEB_data/school_reservation/scripts/security-smoke-test.mjs`

## Self-Review

- Kept the change within the four files assigned by the brief.
- Used the semester key rules and labels exactly as specified.
- Preserved the legacy non-query admin list responses.
- Added semester option metadata from the full source set before filtering, matching the brief.
- Left database data shape and stored records untouched; no migration or deletion logic was introduced.

## Concerns

- None at implementation time. The helper exports `academicSemesterRange` exactly as specified in the brief even though this task does not currently consume it.

## Follow-up Fix

Date: 2026-07-01

Addressed the review notes by extending `scripts/security-smoke-test.mjs` only:

- Added a negative assertion for `/api/admin/reports?semester=2026-S2` to prove non-matching semester reports are filtered out, matching the existing reservation and lecture coverage pattern.
- Added a focused leap-year assertion that `dateToAcademicSemesterKey("2028-02-29")` returns `2027-S2`.

Verification:

```bash
npm run test:security
```

Result: PASS
