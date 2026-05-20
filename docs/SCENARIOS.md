# Scenarios

Each test answers one specific question. If you can't state the question in one sentence, the test isn't ready to write.

## Smoke — `tests/smoke/api-smoke.js`

**Question:** "Is QuickPizza alive and does the full ratings → pizza → rate flow work end-to-end?"

- **Executor:** `per-vu-iterations`, 1 VU, 5 iterations
- **Duration:** ~30 seconds
- **SLO:** `checks==1.0`, `errors==0.0` — zero tolerance
- **When to run:** Every commit. Gate for all other tests in CI.

## Load (browse) — `tests/load/browse-ratings.js`

**Question:** "Can `/api/ratings` sustain 20 req/s for 3 minutes while staying under p95 < 800ms?"

- **Executor:** `ramping-arrival-rate`, target 20 rps, 3-min hold
- **Duration:** ~5 minutes
- **SLO:** `browseSLO` — p95 < 800ms, p99 < 1500ms, errors < 1%
- **When to run:** Before any release. After perf-sensitive changes.

## Load (lifecycle) — `tests/load/pizza-lifecycle.js`

**Question:** "When 15 users/sec each login → generate a pizza → submit a rating, do per-request p95s stay under SLO and does the lifecycle complete cleanly?"

- **Executor:** `ramping-arrival-rate`, target 15 rps, 3-min hold
- **Duration:** ~8 minutes
- **Custom metric:** `journeys_completed{flow:pizza}` — counts only iterations where the full lifecycle succeeded
- **SLO:** `writeSLO` + `recommendSLO` + `journeys_completed > 200`

## Stress — `tests/stress/auth-stress.js`

**Question:** "At what arrival rate does login + pizza generation latency exceed SLO, and does the system recover cleanly when load drops back to normal?"

- **Executor:** `ramping-arrival-rate`, ramping to 150 rps
- **Duration:** ~8 minutes
- **SLO:** loose — `checks > 90%`, `errors < 10%`, auth p95 < 3000ms — we *expect* degradation
- **Look for:** The RPS at which p95 crosses the `recommendSLO` threshold. That's your soft capacity.

## Spike — `tests/spike/public-spike.js`

**Question:** "If traffic on `/api/pizza` jumps from 5 to 200 req/s in 10 seconds, does the API survive, and does latency recover within 30s after the spike?"

- **Executor:** `ramping-arrival-rate` with sharp stage transitions (40× burst)
- **Duration:** ~3 minutes
- **SLO:** `spikeSLO` — checks > 95%, errors < 5%, recommend p95 < 3000ms (recovery, not perfection)
- **Look for:** Error spike during the burst, recovery time after drop.

## Soak — `tests/soak/steady-state.js`

**Question:** "Does QuickPizza show degradation over 2 hours of sustained moderate load? (Memory leaks, connection-pool exhaustion, log-volume issues, GC pressure.)"

- **Executor:** `constant-arrival-rate`, 10 rps, 2h
- **Duration:** 2 hours (override with `-e SOAK_DURATION=10m` for dev)
- **SLO:** `soakSLO` — primary signal is *non-degradation*: latency at h2 should match latency at min 10
- **Look for:** Trend in p95 over time. Error rate climbing in later windows.

## Breakpoint — `tests/breakpoint/capacity.js`

**Question:** "What's the maximum sustainable RPS on `/api/pizza` before p95 latency or error rate violates SLO?"

- **Executor:** `ramping-arrival-rate`, slow monotonic ramp to 500 rps over 20 min
- **Duration:** Up to 20 minutes (aborts on threshold breach)
- **SLO:** `abortOnFail` — k6 stops the moment SLO breaks
- **Output:** Your capacity number is the arrival rate at abort time.

## E2E Journey — `scenarios/e2e-user-journey.js`

**Question:** "How does the system behave under realistic traffic mix?"

- **Personas (concurrent scenarios):**
  - **Browser (70%):** anonymous reads — `/api/ratings` only
  - **Engaged (20%):** browse + generate a pizza
  - **Power (10%):** full flow — login + generate + rate
- **Each persona has its own arrival rate**, so the mix is preserved during ramp/down
- **Duration:** ~6 minutes
- **Custom metric:** `journey_duration_ms{persona:...}` — end-to-end time per persona
- **SLO:** per-persona p95s + `journeys_completed > 300`

## Composing tests

Need a "load + spike" combined test? **Don't.** Run them separately and look at the results side-by-side. Combined tests confuse causation: did the spike fail because of the spike, or because cumulative load already pushed the system into degradation?

One test, one question.
