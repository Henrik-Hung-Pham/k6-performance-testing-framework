# Contributing

This framework enforces a specific style. Before adding a test, read this.

## Adding a test

1. **Pick the right type.** See [SCENARIOS.md](SCENARIOS.md). If your test answers a new question, add a new file in `tests/<type>/`. If it varies an existing test, prefer parameterization (env var) over a new file.

2. **Start from a sibling.** Copy the closest existing test (e.g., `tests/load/browse-ratings.js`) and edit. Don't write from scratch — you'll skip a convention.

3. **One question per test.** If you find yourself describing your test as "X plus Y", split it.

## Required structure

Every test file must:

```js
// 1. Header comment with the question this test answers and how to run it.

// 2. Imports — from config/ and lib/ only. No direct k6/http calls.
import { check, group } from 'k6';
import { apiClient } from '../../lib/http/client.js';
import { STATIC_TOKEN } from '../../lib/auth/quickpizza.js';
import { jitteredSleep } from '../../lib/utils/thinkTime.js';
import { loadScenario } from '../../config/scenarios.js';
import { browseSLO } from '../../config/thresholds.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

// 3. options with scenarios + thresholds — never bare vus/duration.
export const options = {
  scenarios: { ... },
  thresholds: { ...browseSLO },
};

// 4. default() (or named exec functions for multi-scenario tests).
export default function () { ... }

// 5. handleSummary.
export function handleSummary(data) {
  return buildSummary(data);
}
```

## Style rules

### Required

- **Every HTTP call has a `check()`.** Use `apiClient.*` — it adds a baseline check automatically. Add domain checks for body/shape.
- **Every `check()` has a `checks{...}` threshold.** Unasserted checks silently pass.
- **Open-model executors for API tests.** Use `ramping-arrival-rate` or `constant-arrival-rate` from `config/scenarios.js`.
- **Think time is jittered.** Use `jitteredSleep(min, max)` or `humanThinkTime(median, sigma)` — never `sleep(N)` with a fixed value.
- **Test data via `SharedArray`.** Add fixtures to `fixtures/` and load via `lib/data/`.
- **No hardcoded URLs.** Use `apiClient` (it injects baseUrl) or import from `config/environments.js`.
- **No hardcoded SLO numbers.** Import from `config/thresholds.js`. If you need a new SLO, add it there with a name.
- **No hardcoded auth tokens.** Use `STATIC_TOKEN` or `login()` from `lib/auth/quickpizza.js`.

### Forbidden

- ❌ `JSON.parse(open(...))` inside `default()` — use `SharedArray` instead
- ❌ `http.batch()` for sequential business logic (it's parallel — only use for genuine concurrency)
- ❌ Top-level `vus: N, duration: 'Xm'` outside smoke tests — use `scenarios`
- ❌ Thresholds that always pass (`p(95)<60000`) or always fail (`p(95)<10`)
- ❌ Mutating shared fixtures inside a VU loop
- ❌ Logging on every iteration (use `logger` with `LOG_LEVEL=debug` for dev)
- ❌ `Authorization: Bearer <X>` — QuickPizza uses `Authorization: token <X>`. The client handles this; don't reimplement.

### Recommended

- Use `group()` to bucket related requests — the same group names map to threshold tags (`http_req_duration{group:::recommend}`)
- Tag custom metrics with dimensions you'll want to slice in Grafana (`persona`, `flow`, `variant`)
- Add `summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max']` to surface percentiles in the summary

## Adding a new SLO

1. Add the named export to [config/thresholds.js](../config/thresholds.js).
2. Document the rationale in a comment.
3. Use it in the test: `thresholds: { ...newSLO }`.
4. Update [docs/METRICS.md](METRICS.md) if it relies on a new metric.

## Adding a new helper to `lib/`

1. Pick the right directory: `http/`, `auth/`, `data/`, `metrics/`, `utils/`, `reporting/`.
2. Export named functions only — no default exports.
3. No side effects at import time (other than metric registration, which k6 requires at the top level).
4. Add a brief header comment explaining the module's role.

## Running locally before pushing

```bash
make lint        # ESLint
make smoke       # must pass
```

CI will run lint + smoke on every push. PRs cannot merge on red CI.

## Commit messages

```
<type>: <short summary>

<longer body if needed>
```

Types: `test` (new/changed test), `lib` (helper change), `config` (SLO/scenario change), `ci`, `docs`, `chore`.

Examples:
- `test: add breakpoint test for /api/pizza`
- `lib: add per-VU token cache to auth/quickpizza.js`
- `config: tighten browseSLO p95 to 600ms`
