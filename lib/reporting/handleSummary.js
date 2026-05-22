// Custom handleSummary — writes:
//   - Pretty HTML report (via k6-reporter, loaded from jsDelivr at runtime)
//   - JUnit XML for CI consumption (Surefire dialect — universally ingested)
//   - JSON summary for further analysis
//   - Console summary (preserved)
//
// Output paths are controlled by env vars so make targets can route them to timestamped files.

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { toJUnit } from './junit.js';

export function buildSummary(data) {
  const htmlPath = __ENV.K6_SUMMARY_HTML || 'results/summary.html';
  const jsonPath = __ENV.K6_SUMMARY_JSON || 'results/summary.json';
  const junitPath = __ENV.K6_SUMMARY_JUNIT || 'results/summary.xml';

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [htmlPath]: htmlReport(data),
    [jsonPath]: JSON.stringify(data, null, 2),
    [junitPath]: toJUnit(data),
  };
}
