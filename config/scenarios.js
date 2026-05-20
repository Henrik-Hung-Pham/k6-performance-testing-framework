// Reusable scenario presets. Compose into `options.scenarios` to keep test files focused on flow,
// not load-shape arithmetic.
//
// Convention: arrival-rate (open model) for API tests by default — it exposes queueing behavior
// that VU-based (closed model) hides behind back-pressure.
//
// Rates are deliberately moderate — QuickPizza's public deployment is a shared resource.
// For self-hosted load testing, scale these up via env overrides.

export const smokeScenario = {
  executor: 'per-vu-iterations',
  vus: 1,
  iterations: 5,
  maxDuration: '1m',
  tags: { test_type: 'smoke' },
};

export const loadScenario = {
  executor: 'ramping-arrival-rate',
  startRate: 5,
  timeUnit: '1s',
  preAllocatedVUs: 30,
  maxVUs: 100,
  stages: [
    { duration: '1m', target: 20 },    // ramp to expected peak
    { duration: '3m', target: 20 },    // hold at peak
    { duration: '1m', target: 0 },     // ramp down
  ],
  tags: { test_type: 'load' },
};

export const stressScenario = {
  executor: 'ramping-arrival-rate',
  startRate: 10,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 300,
  stages: [
    { duration: '1m', target: 30 },    // baseline
    { duration: '2m', target: 80 },    // above peak
    { duration: '2m', target: 150 },   // stress
    { duration: '2m', target: 150 },   // hold
    { duration: '1m', target: 0 },     // recover
  ],
  tags: { test_type: 'stress' },
};

export const spikeScenario = {
  executor: 'ramping-arrival-rate',
  startRate: 5,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 500,
  stages: [
    { duration: '30s', target: 5 },    // warm-up
    { duration: '10s', target: 200 },  // 40x spike
    { duration: '45s', target: 200 },  // hold spike
    { duration: '20s', target: 5 },    // recovery
    { duration: '30s', target: 5 },    // observe recovery
  ],
  tags: { test_type: 'spike' },
};

export const soakScenario = {
  executor: 'constant-arrival-rate',
  rate: 10,
  timeUnit: '1s',
  duration: '2h',
  preAllocatedVUs: 30,
  maxVUs: 100,
  tags: { test_type: 'soak' },
};

export const breakpointScenario = {
  executor: 'ramping-arrival-rate',
  startRate: 5,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 1000,
  stages: [
    // Slow, monotonic ramp — abort via threshold when SLO breaks.
    { duration: '20m', target: 500 },
  ],
  tags: { test_type: 'breakpoint' },
};
