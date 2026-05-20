// Per-environment configuration. Tests select via `__ENV.ENV` (defaults to 'staging').
// Add new environments by adding a key here — do not hardcode URLs in test files.

const environments = {
  staging: {
    name: 'staging',
    baseUrl: 'https://quickpizza.grafana.com',
    // QuickPizza is Grafana's public k6 demo target — explicitly maintained for load testing,
    // no rate limits, no ToS concerns. See: https://github.com/grafana/quickpizza
  },
  local: {
    name: 'local',
    baseUrl: 'http://localhost:3333',
    // Self-hosted QuickPizza — run via `docker compose up` from the QuickPizza repo,
    // or pull the image directly: `docker run -p 3333:3333 ghcr.io/grafana/quickpizza-local:latest`.
  },
};

export function getEnv() {
  const key = (__ENV.ENV || 'staging').toLowerCase();
  const env = environments[key];
  if (!env) {
    throw new Error(`Unknown ENV "${key}". Valid: ${Object.keys(environments).join(', ')}`);
  }
  return env;
}
