# GJU-reserve

광주대학교 사진영상미디어학과용 모바일 우선 예약 시스템입니다.

## Run

```bash
npm run dev
```

Dev URL:

```text
http://localhost:5173
```

Development admin account:

```text
ID: admin
PW: admin
```

Local development uses `server.mjs` and a file DB; production uses the Cloudflare Worker in `worker.mjs`. Both are thin adapters over the shared application core in `core.mjs` (routes, validation, data model), so dev and production behave identically.

## Current Features

- Student signup request
- Admin login
- Admin student approval/reject/block
- Approved student reservation
- Equipment reservation with admin approval
- Studio reservation with automatic confirmation
- Darkroom reservation with automatic confirmation
- Print room reservation with automatic confirmation
- Studio report submission
- Notices
- Admin equipment add/deactivate
- CSV equipment import
- Slack notification hook through `SLACK_WEBHOOK_URL`
- Local file DB at `data/db.json`
- Cloudflare Worker API backend with Durable Object storage
- Dothome static frontend support through `public/config.js`

## Environment

```text
PORT=5173
ADMIN_PASSWORD=change-this
SLACK_WEBHOOK_URL=rotated-slack-webhook-url
```

Do not commit `.env`, Slack webhook URLs, FTP passwords, or production admin passwords.

## Production Architecture

Production is split into two simple pieces:

```text
Dothome static hosting
  - https://photographygju.dothome.co.kr/
  - serves index.html, styles.css, app.js, config.js, js/*
  - serves /api/* through the PHP proxy in public/api/

Cloudflare Worker
  - https://photographygju-reserve.taejunyun.workers.dev
  - serves /api/*
  - stores data in one Durable Object: GJU_RESERVE_DB
  - sends Slack notifications through SLACK_WEBHOOK_URL
```

`public/config.js` keeps API calls same-origin. On Dothome, `/api/*` is proxied to the Worker by `public/api/index.php`, so browsers only call `https://photographygju.dothome.co.kr/api/*`.

## Cloudflare Deploy

The connected Cloudflare project deploys through Workers with:

```text
Deploy command: npx wrangler deploy
Assets directory: public
```

`wrangler.jsonc` uses:

- `main: ./worker.mjs`
- `assets.binding: ASSETS`
- `assets.run_worker_first: ["/api/*"]`
- `durable_objects.bindings[0].name: GJU_RESERVE_DB`
- `migrations[0].new_sqlite_classes: ["GjuReserveDb"]`

Set the Slack webhook as a Worker secret before production use:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put INTERNAL_CRON_SECRET
npx wrangler secret put SLACK_WEBHOOK_URL
```

The production database is never reset in place (guardrail). There is no
reset endpoint; `INTERNAL_CRON_SECRET` only guards the retention-cleanup cron.
During the Durable Object SQLite migration, the legacy Durable Object `db`
snapshot is copied into SQL only when SQL is empty and is preserved for manual
recovery during App Review.

Then deploy:

```bash
npm run deploy
```

## Dothome Upload

Upload the built `dist/` files to the Dothome webroot:

```text
index.html
styles.css
app.js
config.js
js/*
api/.htaccess
api/index.php
```

The Dothome host serves the frontend and a small PHP API proxy. The proxy requires PHP cURL and Apache `.htaccess` rewrite support. Do not upload `.env`, `data/`, `References/`, or any credential files.

Or use the upload script without committing credentials:

```bash
export DOTHOME_FTP_HOST="112.175.185.143"
export DOTHOME_FTP_USER="photographygju"
export DOTHOME_FTP_PASSWORD="..."
export DOTHOME_FTP_SCHEME="ftps"
npm run upload:dothome
```

The upload script runs `npm run build` and uploads every file under `dist/`, including nested frontend modules. It refuses plaintext `ftp`; use `ftps` or `sftp`.

If this project is later moved to Cloudflare Pages instead of Workers, use:

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

## Notes

- This dev build uses a local JSON database so it can run without external services.
- The production Worker uses Durable Object storage so the small reservation service does not need a separate DB subscription.
- `data/` is ignored by git.
- FTP credentials are not needed for local development and must not be stored in this repo.
- A backend/API is required because signup approval, reservations, admin actions, database writes, and Slack notifications need server-side logic.
- Dothome FTP-only static hosting can host the frontend, but cannot run the API by itself.
- The frontend entry remains `public/app.js`, but the implementation is split under `public/js/` for maintainability.
