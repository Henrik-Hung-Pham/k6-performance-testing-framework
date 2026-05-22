// Soak test — moderate load held for 2 hours.
//
// Question this test answers:
//   "Does the system show degradation over time at sustained moderate load?
//    (Memory leaks, connection-pool exhaustion, log-volume issues, GC pressure.)"
//
// Primary signal: latency at hour 2 should match latency at minute 10. Error rate must not climb.
// Run reduced duration in dev via -e SOAK_DURATION=10m.

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { STATIC_TOKEN } from '../../lib/auth/quickpizza.js';
import { newPizzaRequest } from '../../lib/data/pizzaRequests.js';
import { jitteredSleep } from '../../lib/utils/thinkTime.js';
import { soakScenario } from '../../config/scenarios.js';
import { soakSLO } from '../../config/thresholds.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

// SOAK_DURATION env override lets dev runs use a 10-minute window instead of 2h.
const duration = __ENV.SOAK_DURATION || soakScenario.duration;

export const options = {
  scenarios: { soak: { ...soakScenario, duration } },
  thresholds: soakSLO,
};

export default function () {
  group('browse', () => {
    apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings (soak)' });
  });

  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), {
      token: STATIC_TOKEN,
      name: 'pizza (soak)',
    });
    check(res, {
      'pizza: 200': (r) => r.status === 200,
      'pizza: parseable': (r) => parseJson(r) !== null,
    });
  });

  jitteredSleep(0.5, 2);
}

export function handleSummary(data) {
  return buildSummary(data);
}
