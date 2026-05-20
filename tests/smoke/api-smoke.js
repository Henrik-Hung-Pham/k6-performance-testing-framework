// Smoke test — sanity check that QuickPizza is alive and the core flow works end-to-end.
// Runs in <1 min with 1 VU. Gate for CI: if smoke fails, no other tests should run.
//
// Flow: browse ratings → generate pizza → submit rating.
//
// Run:  k6 run tests/smoke/api-smoke.js
//       make smoke

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { STATIC_TOKEN } from '../../lib/auth/quickpizza.js';
import { newPizzaRequest, newRating } from '../../lib/data/pizzaRequests.js';
import { smokeScenario } from '../../config/scenarios.js';
import { pizzasGenerated, ratingsSubmitted } from '../../lib/metrics/custom.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

export const options = {
  scenarios: { smoke: smokeScenario },
  thresholds: {
    // Smoke must be perfect. Any failure is a real regression.
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0.0'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  let pizzaId = null;

  group('browse', () => {
    const ratings = apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings' });
    check(ratings, {
      'ratings: 200': (r) => r.status === 200,
      'ratings: returns array': (r) => {
        const body = parseJson(r);
        return body && Array.isArray(body.ratings);
      },
    });
  });

  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), {
      token: STATIC_TOKEN,
      name: 'recommend pizza',
    });
    const ok = check(res, {
      'pizza: 200': (r) => r.status === 200,
      'pizza: has id': (r) => {
        const body = parseJson(r);
        return body && body.pizza && typeof body.pizza.id === 'number';
      },
      'pizza: has ingredients': (r) => {
        const body = parseJson(r);
        return body && body.pizza && Array.isArray(body.pizza.ingredients);
      },
    });
    if (ok) {
      pizzaId = parseJson(res).pizza.id;
      pizzasGenerated.add(1);
    }
  });

  if (pizzaId === null) return;

  group('rate', () => {
    const res = apiClient.post('/api/ratings', newRating(pizzaId), {
      token: STATIC_TOKEN,
      name: 'submit rating',
    });
    const ok = check(res, {
      'rating: 201 created': (r) => r.status === 201,
    });
    if (ok) ratingsSubmitted.add(1);
  });
}

export function handleSummary(data) {
  return buildSummary(data);
}
