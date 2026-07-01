# GJU-reserve Production Guide

This guide defines the production approach for GJU-reserve, a small mobile-first reservation service for Gwangju University Department of Photography & Visual Media.

## Project Scope

GJU-reserve handles:

- Student signup and admin approval
- Equipment reservations with admin approval
- Studio reservations with automatic confirmation
- Darkroom reservations with automatic confirmation
- Print room reservations with automatic confirmation
- Studio usage reports
- Notices
- Admin management
- Slack notifications to `#예약_현황automatic`

The expected user count is about 100 people, so the system should stay simple and low-cost.

Detailed reservation references:

- Equipment and darkroom rules: `docs/equipment-darkroom-reference.md`
- Equipment import CSV template: `docs/equipment-import-template.csv`

## Recommended Stack

Use the smallest practical stack:

- Frontend: React, Vite, TypeScript
- UI: Tailwind CSS, shadcn/ui, lucide-react
- Runtime/API: Cloudflare Pages Functions or Cloudflare Workers
- Database: Cloudflare D1
- File/object storage: Cloudflare R2 only when archive images or report attachments are needed
- Hosting/deploy: Cloudflare Pages
- Repository and deploy source: GitHub
- Notifications: Slack Incoming Webhook
- Authentication: custom email/password login with admin approval

Avoid external services unless a real need appears:

- Do not use Clerk for auth.
- Do not use Supabase or Firebase for DB.
- Do not use Zapier for Slack.
- Do not use Vercel if Cloudflare Pages is already available.
- Do not use a separate CMS for notices at first.

## Cloudflare Architecture

Use one codebase.

```text
/
  Student mobile app

/admin
  Admin app for assistants

/api/*
  Pages Functions or Worker routes
```

Cloudflare products:

- Cloudflare Pages: deploy the full-stack app to Cloudflare's network.
- Pages Functions / Workers: server-side routes for auth, reservations, admin actions, Slack posting, cleanup jobs.
- D1: relational data such as users, reservations, equipment, notices, warnings, reports.
- R2: unstructured files such as archive images, optional report attachments, and exported HTML snapshots.
- Secrets: `SESSION_SECRET`, `SLACK_WEBHOOK_URL`, optional admin bootstrap secret.
- Cron Triggers: scheduled cleanup for 3-month reservation retention and 6-month report HTML deletion.

References:

- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Domains

Preferred:

```text
https://gjupreserve.com/
https://gjupreserve.com/admin
```

Fallback while DNS/custom domain propagation is pending:

```text
https://gju-reserve.pages.dev/
https://gju-reserve.pages.dev/admin
```

Keep Dothome only as a rollback path after the Cloudflare Pages frontend is stable.

## Environment Variables And Secrets

Never commit real secrets.

Required secrets:

```text
SESSION_SECRET
SLACK_WEBHOOK_URL
ADMIN_BOOTSTRAP_TOKEN
```

Required public/config values:

```text
PUBLIC_APP_NAME=GJU-reserve
PUBLIC_DEPARTMENT_NAME=광주대학교 사진영상미디어학과
PUBLIC_STUDENT_URL=https://gjupreserve.com
PUBLIC_ADMIN_URL=https://gjupreserve.com
```

Slack webhook URLs must be rotated if they are ever shared in chat, source code, screenshots, or public documents.

## Database Guide

Use D1 as the source of truth. Keep the schema normalized enough for admin operations, but avoid over-engineering.

Core tables:

```text
users
sessions
reservation_common
equipment_reservations
equipment_reservation_items
equipment_import_batches
equipment_import_rows
studio_reservations
studio_reports
darkroom_reservations
darkroom_reservation_supplies
print_reservations
equipment_items
equipment_categories
equipment_facilities
notices
warnings
blocked_dates
blocked_time_rules
settings
admin_audit_logs
slack_logs
```

Database rules:

- During the current Durable Object SQLite migration, preserve the legacy Durable Object `db` snapshot. Copy it into SQL only when SQL is empty, and do not delete it automatically during App Review.
- Every table needs `id`, `created_at`, and `updated_at`.
- Store all dates in ISO format.
- Store user-facing dates in Asia/Seoul at rendering time.
- Keep phone numbers in DB, but mask them in Slack.
- Store reservation changes in audit logs.
- Do not delete student accounts automatically unless explicitly requested.
- Delete or anonymize old reservation personal data after 3 months.
- Delete studio report HTML after 6 months, but keep report existence/status.

