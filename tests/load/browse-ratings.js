// Load test — public ratings browse at expected peak traffic.
//
// Question this test answers:
//   "Can the public ratings API sustain 20 req/s for 3 min while staying under p95 < 800ms?"
//
// Workload model: open (arrival-rate). Browsing is machine-paced from the SUT's perspective;
// we want to know what happens to latency when the request rate is held steady,
// not when N humans are looping forever.
//
// Run:  make load   (or: k6 run tests/load/browse-ratings.js)

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { STATIC_TOKEN } from '../../lib/auth/quickpizza.js';
import { jitteredSleep } from '../../lib/utils/thinkTime.js';
import { loadScenario } from '../../config/scenarios.js';
import { browseSLO } from '../../config/thresholds.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

export const options = {
  scenarios: { browse_load: loadScenario },
  thresholds: browseSLO,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  group('browse', () => {
    const list = apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings' });
    const ok = check(list, {
      'list: 200': (r) => r.status === 200,
      'list: returns array': (r) => {
        const body = parseJson(r);
        return body && Array.isArray(body.ratings);
      },
    });

    if (!ok) return;

    // Realistic flow: user scans the ratings list, briefly pauses, then refreshes.
    jitteredSleep(0.5, 2);
    apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings (refresh)' });
  });

  jitteredSleep(1, 3);
}

export function handleSummary(data) {
  return buildSummary(data);
}
