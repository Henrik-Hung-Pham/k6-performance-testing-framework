// Spike test — sudden 40x burst on the pizza recommendation endpoint, then drop to baseline.
//
// Question this test answers:
//   "If traffic jumps from 5 to 200 req/s in 10 seconds (e.g., social media moment),
//    does the API survive, and does latency recover within 30s after the spike?"
//
// We care less about steady-state latency here and more about:
//   - error rate during the spike (do we 5xx or hold?)
//   - recovery time (does p95 return to baseline after load drops?)

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { STATIC_TOKEN } from '../../lib/auth/quickpizza.js';
import { newPizzaRequest } from '../../lib/data/pizzaRequests.js';
import { spikeScenario } from '../../config/scenarios.js';
import { spikeSLO } from '../../config/thresholds.js';
import { pizzasGenerated } from '../../lib/metrics/custom.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

export const options = {
  scenarios: { spike: spikeScenario },
  thresholds: spikeSLO,
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'p(99.9)', 'max'],
};

export default function () {
  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), {
      token: STATIC_TOKEN,
      name: 'pizza during spike',
    });
    const ok = check(res, {
      'pizza: 2xx during spike': (r) => r.status >= 200 && r.status < 300,
      'pizza: parseable': (r) => parseJson(r) !== null,
    });
    if (ok) pizzasGenerated.add(1);
  });
}

export function handleSummary(data) {
  return buildSummary(data);
}
