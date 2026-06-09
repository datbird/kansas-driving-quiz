# Kansas Driving Practice — Quiz SPA

A small, mobile-first single-page app for practicing the Kansas driving knowledge test.

## Features
- **Random practice tests** — each "Take a Practice Test" builds a **fresh, random
  25-question exam** by sampling a per-category quota (every topic represented; signs/
  signals/rules weighted higher), graded instantly with full answer review.
- **Road-sign questions with real images** — picture "what does this sign mean?" questions
  using the official public-domain MUTCD signs (38 signs), woven into every test.
- **Dedicated road-signs drill** — a focused 20-question sign-only quiz; it's a study aid,
  so it is **not** counted toward tracked scores.
- **Study guide** — the full guide rendered in-app, plus a downloadable PDF, including a
  visual **Road Sign Gallery**.
- **Per-user history + run review** — tap any of the last 10 runs to see every question,
  the answer given, and the correct answer.
- **Admin dashboard** — admins (see `ADMIN_EMAILS`) see every account's test counts and
  scores, and can open any run for review.
- **Official test link** — links out to `ks.knowtodrive.com`, the Kansas Dept. of Revenue's
  at-home knowledge exam.
- **Installable PWA** — add to home screen for a full-screen, app-like experience with a
  bottom tab bar and large touch targets.

## How it's built
- **Backend:** Node + Express, single file (`server.js`)
- **Data:** one local **SQLite** file (`/data/quiz.db`) — no external database
- **Auth:** identity comes from **Cloudflare Access** via the
  `Cf-Access-Authenticated-User-Email` request header. The app stores no passwords.
- **Admin:** the email(s) listed in `ADMIN_EMAILS` can see every account's runs and scores.

## API
| method + path | purpose |
|---|---|
| `GET /api/me` | current user `{email,name,role}` |
| `GET /api/stats` | the user's run count / best / avg / passes |
| `GET /api/practice` | generate a fresh random 25-question test |
| `GET /api/signs` | generate a 20-question road-signs-only drill |
| `POST /api/practice/submit` | grade a submission, return review; `record:false` skips recording (used by the signs drill) |
| `GET /api/history` | the user's runs |
| `GET /api/run/:id` | one run's full detail (own runs only; admins, any) |
| `GET /api/admin/overview` | per-user stats (admin) |
| `GET /api/admin/user/:email/runs` | a user's runs (admin) |
| `GET /healthz` | health probe (no auth) |

## Question content
`data/questions.json` (text + image questions across 19 topics) is generated from the
study-material question bank; `seed.js` loads it into SQLite on startup (re-seeding never
deletes users or run history). Tests are **not** fixed — `server.js` builds each test on
demand by randomly sampling the per-category `QUOTA` (sums to 25). `data/tests.json` is
retained only for the matching printable PDF set and is unused by the app.

### Sign images
Sign-identification questions reference images under `public/signs/` via an `image` field on
the question, and the same images appear in a **Road Sign Gallery** in the study guide
(in-site and PDF). The signs are the **official public-domain MUTCD artwork** (U.S. Government
works, sourced from Wikimedia Commons); see `public/signs/README.md` for details. To
customize, drop your own PNGs into `public/signs/` using the same filenames. Do **not** copy
sign images from commercial practice-test sites; their image files are copyrighted.

## Run locally (no Cloudflare)
```sh
npm install
DEV_EMAIL=you@example.com npm start    # http://localhost:8080
```
`DEV_EMAIL` simulates the Access header so you can test without a tunnel. In production
this variable is unset and the app refuses requests that arrive without an Access header.

## Docker
```sh
docker build -t ks-quiz .
docker run -d --name ks-quiz \
  -p 127.0.0.1:8080:8080 \
  -v /path/to/appdata/ks-quiz:/data \
  -e ADMIN_EMAILS=you@example.com \
  ks-quiz
```
Bind to `127.0.0.1` so the container is reachable only by the local Cloudflare Tunnel.

## Deployment shape
```
Browser → Cloudflare Access (email OTP) → Cloudflare Tunnel → container :8080 (localhost)
                                   header: Cf-Access-Authenticated-User-Email
```
The Access application restricts the app to the allowed emails and injects the verified
address; the container trusts that header. The tunnel hostname, Access policy, tunnel
token, and any other operational details live outside this repository.

## Environment variables
| var | default | meaning |
|-----|---------|---------|
| `PORT` | `8080` | listen port |
| `HOST` | `0.0.0.0` | listen address |
| `DB_PATH` | `/data/quiz.db` | SQLite file location |
| `ADMIN_EMAILS` | _(unset)_ | comma-separated admin emails (e.g. `you@example.com`) |
| `SEED_USERS` | _(unset)_ | optional JSON array of initial users to pre-name, e.g. `[{"email":"alex@example.com","name":"Alex","role":"admin"}]` |
| `DEV_EMAIL` | _(unset)_ | local-only identity override; leave unset in production |
