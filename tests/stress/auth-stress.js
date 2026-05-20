// Stress test — push the auth + pizza-generation path past expected peak.
//
// Question this test answers:
//   "At what arrival rate does login + pizza generation latency exceed SLO, and does the system
//    recover cleanly when load drops back to normal?"
//
// Why this path: it combines auth (CSRF + login) with the most expensive endpoint
// (pizza recommendation engine) — the most likely path to surface contention.

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { login, clearTokenCache } from '../../lib/auth/quickpizza.js';
import { newPizzaRequest } from '../../lib/data/pizzaRequests.js';
import { stressScenario } from '../../config/scenarios.js';
import { pizzasGenerated } from '../../lib/metrics/custom.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

export const options = {
  scenarios: { auth_stress: stressScenario },
  thresholds: {
    // Stress test: we expect some degradation. Thresholds enforce *recovery* and bounded failure.
    checks: ['rate>0.90'],
    http_req_failed: ['rate<0.10'],
    'http_req_duration{group:::auth}': ['p(95)<3000'],
    'http_req_duration{group:::recommend}': ['p(95)<3500'],
    login_success: ['rate>0.85'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  // Force a fresh login every iteration to stress the auth path harder.
  clearTokenCache();
  const token = login();
  if (!token) return;

  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), {
      token,
      name: 'pizza under stress',
    });
    const ok = check(res, {
      'pizza: success': (r) => r.status === 200,
      'pizza: parseable': (r) => {
        const body = parseJson(r);
        return body && body.pizza && typeof body.pizza.id === 'number';
      },
    });
    if (ok) pizzasGenerated.add(1);
  });
}

export function handleSummary(data) {
  return buildSummary(data);
}
