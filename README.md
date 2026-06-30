# BrightKids

> A kid-friendly web app that teaches **Hebrew**, **English**, and **Math** to children in **grades 1–6** — shipped as a single Go binary serving an embedded, offline-capable PWA.

BrightKids is audio-first, mobile-first, and zero-PII: profiles are just a name and a buddy a child picks, stored locally. No accounts, no tracking, no external calls from the child's device. A friendly droid guide named **Bibo** narrates prompts and cheers every correct answer.

<p align="center">
  <img src="assets/screenshots/start.png" alt="BrightKids start screen with Bibo the droid" width="280" />
</p>

---

## Features

- **Trilingual content** — Hebrew (RTL, grades 1–5), English (LTR, grades 1–4), and Math (grades 1–6), with proper BiDi isolation for mixed Hebrew/digit text.
- **Seven activity types** — letter recognition, multiple choice, counting, arithmetic, matching, drag-to-order, and finger **tracing** (canvas with mask-coverage scoring).
- **Curriculum-based exercises** — built from a real graded worksheet curriculum. Math (g1–6) spans counting, comparison ("Who is bigger?"), number sense, place value, the four operations, sequences, even/odd, fractions, decimals, order of operations, rounding, word problems, and clock reading. Hebrew (g1–5) covers vowels, reading comprehension, synonyms/opposites, verbs, and sentence ordering; English (g1–4) covers ABC, phonics, word families, and graded reading. Math & Hebrew narrate in Hebrew; English in English.
- **Randomized practice** — pick a subject then a grade; every lesson holds a large pool and samples a fresh set each play, with a **shuffle** button to redraw for endless variety.
- **Audio-first** — tap-to-hear narration on every prompt via the Web Speech API (he-IL / en-US), so pre-readers can play. Narration is on-demand (no auto-play), so the screen stays calm.
- **Playful rewards** — confetti, synthesized sound effects, Bibo reactions, stars, and a daily streak. Mistakes get a gentle "try again," never a shaming buzzer.
- **Accessible** — 48px tap targets, `prefers-reduced-motion` honored, OpenDyslexic toggle, dark mode, high-contrast palette.
- **Installable PWA** — works offline; lessons and assets (including Hebrew fonts) are precached.
- **Single binary** — Go serves the embedded SPA, a small JSON API, Prometheus metrics, and health probes. Pure-Go SQLite (no CGO) for local profiles and progress.
- **Zero PII** — no accounts, no analytics, no per-child identifiers in metrics.

## Screenshots

| Choose a subject | Choose a grade | Lesson list | Stars & streak |
|---|---|---|---|
| ![Subjects](assets/screenshots/subjects.png) | ![Grades](assets/screenshots/grades.png) | ![Lessons](assets/screenshots/lessons.png) | ![Rewards](assets/screenshots/rewards.png) |

| Hear it, pick the letter | Match the pairs | Build a sentence | Trace the letters |
|---|---|---|---|
| ![First sound](assets/screenshots/lesson-letter.png) | ![Matching](assets/screenshots/lesson-match.png) | ![Sentence](assets/screenshots/lesson-sentence.png) | ![Tracing](assets/screenshots/lesson-trace.png) |

| Order of operations | Times tables | Who is bigger? | Word problems |
|---|---|---|---|
| ![Order of operations](assets/screenshots/lesson-math-concept.png) | ![Arithmetic](assets/screenshots/lesson-math-set.png) | ![Compare](assets/screenshots/lesson-compare.png) | ![Word problems](assets/screenshots/lesson-math.png) |

| Settings (parent-gated) | Dark mode | OpenDyslexic |
|---|---|---|
| ![Settings](assets/screenshots/settings.png) | ![Dark mode](assets/screenshots/subjects-dark.png) | ![OpenDyslexic](assets/screenshots/lesson-dyslexic.png) |

## Quick start

### Docker

```bash
docker run -p 8080:8080 techblog/brightkids:latest
# open http://localhost:8080
```

### docker-compose (with persistent profiles)

```bash
docker compose -f deployments/docker-compose.yml up -d
```

The named `brightkids-data` volume holds the SQLite database so profiles and
progress survive restarts. The image runs as a non-root user; use the named
volume (not a host bind mount) so `/data` ownership is correct.

### From source

```bash
make build      # builds the SPA, embeds it, and builds ./brightkids
./brightkids --log-format text --log-level debug
```

### Local development (hot reload)

```bash
# terminal 1 — backend
go run ./cmd/brightkids --log-format text --log-level debug

# terminal 2 — frontend (proxies /api to :8080)
cd web && npm install && npm run dev
```

## Configuration

Precedence: **flags > env > YAML > defaults**. Copy `config.yaml.example` to
`config.yaml` to use a file. Env vars are prefixed `BRIGHTKIDS_`.

