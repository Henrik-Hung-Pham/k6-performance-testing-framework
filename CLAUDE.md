# Project: K6 Performance Testing Framework

A production-grade K6 framework targeting [QuickPizza](https://quickpizza.grafana.com) — Grafana's
official k6 demo target. Designed as a portfolio piece that demonstrates senior performance-engineering practice.

## Target system

- **API**: `https://quickpizza.grafana.com` — pizza-recommendation app maintained by Grafana Labs.
- **Source**: https://github.com/grafana/quickpizza — self-hostable via Docker.
- **Why**: explicitly maintained for k6 load testing — no rate limits, no ToS concerns.

### Key endpoints

- `POST /api/pizza` — generate pizza recommendation (auth required, most expensive endpoint)
- `GET /api/ratings` — list ratings (auth required for the framework's purpose, though token is permissive)
- `POST /api/ratings` — submit rating
- `POST /api/csrf-token` — get CSRF cookie
- `POST /api/users/token/login` — login (returns auth token)

### Auth

- **Format**: `Authorization: token <X>` (lowercase "token", NOT Bearer).
- **Static dev token**: `abcdef0123456789` (hardcoded in QuickPizza server, used by all upstream examples).
- **Login flow**: CSRF → login with `default`/`12345678` → returns token.

The framework provides both via `lib/auth/quickpizza.js` — `STATIC_TOKEN` for low-overhead tests, `login()` for tests that should include auth latency in their journey.

## Architecture

- `config/` — per-environment URLs, SLOs, scenario presets. **All test files import from here; never hardcode URLs or thresholds in tests.**
- `lib/` — reusable modules. Tests should orchestrate these, not reimplement HTTP/auth/metrics logic.
- `tests/<type>/` — one file per test type (smoke, load, stress, spike, soak, breakpoint). Each is independently runnable.
- `scenarios/` — composite end-to-end journeys combining multiple flows.
- `fixtures/` — JSON test data, loaded via `SharedArray` in `lib/data/`.
- `docker/` — Compose stack (InfluxDB + Grafana) for live dashboards.

## Conventions

- **Open-model executors by default** (`constant-arrival-rate`, `ramping-arrival-rate`) for API tests. Closed-model VU executors only for human-session simulation.
- **Every HTTP call has a `check()`; every `check()` has a `checks{...}` threshold.** Unasserted checks silently pass.
- **Thresholds live in `config/thresholds.js`** as SLO objects, imported into tests. This keeps SLOs auditable in one place.
- **Think time uses `jitteredSleep()` from `lib/utils/thinkTime.js`** — never `sleep(N)` with a fixed value.
- **Test data via `SharedArray`** in `lib/data/`. Never `JSON.parse(open(...))` inside `default()`.
- **Custom metrics** (Trends, Rates, Counters) live in `lib/metrics/custom.js` and are imported by tests that need business-level signals.
- **Authorization header format is `token <X>`, not `Bearer <X>`** — QuickPizza specific. Handled centrally by `lib/http/client.js`.

## Running

```bash
make smoke              # 30s sanity check
make load               # ~5 min realistic browse load
make load-lifecycle     # ~8 min full pizza+rate lifecycle
make up                 # start Grafana + InfluxDB
make dashboard          # open live dashboard
make all-tests          # smoke + load + spike (CI suite)
```

## Subagents

See [.claude/agents/](.claude/agents/) — four specialists:

- `k6-scenario-designer` — produces spec docs before any code
- `k6-script-author` — writes scripts from specs
- `k6-code-reviewer` — validates scripts (checks, thresholds, realism)
- `k6-results-analyst` — analyzes test output, identifies bottlenecks

Pipeline: designer → author → reviewer → (run) → analyst → loop.

## History note

The framework was initially scaffolded against `test-api.k6.io` (the legacy "crocodiles" API), but that endpoint was deprecated by Grafana and 302-redirects to QuickPizza. The pivot to QuickPizza is the current and correct target. If you find any stale references to "crocodile" or `test-api.k6.io` anywhere, update them — they're bugs.
