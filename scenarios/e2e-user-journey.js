// End-to-end user journey — composite scenario with realistic journey mix.
//
// Models three user personas running concurrently, weighted by traffic share:
//   - 70% browser       : view ratings only (anonymous-ish browsing)
//   - 20% engaged user  : browse + generate a pizza (visitor exploring)
//   - 10% power user    : full flow — login + generate + rate
//
// Each persona runs in its own scenario with its own arrival rate, sharing the same SUT.
// This is the test you run when someone asks "what does our actual traffic look like?".

import { check, group } from 'k6';
import { apiClient, parseJson } from '../lib/http/client.js';
import { STATIC_TOKEN, login } from '../lib/auth/quickpizza.js';
import { newPizzaRequest, newRating } from '../lib/data/pizzaRequests.js';
import { humanThinkTime, jitteredSleep } from '../lib/utils/thinkTime.js';
import {
  journeyDuration,
  journeysCompleted,
  pizzasGenerated,
  ratingsSubmitted,
} from '../lib/metrics/custom.js';
import { baselineSLO } from '../config/thresholds.js';
import { buildSummary } from '../lib/reporting/handleSummary.js';

export const options = {
  scenarios: {
    browser_persona: {
      executor: 'ramping-arrival-rate',
      exec: 'browserJourney',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 30,
      maxVUs: 100,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '4m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      tags: { persona: 'browser' },
    },
    engaged_persona: {
      executor: 'ramping-arrival-rate',
      exec: 'engagedJourney',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 60,
      stages: [
        { duration: '1m', target: 6 },
        { duration: '4m', target: 6 },
        { duration: '1m', target: 0 },
      ],
      tags: { persona: 'engaged' },
    },
    power_persona: {
      executor: 'ramping-arrival-rate',
      exec: 'powerJourney',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { duration: '1m', target: 3 },
        { duration: '4m', target: 3 },
        { duration: '1m', target: 0 },
      ],
      tags: { persona: 'power' },
    },
  },
  thresholds: {
    ...baselineSLO,
    'http_req_duration{persona:browser}': ['p(95)<800'],
    'http_req_duration{persona:engaged}': ['p(95)<1500'],
    'http_req_duration{persona:power}': ['p(95)<2500'],
    'journey_duration_ms{persona:browser}': ['p(95)<4000'],
    'journey_duration_ms{persona:engaged}': ['p(95)<7000'],
    'journey_duration_ms{persona:power}': ['p(95)<12000'],
    journeys_completed: ['count>300'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function browserJourney() {
  const start = Date.now();
  group('browse', () => {
    const ratings = apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings' });
    check(ratings, { 'ratings: 200': (r) => r.status === 200 });
    humanThinkTime(2, 0.4);
    // Second look (refresh after scroll).
    apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings (refresh)' });
  });
  journeyDuration.add(Date.now() - start, { persona: 'browser' });
  journeysCompleted.add(1, { persona: 'browser' });
  humanThinkTime(3, 0.6);
}

export function engagedJourney() {
  const start = Date.now();
  group('browse', () => {
    apiClient.get('/api/ratings', { token: STATIC_TOKEN, name: 'list ratings' });
  });
  humanThinkTime(3, 0.5);

  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), {
      token: STATIC_TOKEN,
      name: 'pizza',
    });
    if (check(res, { 'pizza: 200': (r) => r.status === 200 })) {
      pizzasGenerated.add(1);
    }
  });

  journeyDuration.add(Date.now() - start, { persona: 'engaged' });
  journeysCompleted.add(1, { persona: 'engaged' });
  jitteredSleep(2, 5);
}

export function powerJourney() {
  const start = Date.now();
  const token = login();
  if (!token) return;

  let pizzaId = null;
  group('recommend', () => {
    const res = apiClient.post('/api/pizza', newPizzaRequest(), { token, name: 'pizza' });
    if (check(res, { 'pizza: 200': (r) => r.status === 200 })) {
      const body = parseJson(res);
      pizzaId = body && body.pizza && body.pizza.id;
      if (pizzaId) pizzasGenerated.add(1);
    }
  });
  if (!pizzaId) return;

  humanThinkTime(2, 0.5);

  group('rate', () => {
    const res = apiClient.post('/api/ratings', newRating(pizzaId), { token, name: 'rate' });
    if (check(res, { 'rate: 201': (r) => r.status === 201 })) {
      ratingsSubmitted.add(1);
    }
  });

  journeyDuration.add(Date.now() - start, { persona: 'power' });
  journeysCompleted.add(1, { persona: 'power' });
}

// k6 requires a default export when scenarios reference named exec functions only;
// this is a no-op fallback that will never be invoked.
export default function () {}

export function handleSummary(data) {
  return buildSummary(data);
}