| Key | Flag | Env | Default | Notes |
|---|---|---|---|---|
| `mode` | `--mode` | `BRIGHTKIDS_MODE` | `private` | `private` (DB-backed) or `public` (browser-only) — see below |
| `server.host` | `--host` | `BRIGHTKIDS_SERVER_HOST` | `0.0.0.0` | |
| `server.port` | `--port` | `BRIGHTKIDS_SERVER_PORT` | `8080` | |
| `db.path` | `--db-path` | `BRIGHTKIDS_DB_PATH` | `./brightkids.db` | `:memory:` allowed |
| `log.level` | `--log-level` | `BRIGHTKIDS_LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |
| `log.format` | `--log-format` | `BRIGHTKIDS_LOG_FORMAT` | `json` | `text` for dev |
| `content.dir` | `--content-dir` | `BRIGHTKIDS_CONTENT_DIR` | *(embedded)* | hot-iterate lesson YAML |
| `metrics.enabled` | `--metrics` | `BRIGHTKIDS_METRICS_ENABLED` | `true` | |

`--version` prints build info and exits.

### Storage mode: private vs public

The same binary runs two ways, chosen by `mode`:

- **`private`** (default, self-hosted) — child profiles, progress, and settings
  are persisted **server-side** in pure-Go SQLite (`db.path`). Good for a home
  lab or family device where progress should survive across browsers.
- **`public`** — for a stateless public deployment. Profiles, progress, and
  settings live **only in the browser's `localStorage`**; the server opens **no
  database** and exposes no profile endpoints. Each visitor's data stays on
  their own device, so the server holds zero personal data and scales without a
  volume.

```bash
# Public web (no database, profiles in the browser):
docker run -p 8080:8080 -e BRIGHTKIDS_MODE=public techblog/brightkids:latest
```

The SPA reads `GET /api/v1/config` at boot to learn the mode and routes profile
storage accordingly — no rebuild needed to switch.

## HTTP API

All endpoints are under `/api/v1` and return JSON. Content is read-only. The
profile/progress/settings endpoints exist **only in `private` mode**; in
`public` mode that data lives in the browser instead.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/config` | client config — `{mode}` (private/public) |
| `GET` | `/api/v1/subjects` | subjects and their grades |
| `GET` | `/api/v1/lessons?subject=&grade=` | lesson summaries |
| `GET` | `/api/v1/lessons/{id}` | full lesson (items, tts, reward) |
| `GET` | `/api/v1/profiles` | list local profiles *(private mode)* |
| `POST` | `/api/v1/profiles` | create a profile `{name, avatar, locale_pref}` |
| `DELETE` | `/api/v1/profiles/{id}` | delete a profile |
| `GET` | `/api/v1/profiles/{id}/progress` | progress, total stars, streak |
| `POST` | `/api/v1/profiles/{id}/progress` | record an attempt `{lesson_id, stars}` |
| `GET` | `/api/v1/profiles/{id}/settings` | profile settings |
| `PUT` | `/api/v1/profiles/{id}/settings` | update settings |
| `GET` | `/healthz` · `/readyz` | liveness · readiness |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/robots.txt` · `/sitemap.xml` | auto-generated SEO, rooted at the request's origin |

`robots.txt` and `sitemap.xml` are generated on the fly: the sitemap lists every
page (home, subject pickers, each subject/grade list, and all lessons) as
absolute URLs built from the request's own scheme/host (honoring
`X-Forwarded-Proto`/`X-Forwarded-Host`), so the same binary serves correct URLs
behind any domain or reverse proxy.

## Architecture

```
[ Browser / PWA ]  --static-->  embedded SPA (React + Vite + TS)
   Web Speech (TTS) · Web Audio (SFX) · confetti — all client-side
        |  fetch JSON
        v
[ Go binary: chi ]  /api/v1  ·  /metrics  ·  /healthz /readyz  ·  SPA fallback
        |
        v
[ modernc.org/sqlite ]  profiles, progress, settings   (private mode only;
                                                         public mode = browser localStorage)
```

Lessons live as schema-validated YAML under `content/`, embedded into the binary
and loaded into memory at boot (the server fails fast on malformed content). The
built SPA is embedded via `go:embed`. CGO is disabled everywhere for clean
static multi-arch builds.

## Metrics

Prometheus, namespace `brightkids`: `http_requests_total{method,route,status}`,
`http_request_duration_seconds{route}`, `lessons_completed_total{subject,grade}`,
`build_info{version,commit}`, plus standard Go/process collectors. No per-child
identifiers — aggregate only.

## Building & releasing

```bash
make web        # build the SPA into the Go embed dir
make build      # web + go build -> ./brightkids
make test       # go test -race + frontend tests
make lint       # golangci-lint + eslint
make scan       # security scans -> scans/ (gitignored)
make docker     # local multi-arch buildx
make release    # goreleaser --snapshot --clean
```

Releases are date-versioned `vYYYY.M.PATCH` (no leading zero on the month).
GitHub Actions handle CI (`ci.yml`), GitHub Releases (`release.yml`, GoReleaser),
and multi-arch Docker publishing to `techblog/brightkids` (`docker.yml`).

## License

[Apache-2.0](LICENSE).