Indexes to add early:

```sql
CREATE INDEX idx_users_status ON users(approval_status);
CREATE INDEX idx_reservation_common_user ON reservation_common(user_id);
CREATE INDEX idx_reservation_common_type_date ON reservation_common(type, reserved_date);
CREATE INDEX idx_equipment_items_status ON equipment_items(status);
CREATE INDEX idx_studio_reservations_date_space ON studio_reservations(reserved_date, studio_space);
CREATE INDEX idx_notices_status_pinned ON notices(status, pinned);
```

Reservation conflict checks must run inside the API before insert/update:

- Studio: same space and same slot cannot overlap.
- Darkroom: max 5 users per time slot.
- Equipment: selected equipment item cannot be reserved/loaned in overlapping period.
- Print room: only allow usage during valid hours.

Equipment admin rules:

- Admins must be able to add, edit, deactivate, and restore equipment.
- Physical items should be managed individually when a quantity is known.
- Equipment deletion should be soft deletion by default so past reservations remain readable.
- Excel/CSV import must support preview, validation, duplicate detection, and rollback by import batch.
- 판타지랩 equipment is inquiry-only by default and should not be reservable through the main reservation flow unless an admin explicitly changes it.

## API Route Guide

Use small domain-focused routes.

```text
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me

GET    /api/notices
POST   /api/admin/notices
PATCH  /api/admin/notices/:id

POST   /api/reservations/equipment
POST   /api/reservations/studio
POST   /api/reservations/darkroom
POST   /api/reservations/print
GET    /api/my/reservations
PATCH  /api/my/reservations/:id
POST   /api/my/reservations/:id/cancel

GET    /api/admin/reservations
PATCH  /api/admin/reservations/:id/status
POST   /api/admin/reservations/:id/warning

POST   /api/reports/studio
GET    /api/admin/reports/studio

GET    /api/admin/users/pending
PATCH  /api/admin/users/:id/approval

GET    /api/admin/equipment
POST   /api/admin/equipment
PATCH  /api/admin/equipment/:id

POST   /api/admin/settings/blocked-dates
POST   /api/admin/settings/semester
```

API rules:

- Validate every request body with a schema library such as Zod.
- Return consistent JSON: `{ ok, data, error }`.
- Use HTTP-only secure cookies for sessions.
- All admin APIs must require admin role.
- All reservation APIs must require an approved user.
- Approval-pending users can read notices but cannot reserve.
- Every admin action must write to `admin_audit_logs`.

## Slack Integration Guide

Use one Slack channel only:

```text
#예약_현황automatic
```

Use Incoming Webhooks. Slack webhooks accept JSON payloads and can use text and Block Kit. The webhook URL is a secret and must not be shared.

Reference:

- Slack Incoming Webhooks: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/

Events to send:

```text
[학생 가입 승인 요청]
[기자재 예약 승인 요청]
[기자재 예약 승인 완료]
[기자재 대여 완료]
[기자재 반납 완료]
[스튜디오 예약 확정]
[스튜디오 보고서 제출]
[출력실 예약 확정]
[암실 예약 확정]
[예약 수정]
[예약 취소]
[경고 등록]
```

Slack privacy rule:

- Show name.
- Mask phone number: `010-****-1234`.
- Include admin detail link.
- Do not include full student ID unless necessary.
- Do not include uploaded file URLs if files are private.

Example:

```text
[기자재 예약 승인 요청]
예약자: 김현석 / 010-****-6412
신분: 재학생
대여일: 2026-06-15 12:00
반납예정: 2026-06-16 17:30
품목: SONY-A7M3-01, LEN-SONY-2470GM-01
상태: 승인 대기
상세: https://gjupreserve.com/reservations/123
```

Slack delivery rules:

- Store every send attempt in `slack_logs`.
- Do not block reservation creation if Slack fails.
- If Slack fails, mark `slack_status=failed` and show retry button in admin.
- Treat HTTP 200 with body `ok` as success.
- Do not retry malformed payload errors without fixing the payload.

## Web UI Guide

Design direction:

- Notion-inspired, not a direct clone.
- Mobile-first for students.
- Desktop-first but responsive for admin.
- Black/white base with blue accent.
- Cards on mobile, tables in admin.
- One primary action per screen.

Student mobile navigation:

```text
Home
Reserve
My Reservations
Notices
My
```

Admin navigation:

