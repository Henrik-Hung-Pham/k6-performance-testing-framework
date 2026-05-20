// Load test — full pizza lifecycle at expected peak.
//
// Question this test answers:
//   "When 15 users/sec each generate a pizza and submit a rating, do per-request p95s stay
//    under SLO and does the full lifecycle complete cleanly?"
//
// Tokens cached per-VU so we don't re-login every iteration (matches real session behavior).

import { check, group } from 'k6';
import { apiClient, parseJson } from '../../lib/http/client.js';
import { login } from '../../lib/auth/quickpizza.js';
import { newPizzaRequest, newRating } from '../../lib/data/pizzaRequests.js';
import { jitteredSleep } from '../../lib/utils/thinkTime.js';
import { writeSLO, recommendSLO } from '../../config/thresholds.js';
import {
  pizzasGenerated,
  pizzaIngredientCount,
  pizzaCalories,
  ratingsSubmitted,
  journeyDuration,
  journeysCompleted,
} from '../../lib/metrics/custom.js';
import { buildSummary } from '../../lib/reporting/handleSummary.js';

export const options = {
  scenarios: {
    pizza_lifecycle: {
      executor: 'ramping-arrival-rate',
      startRate: 3,
      timeUnit: '1s',
      preAllocatedVUs: 30,
      maxVUs: 80,
      stages: [
        { duration: '1m', target: 8 },
        { duration: '3m', target: 15 },
        { duration: '3m', target: 15 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'load' },
    },
  },
  thresholds: {
    ...writeSLO,
    ...recommendSLO,
    journeys_completed: ['count>200'],
    'journey_duration_ms{flow:pizza}': ['p(95)<4000'],
  },
};

export default function () {
  const start = Date.now();
  const token = login();
  if (!token) return;

  let pizzaId = null;
  let lifecycleOk = true;

  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), { token, name: 'pizza' });
    const ok = check(res, {
      'pizza: 200': (r) => r.status === 200,
      'pizza: has id': (r) => {
        const body = parseJson(r);
        return body && body.pizza && typeof body.pizza.id === 'number';
      },
    });
    if (!ok) { lifecycleOk = false; return; }

    const body = parseJson(res);
    pizzaId = body.pizza.id;
    pizzasGenerated.add(1);
    pizzaIngredientCount.add(body.pizza.ingredients.length);
    pizzaCalories.add(body.calories);
  });

  if (!pizzaId) return;

  jitteredSleep(0.5, 1.5);

  group('rate', () => {
    const res = apiClient.post('/api/ratings', newRating(pizzaId), { token, name: 'rate' });
    const ok = check(res, { 'rate: 201': (r) => r.status === 201 });
    if (ok) ratingsSubmitted.add(1);
    else lifecycleOk = false;
  });

  journeyDuration.add(Date.now() - start, { flow: 'pizza' });
  if (lifecycleOk) journeysCompleted.add(1, { flow: 'pizza' });
}

export function handleSummary(data) {
  return buildSummary(data);
}
