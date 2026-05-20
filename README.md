# K6 Performance Testing Framework

> A production-grade performance testing framework built with [K6](https://k6.io), targeting Grafana's public [QuickPizza](https://quickpizza.grafana.com) demo app. Designed to be **clonable, runnable, and reviewable in under 5 minutes** — every test follows a repeatable structure with SLO-driven thresholds, custom business metrics, and live Grafana dashboards.

[![Performance Tests](https://github.com/Henrik-Hung-Pham/k6-performance-testing-framework/actions/workflows/performance-tests.yml/badge.svg)](https://github.com/Henrik-Hung-Pham/k6-performance-testing-framework/actions/workflows/performance-tests.yml)
[![Lint](https://github.com/Henrik-Hung-Pham/k6-performance-testing-framework/actions/workflows/lint.yml/badge.svg)](https://github.com/Henrik-Hung-Pham/k6-performance-testing-framework/actions/workflows/lint.yml)
[![k6](https://img.shields.io/badge/k6-v1.0+-7D64FF?logo=k6&logoColor=white)](https://k6.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## TL;DR

```bash
git clone https://github.com/Henrik-Hung-Pham/k6-performance-testing-framework.git
cd k6-performance-testing-framework
make smoke              # 30-second sanity check against quickpizza.grafana.com
make up && make load    # full load test with live Grafana dashboard at localhost:3000
```

No accounts to create, no API keys. QuickPizza is Grafana's official k6 demo target — explicitly maintained for load testing.

---

## Why this exists

Most K6 examples online are 20-line scripts. Production performance engineering needs more:

- **Repeatable test catalogue** — six test types (smoke, load, stress, spike, soak, breakpoint), each answering a *specific question*
- **SLOs as first-class config** — thresholds live in one auditable file, imported by tests
- **Reusable modules** — HTTP client, auth (CSRF + login or static token), test data via `SharedArray`, custom business metrics
- **Realistic load shapes** — open-model arrival rates, jittered/log-normal think time, weighted persona mix
- **Observability built-in** — InfluxDB + Grafana via `docker compose up`, plus HTML reports
- **CI-ready** — GitHub Actions workflow with smoke gating

This is what I'd build on day one at a new company. It's also what I'd want to see in a candidate's portfolio.

---

## Target system: QuickPizza

[QuickPizza](https://github.com/grafana/quickpizza) is a pizza-recommendation app maintained by Grafana Labs as a public k6 demo target. The framework exercises:

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `POST /api/pizza` | Generate a pizza recommendation from dietary restrictions | Most expensive — recommendation engine |
| `GET /api/ratings` | List all submitted ratings | Public read |
| `POST /api/ratings` | Submit a star rating for a pizza | Authenticated write |
| `POST /api/csrf-token` | Fetch CSRF token cookie | Step 1 of login |
| `POST /api/users/token/login` | Login with username + password + CSRF | Returns auth token |

Auth: QuickPizza uses `Authorization: token <X>` (lowercase, not Bearer). The repo ships a static dev token (`abcdef0123456789`) for tests where auth isn't the focus; the CSRF + login flow is used for tests that should include login latency in the journey.

---

## Test catalogue

| Test | Question it answers | Typical duration | Run |
|------|---------------------|------------------|-----|
| **Smoke** | "Is QuickPizza alive and does pizza → rate work end-to-end?" | ~30s | `make smoke` |
| **Load (browse)** | "Can `/api/ratings` sustain 20 req/s for 3 min under SLO?" | ~5 min | `make load` |
| **Load (lifecycle)** | "Can 15 users/sec each login → generate → rate under SLO?" | ~8 min | `make load-lifecycle` |
| **Stress** | "Where does auth + recommend break, and do we recover?" | ~8 min | `make stress` |
| **Spike** | "Do we survive a 40× sudden burst on `/api/pizza`? How fast do we recover?" | ~3 min | `make spike` |
| **Soak** | "Does QuickPizza degrade over hours of steady load?" | 2h | `make soak` |
| **Breakpoint** | "What's the maximum sustainable RPS on `/api/pizza`?" | up to 20 min | `make breakpoint` |
| **E2E Journey** | "How does the system behave under realistic 70/20/10 persona mix?" | ~6 min | `make e2e` |

Each test is independently runnable, has its own SLO, and produces an HTML report + JSON summary.

---

## Architecture

```
.
├── config/                   SLO catalogue, scenario presets, per-env URLs
│   ├── environments.js       staging (quickpizza.grafana.com) | local
│   ├── scenarios.js          reusable load shapes (loadScenario, spikeScenario, ...)
│   └── thresholds.js         SLO objects (browseSLO, recommendSLO, writeSLO, authSLO, ...)
│
├── lib/                      Reusable modules — tests orchestrate, never reimplement
│   ├── http/client.js        Wrapped k6/http with auto-injected headers + auth + error metric
│   ├── auth/quickpizza.js    Static token + CSRF/login flow with per-VU token cache
│   ├── data/users.js         SharedArray user pool
│   ├── data/pizzaRequests.js Domain entity generators (pizza requests, ratings)
│   ├── metrics/custom.js     Counter/Rate/Trend for business signals
│   ├── utils/thinkTime.js    Jittered + log-normal sleep
│   ├── utils/logger.js       Structured JSON logger (off by default)
│   └── reporting/handleSummary.js   HTML + JSON + stdout summary
│
├── tests/
│   ├── smoke/                Fail-fast sanity checks (CI gate)
│   ├── load/                 Expected-peak traffic (browse + lifecycle)
│   ├── stress/               Past-peak — find degradation point
│   ├── spike/                Sudden burst — survival + recovery
│   ├── soak/                 Hours-long — leak detection
│   └── breakpoint/           Slow ramp until SLO breaks
│
├── scenarios/
│   └── e2e-user-journey.js   Composite: browser (70%) + engaged (20%) + power (10%) personas
│
├── fixtures/                 JSON test data → SharedArray
├── docker/                   InfluxDB + Grafana stack for live dashboards
├── .github/workflows/        CI: smoke on every push; load/spike on dispatch
└── docs/                     Architecture, scenarios, metrics, contributing
```

### Pipeline view

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   config/    │──▶│    lib/      │──▶│   tests/     │──▶│  results/    │
│ SLOs +       │   │ http, auth,  │   │ scenarios    │   │ HTML, JSON,  │
│ scenarios    │   │ data, metrics│   │ + thresholds │   │ Grafana feed │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

Tests are **thin orchestrators**. All HTTP, auth, data, and metrics logic is in `lib/`. Change a threshold? Edit `config/thresholds.js` — every test using it updates. Change the base URL? Edit `config/environments.js`. No grepping across test files.

---

## Quick start

### Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) v1.0+ (`brew install k6` on macOS)
- [Docker](https://www.docker.com/) (optional — only for live dashboards)
- [Node.js 20+](https://nodejs.org) (optional — only for linting)

### Run a smoke test

```bash
make smoke
```

This hits `quickpizza.grafana.com` end-to-end: list ratings, generate a pizza, submit a rating. Should finish in under 60 seconds, all green:

```
✓ checks.........................: 100.00% ✓ 45   ✗ 0
✓ http_req_failed................: 0.00%   ✓ 0    ✗ 15
✓ http_req_duration..............: p(95)=258ms
  pizzas_generated...............: 5
  ratings_submitted..............: 5
```

### Run a load test with live Grafana

```bash
make up                                  # start InfluxDB + Grafana
make load                                # run while watching localhost:3000
make down                                # stop the stack when done
```

Open http://localhost:3000 → import dashboard [ID 2587](https://grafana.com/grafana/dashboards/2587) (one-time).

### Run a specific test

```bash
k6 run tests/spike/public-spike.js
k6 run -e ENV=staging tests/load/pizza-lifecycle.js
make e2e                                 # full persona-weighted journey
```

### Run against a self-hosted QuickPizza

```bash
# In one terminal:
docker run -p 3333:3333 ghcr.io/grafana/quickpizza-local:latest

# In another:
k6 run -e ENV=local tests/smoke/api-smoke.js
```

Self-hosted lets you push real stress numbers without sharing a public sandbox.

### Run inside Docker (no local k6 needed)

```bash
make up
make docker-run TEST=tests/smoke/api-smoke.js
```

---

## Custom metrics

Beyond k6's defaults, this framework records business-meaningful signals:

| Metric | Type | What it tells you |
|--------|------|-------------------|
| `login_success` | Rate | % of login attempts that succeeded |
| `journey_duration_ms` | Trend | End-to-end time per user journey (tagged by `persona` or `flow`) |
| `pizzas_generated` | Counter | Pizza recommendations successfully returned |
| `pizza_ingredient_count` | Trend | Distribution of ingredient counts in returned pizzas |
| `pizza_calories` | Trend | Distribution of calorie counts |
| `ratings_submitted` | Counter | Star ratings accepted by the API |
| `journeys_completed` | Counter | Total journeys finished cleanly (tagged by `persona`/`flow`) |
| `http_errors_total` | Counter | Failures, tagged by `endpoint` + `status` — for Grafana slicing |

See [docs/METRICS.md](docs/METRICS.md) for the full catalogue and Grafana queries.

---

## SLOs

All thresholds live in [config/thresholds.js](config/thresholds.js) as named SLO objects. Highlights:

| SLO | Applies to | Targets |
|-----|-----------|---------|
| `baselineSLO` | every test | checks > 99%, errors < 1% |
| `browseSLO` | `/api/ratings` reads | p95 < 800ms, p99 < 1500ms |
| `recommendSLO` | `/api/pizza` recommendations | p95 < 1200ms, p99 < 2500ms |
| `writeSLO` | `/api/ratings` writes | p95 < 900ms, p99 < 2000ms |
| `authSLO` | login flow | p95 < 1000ms, login_success > 99% |
| `spikeSLO` | spike test | checks > 95% (recovery, not perfection) |
| `soakSLO` | soak test | no degradation over the window |

To change an SLO, edit the file. Every test importing it picks up the new value automatically.

> SLOs are calibrated for QuickPizza's public deployment (shared resource, modest specs). Self-hosted instances can sustain much tighter targets — adjust accordingly.

---

## Reports

Every run produces three artifacts in `results/`:

1. **`<test>-<timestamp>.html`** — Pretty visual report (via [k6-reporter](https://github.com/benc-uk/k6-reporter)) — open in browser
2. **`<test>-<timestamp>.json`** — Machine-readable summary (full metrics tree)
3. **`<test>-<timestamp>-raw.json`** — Time-series export (one event per metric sample) — for further analysis

CI uploads all three as workflow artifacts (14–30 day retention).

---

## CI/CD

[.github/workflows/performance-tests.yml](.github/workflows/performance-tests.yml):

- **Every push/PR** → smoke test runs as a gate. PR cannot merge on smoke failure.
- **Manual dispatch** → choose `load`, `spike`, or `all` to run on demand.
- **All runs** → results uploaded as artifacts.

[.github/workflows/lint.yml](.github/workflows/lint.yml):

- ESLint runs on every push to catch script issues before they hit k6.

---

## Project conventions

These conventions are non-negotiable across the repo:

- **Every HTTP call has a `check()`** — paired with a `checks{...}` threshold (unasserted checks silently pass)
- **Open-model executors by default** for API tests (`ramping-arrival-rate`) — closed model only for human-session simulation
- **Think time uses `jitteredSleep()` or `humanThinkTime()`** — never `sleep(N)` with a fixed value
- **Test data via `SharedArray`** — never `JSON.parse(open(...))` inside `default()`
- **No hardcoded URLs, tokens, or credentials** — everything env-driven via [config/environments.js](config/environments.js)
- **Scenarios > top-level `vus`/`duration`** — for anything beyond smoke

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full style guide.

---

## What this repo demonstrates

For anyone evaluating this as a portfolio piece, the things to look at:

1. **[config/thresholds.js](config/thresholds.js)** — SLO-driven testing, single source of truth
2. **[lib/http/client.js](lib/http/client.js)** — wrapped HTTP with auto-checks + per-endpoint error metric
3. **[lib/auth/quickpizza.js](lib/auth/quickpizza.js)** — per-VU token cache (realistic session behavior) + CSRF/login flow
4. **[scenarios/e2e-user-journey.js](scenarios/e2e-user-journey.js)** — weighted multi-persona scenario with separate arrival rates per persona
5. **[tests/breakpoint/capacity.js](tests/breakpoint/capacity.js)** — `abortOnFail` thresholds for automatic capacity discovery
6. **[tests/spike/public-spike.js](tests/spike/public-spike.js)** — 40× burst, recovery-focused SLO
7. **[Makefile](Makefile)** — one-line developer experience for every operation

---

## Roadmap

- [ ] Browser tests against the QuickPizza UI using the k6 browser module
- [ ] Prometheus remote-write output (alternative to InfluxDB)
- [ ] Chaos scenarios (k6 + toxiproxy)
- [ ] Comparative reports (run-over-run regression detection)
- [ ] WebSocket and gRPC examples (QuickPizza supports both)

---

## License

MIT — see [LICENSE](LICENSE).

---

**Built by [Hung Pham](https://github.com/Henrik-Hung-Pham)** · [LinkedIn](https://www.linkedin.com/in/henrik-hung-ph/) · Reach out if you'd like to discuss performance engineering.
