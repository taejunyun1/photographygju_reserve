# GJU-reserve

광주대학교 사진영상미디어학과용 모바일 우선 예약 시스템 프로토타입입니다.

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

Production must set a different admin password with `ADMIN_PASSWORD`.

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

## Environment

```text
PORT=5173
ADMIN_PASSWORD=change-this
SLACK_WEBHOOK_URL=rotated-slack-webhook-url
```

Do not commit `.env`, Slack webhook URLs, FTP passwords, or production admin passwords.

## Cloudflare Pages

Use these settings when connecting this repository to Cloudflare Pages:

```text
Build command: npm run build
Build output directory: dist
Root directory: /
```

`public/_redirects` keeps `/admin` and other SPA routes loading `index.html`.

## Notes

- This dev build uses a local JSON database so it can run without external services.
- The API boundaries are shaped so the storage layer can later move to Cloudflare D1.
- `data/` is ignored by git.
- FTP credentials are not needed for local development and must not be stored in this repo.
- A backend/API is required for the real product because signup approval, reservations, admin actions, database writes, and Slack notifications need server-side logic.
- For production, use Cloudflare Pages Functions or Workers with D1 instead of a separate VPS/server.
- Dothome FTP-only static hosting can host static files, but cannot run this full reservation product unless a separate backend is added.
