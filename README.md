# Kansas Driving Practice — Quiz SPA

A small single-page app for practicing the Kansas driving knowledge test. Each "Take a
Practice Test" generates a **fresh, random 25-question test** — pulled with a per-category
quota so every topic is represented (signs/signals/rules weighted higher) — then grades it
instantly with answer review. Per-user history, plus an admin dashboard showing everyone's
test counts and scores.

- **Backend:** Node + Express, single file (`server.js`)
- **Data:** one local **SQLite** file (`/data/quiz.db`) — no external database
- **Auth:** identity comes from **Cloudflare Access** via the
  `Cf-Access-Authenticated-User-Email` request header. The app stores no passwords.
- **Admin:** the email(s) listed in `ADMIN_EMAILS` can see every account's runs and scores.

## Question content
`data/questions.json` (text + image questions across 19 topics) is generated from the
study-material question bank; `seed.js` loads it into SQLite on startup (re-seeding never
deletes users or run history). Tests are **not** fixed — `server.js` builds each test on
demand by randomly sampling the per-category `QUOTA` (sums to 25). `data/tests.json` is
retained only for the matching printable PDF set and is unused by the app.

### Sign images
Sign-identification questions reference images under `public/signs/` via an `image` field on
the question, and the same images appear in a **Road Sign Gallery** in the study guide
(in-site and PDF). The images are **original renderings** of the public-domain MUTCD sign
designs, released **CC0 / public domain** (see `public/signs/README.md`) — reusable with no
attribution. Regenerate or restyle them with `tools/render_signs.py` (Python + Pillow), or
drop your own PNGs into `public/signs/` using the same filenames. Do **not** copy sign images
from commercial practice-test sites; their image files are copyrighted.

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
