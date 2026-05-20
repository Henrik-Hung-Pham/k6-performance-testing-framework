// Breakpoint test — slow monotonic ramp until SLO breaks. Finds the capacity knee.
//
// Question this test answers:
//   "What's the maximum sustainable RPS before p95 latency or error rate violates SLO?"
//
// Strategy: ramp slowly so we can identify the exact RPS at which behavior changes.
// `abortOnFail: true` on the threshold causes k6 to stop the test the moment SLO breaks —
// the last successful stage's target is your capacity number.

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { STATIC_TOKEN } from '../../lib/auth/quickpizza.js';
import { newPizzaRequest } from '../../lib/data/pizzaRequests.js';
import { breakpointScenario } from '../../config/scenarios.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

export const options = {
  scenarios: { breakpoint: breakpointScenario },
  thresholds: {
    // abortOnFail stops the test the moment SLO breaks — your capacity is the last surviving stage.
    http_req_failed: [{ threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<1500', abortOnFail: true, delayAbortEval: '30s' }],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), {
      token: STATIC_TOKEN,
      name: 'pizza (breakpoint)',
    });
    check(res, { 'pizza: 200': (r) => r.status === 200 });
    parseJson(res);
  });
}

export function handleSummary(data) {
  return buildSummary(data);
}
