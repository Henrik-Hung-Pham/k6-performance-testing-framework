// Custom metrics — business-meaningful signals on top of k6's built-in HTTP metrics.
//
// Why custom metrics matter for a portfolio: they show you think in SLOs and journeys,
// not just request latency. A hiring manager scanning the summary should immediately see
// "login_success: 99.4%" and understand what's being measured.

import { Counter, Rate, Trend } from 'k6/metrics';

// Per-endpoint failure counter — augments http_req_failed with endpoint + status tags
// so failures can be sliced in Grafana.
export const httpErrors = new Counter('http_errors_total');

// Auth success rate — visible at-a-glance in summary.
export const loginSuccess = new Rate('login_success');

// End-to-end journey latency — sum of all requests in a flow, recorded once per iteration.
// Tracks the *user-perceived* time, not just per-request latency.
export const journeyDuration = new Trend('journey_duration_ms', true);

// Business-domain metrics — QuickPizza specific.
export const pizzasGenerated = new Counter('pizzas_generated');
export const pizzaIngredientCount = new Trend('pizza_ingredient_count');
export const pizzaCalories = new Trend('pizza_calories');
export const ratingsSubmitted = new Counter('ratings_submitted');

// Business-flow counters — answers "how many full journeys did we complete?".
export const journeysCompleted = new Counter('journeys_completed');
