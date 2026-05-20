// SLO catalog — single source of truth for threshold values.
// Each export is a k6 `thresholds` object ready to spread into `options`.
//
// Naming: <area>SLO. If you change a number here, every test using it is updated.
//
// Targets calibrated for QuickPizza's public deployment (quickpizza.grafana.com),
// which runs on modest resources. Self-hosted will be faster; loosen these via env if needed.

// Baseline SLOs that every test should satisfy.
export const baselineSLO = {
  // 99% of checks must pass — guards against silent regressions in business logic.
  checks: ['rate>0.99'],
  // No more than 1% of requests should return a non-2xx/3xx.
  http_req_failed: ['rate<0.01'],
};

// Public read-only browsing SLO — cheap endpoints, tight budget.
export const browseSLO = {
  ...baselineSLO,
  'http_req_duration{group:::browse}': ['p(95)<800', 'p(99)<1500'],
};

// Pizza-generation SLO — recommendation engine has measurable compute cost.
export const recommendSLO = {
  ...baselineSLO,
  'http_req_duration{group:::recommend}': ['p(95)<1200', 'p(99)<2500'],
};

// Authenticated write operations — looser budget due to DB writes.
export const writeSLO = {
  ...baselineSLO,
  'http_req_duration{group:::rate}': ['p(95)<900', 'p(99)<2000'],
};

// Auth flow SLO — login is on the hot path of every authenticated journey.
export const authSLO = {
  ...baselineSLO,
  'http_req_duration{group:::auth}': ['p(95)<1000', 'p(99)<2000'],
  login_success: ['rate>0.99'],
};

// Spike test — looser recovery budget; the question is whether we survive, not whether we're fast.
export const spikeSLO = {
  checks: ['rate>0.95'],
  http_req_failed: ['rate<0.05'],
  'http_req_duration{group:::recommend}': ['p(95)<3000'],
};

// Soak test — primary signal is non-degradation over time, not absolute speed.
export const soakSLO = {
  ...baselineSLO,
  http_req_duration: ['p(95)<1500'],
  http_req_failed: ['rate<0.01'],
};
