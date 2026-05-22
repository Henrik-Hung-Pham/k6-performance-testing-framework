# Architecture

## Design goals

1. **Tests are thin orchestrators.** All reusable logic — HTTP, auth, data, metrics — lives in `lib/`. A test file should read like a story: "browse → recommend → rate → assert".
2. **SLOs are first-class config.** Thresholds live in [config/thresholds.js](../config/thresholds.js) as named objects. Tests import them; no inline magic numbers.
3. **Realistic by default.** Open-model arrival rates, jittered think time, weighted persona mix. The defaults model real systems.
4. **Reviewable in under 5 minutes.** Anyone with `k6` installed can clone and run `make smoke`. Anyone reviewing the code can navigate top-down: `README` → `Makefile` → `tests/` → `lib/`.

## Module map

### `config/`

Single source of truth for anything that changes per-environment or per-SLO.

- `environments.js` — base URLs, keyed by `__ENV.ENV`. Today: `staging` (quickpizza.grafana.com) and `local` (self-hosted on :3333).
- `thresholds.js` — SLO objects (baselineSLO, browseSLO, recommendSLO, writeSLO, authSLO, spikeSLO, soakSLO). Tests `import { browseSLO } from ...` and spread into `options.thresholds`.
- `scenarios.js` — load-shape presets (smokeScenario, loadScenario, stressScenario, spikeScenario, soakScenario, breakpointScenario). Tests pick one or compose multiple.

### `lib/`

Pure modules with no global side effects. Each file does one thing.

| Module | Responsibility |
|--------|----------------|
| `http/client.js` | `apiClient.get/post/put/patch/del`. Auto-prefixes baseUrl, injects `Authorization: token <X>` (QuickPizza format), applies a baseline check, records `http_errors_total`. |
| `auth/quickpizza.js` | `STATIC_TOKEN` (no-overhead dev token), `login()` (CSRF + login flow with per-VU token cache). |
| `data/users.js` | `SharedArray` user pool + `pickUser(vuId)` round-robin. |
| `data/pizzaRequests.js` | Domain generators (`newPizzaRequest()`, `newRating(pizzaId)`). |
| `metrics/custom.js` | Counter/Rate/Trend exports for business signals. Tests import what they need. |
| `utils/thinkTime.js` | `jitteredSleep()` (uniform) and `humanThinkTime()` (log-normal). |
| `reporting/handleSummary.js` | `buildSummary()` — text (stdout) + HTML + JSON. Tests just `export function handleSummary(data) { return buildSummary(data); }`. |

### `tests/<type>/`

One test type per directory. Each test file:

1. Imports scenarios + thresholds from `config/`.
2. Imports flow logic from `lib/`.
3. Defines `options.scenarios` and `options.thresholds`.
4. Exports `default` (or named exec functions).
5. Exports `handleSummary`.

### `scenarios/`

Composite tests that combine multiple personas / flows. Today: `e2e-user-journey.js` runs three personas concurrently in separate scenarios with separate arrival rates.

### `fixtures/`

JSON data loaded once via `SharedArray`. Never `JSON.parse(open(...))` in a VU loop — that allocates per-VU.

## Data flow

```
            ┌──────────────────────────────────────────┐
            │              k6 runtime                  │
            │                                          │
            │   ┌──────────┐   ┌────────────────────┐  │
            │   │ scenarios│──▶│ test default()/exec│  │
            │   └──────────┘   └────────┬───────────┘  │
            │                           │              │
            │                           ▼              │
            │             ┌─────────────────────────┐  │
            │             │ lib/http  lib/auth      │  │
            │             │ lib/data  lib/metrics   │  │
            │             └────────────┬────────────┘  │
            │                          │               │
            │                          ▼               │
            │             ┌─────────────────────────┐  │
            │             │ quickpizza.grafana.com  │  │
            │             └─────────────────────────┘  │
            └──────────────────────┬───────────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
            ┌──────────┐    ┌──────────┐    ┌──────────────┐
            │ stdout   │    │ HTML     │    │ InfluxDB →   │
            │ summary  │    │ report   │    │ Grafana live │
            └──────────┘    └──────────┘    └──────────────┘
```

## Per-VU state

k6 instantiates each `lib/` module once per VU. That means:

- `tokenCache` in `lib/auth/quickpizza.js` is VU-scoped — each VU has its own token map. Perfect for caching auth without leaking across VUs.

This matches real session behavior and avoids the common k6 pitfall of every iteration re-authenticating.

## Why open-model executors

Closed-model (`constant-vus`, `ramping-vus`) caps concurrent requests at VU count. If the SUT slows down, the next iteration just waits — you measure back-pressure, not the system's true response.

Open-model (`constant-arrival-rate`, `ramping-arrival-rate`) fires requests at the configured rate regardless of in-flight count. If the SUT slows down, requests queue up — you measure what a real fleet of clients would experience.

For API testing, open is almost always correct. The exception is when you're modeling actual human users in a session (e.g., browser tests with think time) — then closed reflects reality.

## Why per-test summary handler

Every test file calls `buildSummary()` from `lib/reporting/handleSummary.js`. This:

- Routes HTML output to `results/<test>-<timestamp>.html` via the `K6_SUMMARY_HTML` env var (set by `make` targets).
- Routes JSON output to `results/<test>-<timestamp>.json`.
- Preserves the standard text summary on stdout.

If you want to add JUnit XML for CI, add the `k6-junit` jslib transform to `buildSummary()` — every test picks it up.

## QuickPizza-specific notes

- **Auth header format**: `Authorization: token <X>` (lowercase "token", not Bearer). Centralized in `lib/http/client.js` — don't reimplement.
- **CSRF**: Login requires a CSRF token fetched via `POST /api/csrf-token`. The CSRF value comes back as a cookie (`csrf_token`) and must be echoed in the login body. Handled by `lib/auth/quickpizza.js`.
- **Static dev token**: QuickPizza accepts `abcdef0123456789` as a valid token without any login. Use for tests where auth isn't the focus — saves an HTTP round trip per iteration.
- **Public deployment limits**: `quickpizza.grafana.com` is a shared resource. SLOs in `config/thresholds.js` are calibrated for that environment. Self-hosted will be faster.
