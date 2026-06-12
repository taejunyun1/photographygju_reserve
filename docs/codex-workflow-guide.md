# Codex Workflow Guide For GJU-reserve

This guide adapts the useful ideas from public Codex subagent and skill collections into a practical project workflow for GJU-reserve.

References:

- VoltAgent awesome-codex-subagents: https://github.com/VoltAgent/awesome-codex-subagents
- ComposioHQ awesome-codex-skills: https://github.com/ComposioHQ/awesome-codex-skills

## Principle

Do not install a large agent/skill framework for this project.

Instead, use the idea behind those repositories:

- Split work by role.
- Keep each role's checklist clear.
- Verify every change with tests or manual browser checks.
- Keep secrets out of files.
- Treat deploy, DB, performance, and Slack as separate review gates.

## Project Roles

Use these roles when planning or reviewing work.

### 1. Product And UX Lead

Responsible for:

- Mobile-first student flows
- Notion-inspired visual structure
- Reservation step logic
- Empty states and error states
- Admin desktop usability

Checklist:

- Can a student make a reservation from a phone without reading long instructions?
- Does each screen have one main action?
- Are approval and blocked states obvious?
- Are reservation rules visible before submission?
- Are phone numbers and personal information not overexposed?

### 2. Frontend Developer

Responsible for:

- React/Vite/TypeScript app
- Tailwind and shadcn/ui components
- Student mobile pages
- Admin desktop pages

Checklist:

- Shared layout components exist for mobile and admin.
- Forms use schema validation.
- Loading, empty, success, and error states exist.
- Tables are not used on narrow mobile screens.
- Admin tables support filtering by type/date/status.

### 3. Backend/API Developer

Responsible for:

- Cloudflare Functions/Workers API
- Auth/session handling
- Reservation conflict logic
- Admin authorization
- Slack event dispatch

Checklist:

- API validates all input.
- Admin-only routes check role server-side.
- Pending users cannot reserve.
- Reservation conflicts are checked before commit.
- Slack notification happens after DB write.
- Slack failure does not break the reservation.

### 4. Database Owner

Responsible for:

- D1 schema
- migrations
- indexes
- retention cleanup
- seed data

Checklist:

- Every table has timestamps.
- Important filters have indexes.
- Equipment is tracked as individual items.
- Reservation edits preserve audit logs.
- Cleanup jobs do not delete active users unexpectedly.
- Migrations are applied locally before remote.

### 5. Deployment Engineer

Responsible for:

- Cloudflare Pages setup
- D1/R2 bindings
- environment variables
- secrets
- production deploy checklist
- rollback readiness

Checklist:

- `main` deploys to production.
- Build command is stable.
- Required secrets are configured.
- D1 binding works in production.
- Slack test message succeeds.
- Rollback path is known.

### 6. Performance Engineer

Responsible for:

- bundle size
- slow API queries
- image loading
- mobile responsiveness
- admin table performance

Checklist:

- First mobile page is small.
- Admin screens are lazy-loaded.
- Lists are paginated.
- D1 queries use indexes.
- R2 images are optimized or constrained.
- No heavy editor is shipped unless needed.

### 7. Slack Integration Owner

Responsible for:

- Slack payload templates
- masked personal data
- webhook secret handling
- retry logging

Checklist:

- Webhook URL is only in Cloudflare Secret.
- Phone numbers are masked.
- Messages include admin links.
- Message types are visually distinguishable.
- Failed sends are logged and retryable.

### 8. QA Reviewer

Responsible for:

- regression tests
- mobile manual checks
- admin manual checks
- reservation edge cases

Checklist:

- Pending user cannot reserve.
- Approved user can reserve.
- Equipment overlap is blocked.
- Studio overlap is blocked.
- Darkroom capacity limit works.
- Print room invalid time is blocked.
- Admin can approve/reject/cancel.
- Slack receives expected messages.

## 7-Day Execution Plan

### Day 1: Foundation

- Create React/Vite/TypeScript project.
- Add Tailwind, shadcn/ui, lucide-react.
- Configure Cloudflare Pages/Functions structure.
- Create D1 schema and first migration.
- Implement auth tables and session helper.
- Build signup/login screens.

Exit criteria:

- User can sign up.
- Admin can log in.
- D1 local migration works.

### Day 2: Admin Approval And Core Layout

- Student approval flow.
- Student mobile tab layout.
- Admin desktop shell.
- Common reservation data model.
- Notice read screen.

Exit criteria:

- Pending users can browse but cannot reserve.
- Admin can approve a student.

### Day 3: Equipment

- Equipment item model with individual codes.
- Equipment reservation form.
- Conflict detection.
- Admin approval/reject flow.
- Slack equipment notification.

Exit criteria:

- Equipment reservation enters approval pending state.
- Admin approval updates status.
- Slack receives masked message.

### Day 4: Studio

- Studio reservation form.
- Studio conflict detection.
- Automatic confirmation.
- Studio report submission.
- Report HTML snapshot save.
- Slack studio/report notification.

Exit criteria:

- Student can reserve studio.
- Student can submit report after use.
- Admin can view report.

### Day 5: Print Room And Darkroom

- Print room reservation.
- Darkroom reservation.
- Darkroom capacity limit.
- Admin views for both.
- Slack notifications.

Exit criteria:

- All four reservation types work.
- Invalid time/capacity rules are enforced.

### Day 6: Notices, Settings, Retention

- Notice CRUD.
- Blocked dates/settings.
- Vacation mode settings.
- Warning/blocked-user management.
- Cron cleanup handler.

Exit criteria:

- Admin can manage notices and settings.
- Cleanup job can run locally.

### Day 7: Hardening And Deploy

- Mobile polish.
- Admin table polish.
- Test pass.
- Slack webhook rotation.
- Production secrets.
- Cloudflare deploy.
- Smoke test.

Exit criteria:

- Production URL works.
- Admin URL works.
- Slack works.
- Four reservation flows work on mobile.

## Review Gates

Before merging:

- Typecheck passes.
- Lint passes.
- Build passes.
- Core tests pass.
- No secrets in git diff.
- No full phone numbers in Slack payload snapshots.
- DB migration has rollback notes or is trivially reversible.

Before production deploy:

- D1 migration applied.
- Secrets configured.
- Admin account exists.
- Slack webhook rotated.
- One reservation per type tested.
- Studio report tested.
- Cleanup job tested locally.

## Prompting Pattern For Codex

Use role-specific prompts during implementation.

Examples:

```text
Act as the Database Owner. Review the D1 schema for reservation conflicts, indexes, retention cleanup, and audit logging.
```

```text
Act as the Slack Integration Owner. Check that all Slack payloads mask personal data, include admin links, and degrade safely on webhook failure.
```

```text
Act as the Performance Engineer. Audit the mobile bundle, route splitting, D1 query patterns, and admin list pagination.
```

```text
Act as the QA Reviewer. Create a smoke test checklist for signup, approval, each reservation type, Slack, and admin workflows.
```

## Project-Specific Non-Negotiables

- Mobile student UX is the primary product.
- Admin can be desktop-first.
- Keep services minimal.
- Keep Slack simple: one channel, no interactive buttons in the first version.
- Do not expose webhook URLs.
- Do not expose full phone numbers in Slack.
- Do not build a Notion clone editor.
- Use Notion-inspired layout patterns only.
- Preserve reservation edit history.
- Prefer simple text fields when structured fields do not improve operations.

