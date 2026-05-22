// Custom handleSummary — writes:
//   - Pretty HTML report (via k6-reporter, loaded from jsDelivr at runtime)
//   - JUnit XML for CI consumption
//   - JSON summary for further analysis
//   - Console summary (preserved)
//
// Output paths are controlled by env vars so make targets can route them to timestamped files.

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
// Pinned to a tagged release (not `main`) so a downstream change in the reporter
// repo can't silently break our HTML output. Bump the version explicitly when
// you've reviewed the release notes.
import { htmlReport } from 'https://cdn.jsdelivr.net/gh/benc-uk/k6-reporter@2.4.0/dist/bundle.js';

export function buildSummary(data) {
  const htmlPath = __ENV.K6_SUMMARY_HTML || 'results/summary.html';
  const jsonPath = __ENV.K6_SUMMARY_JSON || 'results/summary.json';

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [htmlPath]: htmlReport(data),
    [jsonPath]: JSON.stringify(data, null, 2),
  };
}