```text
Dashboard
Student Approval
Reservations
Equipment
Spaces
Reports
Notices
Warnings
Settings
```

Notion-style detail page pattern:

```text
Title
Status chip

Property list
- Type
- Date
- Time
- User
- Phone
- Status
- Report status

Body
- Rules
- Admin memo
- History
```

Status chips:

```text
approval_pending: yellow
auto_confirmed: blue
approved: green
rejected: red
cancelled: gray
checked_out: purple
returned: green
report_required: orange
blocked: red
```

## Performance Guide

Primary targets:

- Mobile first load should feel immediate.
- Avoid large JavaScript bundles.
- Avoid heavy editors in the first version.
- Admin tables should paginate and filter server-side.
- API responses should be small and purpose-specific.

Frontend:

- Use route-based code splitting.
- Lazy-load admin-only screens.
- Avoid loading R2 images at original size.
- Use skeleton states for reservation lists.
- Keep each mobile reservation flow as 3-5 steps.
- Avoid client-side fetching of huge tables.

Backend:

- Query only needed columns.
- Add indexes for date/status/type filters.
- Use pagination for admin lists.
- Use transactions or careful checks for reservation conflict handling.
- Cache public notices for a short period if needed.
- Do not call Slack before DB commit; commit first, notify second.

R2:

- Use R2 only for files.
- Store metadata in D1.
- Use signed/private access for non-public files.
- Keep archive media optimized before upload.

## Deployment Guide

Branch policy:

```text
main = production
feature/* = local or preview
```

Cloudflare Pages build:

```text
npm ci
npm run build
```

Recommended scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:migrate:local": "wrangler d1 migrations apply gju_reserve --local",
    "db:migrate:prod": "wrangler d1 migrations apply gju_reserve --remote"
  }
}
```

Deploy checklist:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- D1 migrations applied
- Required secrets configured
- Slack test message sent
- Admin login verified
- Student signup verified
- One reservation per type tested
- Mobile viewport checked
- Admin desktop viewport checked

Rollback:

- Use Cloudflare Pages rollback for frontend/API deployment.
- Use D1 Time Travel for database recovery when needed.
- Keep migrations small and reversible where practical.

## Testing Guide

Minimum automated tests:

- Signup validation
- Login/session validation
- Approved user can reserve
- Pending user cannot reserve
- Equipment conflict detection
- Studio conflict detection
- Darkroom capacity limit
- Print room valid-hour check
- Slack payload formatting
- Admin approval flow

Manual browser checks:

- iPhone-size viewport: signup, login, reserve each type, cancel, report submit
- Desktop admin: pending users, equipment approval, reservation table, settings
- Slack channel receives correct masked messages

## Security Guide

Required:

- Passwords must be hashed.
- Sessions must use secure HTTP-only cookies.
- CSRF protection or same-site strict cookies for state-changing routes.
- Admin routes must check server-side role.
- Rate-limit login/signup attempts where possible.
- Never store secrets in source code.
- Mask personal data in Slack.
- Audit admin actions.

Admin bootstrap:

- Create first admin with a one-time bootstrap endpoint or local D1 seed.
- Disable or protect bootstrap after creation.

## Data Retention Guide

Retention:

```text
Reservations: keep operational record for 3 months, then delete or anonymize personal fields.
Warnings: keep 3 months unless the semester policy needs longer.
Studio report HTML: delete after 6 months.
Student accounts: keep active unless admin deletes/deactivates.
Slack logs: keep 3 months.
Admin audit logs: keep at least 6 months if storage remains small.
```

Cleanup job:

- Run daily using Cron Trigger.
- Use UTC cron, but calculate retention based on Asia/Seoul dates.
- Log cleanup counts.
- Do not delete active users automatically.

## What Not To Build Yet

Avoid these until core operation is stable:

- Slack interactive approve/reject buttons
- Full Notion-like block editor
- External OAuth login
- Complex analytics dashboard
- Real-time sync
- Multi-tenant architecture
- Separate CMS

## Final Production Checklist

- Domain connected
- HTTPS active
- D1 created and migrated
- R2 bucket created if files are enabled
- Secrets configured
- Slack webhook rotated and stored as secret
- Admin account created
- Student signup works
- Admin approval works
- Equipment approval works
- Studio report works
- Cron cleanup tested locally and deployed
- Mobile UI checked
- Admin desktop UI checked
- Backup/rollback procedure documented
