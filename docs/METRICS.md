# Metrics

Beyond k6's built-in metrics (`http_req_duration`, `http_req_failed`, `iteration_duration`, etc.), this framework adds custom metrics for business-meaningful signals.

All custom metrics are defined in [lib/metrics/custom.js](../lib/metrics/custom.js).

## Custom metrics

### `login_success` (Rate)

Fraction of `POST /api/users/token/login` calls that returned a 200 with a valid token.

```
login_success: 99.4%
```

A drop here, even if `http_req_failed` looks fine, means auth is silently degraded (e.g., 200 responses with missing tokens, malformed JSON).

### `journey_duration_ms` (Trend)

End-to-end wall time per user journey, in milliseconds. Tagged by `persona` (browser/engaged/power) or `flow` (pizza, etc.).

```
journey_duration_ms.....: avg=2841ms  p(95)=4720ms
  ↳ persona:browser     : avg=1820ms  p(95)=2900ms
  ↳ persona:engaged     : avg=3950ms  p(95)=5800ms
  ↳ persona:power       : avg=6420ms  p(95)=9100ms
```

This is the *user-perceived* time, not just per-request latency. A test where every individual request is fast but the journey takes 30s is a UX failure.

### `pizzas_generated` (Counter)

Number of successful `POST /api/pizza` responses.

### `pizza_ingredient_count` (Trend)

Distribution of ingredient counts in the pizzas returned by the API. Useful as a basic regression check: if the recommendation engine starts returning consistently smaller pizzas, this metric will show it.

### `pizza_calories` (Trend)

Distribution of calorie counts. Similar regression signal.

### `ratings_submitted` (Counter)

Number of successful `POST /api/ratings` responses (status 201).

### `journeys_completed` (Counter)

Total journeys finished cleanly. Tagged by `persona` or `flow`.

### `http_errors_total` (Counter)

Per-endpoint, per-status failure counter. Augments `http_req_failed` (which is a single rate) with breakdown tags so failures can be sliced in Grafana.

```
http_errors_total: 47
  ↳ endpoint:pizza   status:503   : 32
  ↳ endpoint:login   status:429   : 15
```

## Grafana queries (InfluxDB)

After `make up` and importing dashboard ID 2587, these queries unlock the custom metrics:

```sql
-- Login success rate over time
SELECT mean("value") FROM "login_success"
  WHERE $timeFilter GROUP BY time($__interval)

-- Journey duration p95 by persona
SELECT percentile("value", 95) FROM "journey_duration_ms"
  WHERE $timeFilter GROUP BY time($__interval), "persona"

-- Errors by endpoint
SELECT sum("value") FROM "http_errors_total"
  WHERE $timeFilter GROUP BY time($__interval), "endpoint"

-- Pizza ingredient distribution
SELECT percentile("value", 50), percentile("value", 95) FROM "pizza_ingredient_count"
  WHERE $timeFilter GROUP BY time($__interval)
```

## Adding a new metric

1. Add the metric to [lib/metrics/custom.js](../lib/metrics/custom.js):
   ```js
   export const checkoutLatency = new Trend('checkout_latency_ms', true);
   ```
2. Import and use in your test:
   ```js
   import { checkoutLatency } from '../../lib/metrics/custom.js';
   // ...
   checkoutLatency.add(Date.now() - start, { variant: 'A' });
   ```
3. Add a threshold in [config/thresholds.js](../config/thresholds.js):
   ```js
   'checkout_latency_ms{variant:A}': ['p(95)<1500'],
   ```
4. Document it here.

## CI integration: JUnit XML

Every run also emits a JUnit XML file (default `results/summary.xml`, override via
`K6_SUMMARY_JUNIT`) in the Maven Surefire dialect. Each threshold rule and check
is exposed as a `<testcase>`, with `<failure>` elements for the ones that didn't
pass. Wire it into your CI's test-results panel for native pass/fail UI:

- **GitHub Actions:** `mikepenz/action-junit-report@v5`
- **CircleCI:** `store_test_results: path: results/`
- **GitLab:** `artifacts.reports.junit: results/*.xml`

## Reading the summary

K6's end-of-test summary shows custom metrics under the test name. A clean summary tells the story at a glance:

```
✓ checks.........................: 99.84% ✓ 12,419   ✗ 19
✓ http_req_failed................: 0.32%  ✓ 41       ✗ 12,397
✓ login_success..................: 99.40% ✓ 994      ✗ 6
✓ pizzas_generated...............: 1,000
✓ ratings_submitted..............: 718
✓ http_req_duration{group:::browse}   : p(95)=412ms  p(99)=874ms
✓ http_req_duration{group:::recommend}: p(95)=961ms  p(99)=1.8s
✓ journey_duration_ms                 : p(95)=4.7s   p(99)=8.2s
```

Every line is a number a hiring manager or oncall engineer can act on. That's the point.
