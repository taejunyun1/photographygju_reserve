# Server Requirement Note

GJU-reserve needs server-side logic for the actual product.

## Why A Server/API Is Needed

Static HTML alone can show screens, but it cannot safely handle:

- Student signup
- Password hashing
- Login sessions
- Admin approval
- Reservation conflict checks
- Equipment status changes
- Studio report storage
- Slack webhook calls
- Data retention cleanup

## Recommended Production Answer

Use serverless Cloudflare services instead of managing a traditional server.

```text
Frontend: Cloudflare Pages
API: Cloudflare Pages Functions or Workers
DB: Cloudflare D1
Files: Cloudflare R2 when needed
Secrets: Cloudflare Secrets
Cron cleanup: Cloudflare Cron Triggers
```

This means there is no separate VPS to manage, but there is still backend logic.

## Dothome FTP Limitation

Dothome FTP-only deployment is not enough for the full system if it only serves static files.

FTP can be used only for:

- Static landing page
- Static prototype
- Redirect page

FTP cannot by itself provide:

- API routes
- DB writes
- Sessions
- Slack notifications
- Admin workflows

If the final domain must remain:

```text
https://gjupreserve.com/
```

then configure DNS or routing so the domain points to Cloudflare Pages/Workers. If that is not possible, use:

```text
https://gjupreserve.com/admin
```

only as a static shell while API calls go to a Cloudflare Worker subdomain.

## Current Local Dev Server

The current `server.mjs` is a development backend (a thin adapter over `core.mjs`):

- serves `public/`
- stores data in `data/db.json`
- exposes reservation/admin APIs
- sends Slack if `SLACK_WEBHOOK_URL` exists

It is useful for local testing, but production should move the data layer to D1.
