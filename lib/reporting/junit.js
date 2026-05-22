// JUnit XML transform for the k6 end-of-test summary.
//
// Maps two things from `data` into JUnit testcases:
//   1. Threshold rules     — one testcase per "metric | rule", failed if !ok
//   2. Checks               — one testcase per check, failed if any iteration failed
//
// Output is Maven Surefire-compatible — GitHub Actions, CircleCI, Jenkins,
// Buildkite, and GitLab all ingest this dialect without further translation.

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function thresholdCases(metrics) {
  const cases = [];
  for (const [metric, m] of Object.entries(metrics || {})) {
    if (!m.thresholds) continue;
    for (const [rule, result] of Object.entries(m.thresholds)) {
      const name = `${metric} | ${rule}`;
      const failed = result && result.ok === false;
      cases.push({
        classname: 'thresholds',
        name,
        failed,
        message: failed ? `threshold "${rule}" on metric "${metric}" failed` : null,
      });
    }
  }
  return cases;
}

function walkChecks(group, out = []) {
  for (const c of group.checks || []) {
    const failed = c.fails > 0;
    out.push({
      classname: `checks${group.path ? group.path.replace(/::/g, '.') : ''}`,
      name: c.name,
      failed,
      message: failed ? `${c.fails} of ${c.passes + c.fails} iterations failed check` : null,
    });
  }
  for (const child of group.groups || []) walkChecks(child, out);
  return out;
}

export function toJUnit(data) {
  const cases = [...thresholdCases(data.metrics), ...walkChecks(data.root_group || {})];
  const tests = cases.length;
  const failures = cases.filter((c) => c.failed).length;
  const time = ((data.state && data.state.testRunDurationMs) || 0) / 1000;

  const body = cases
    .map((c) => {
      const open = `<testcase classname="${escapeXml(c.classname)}" name="${escapeXml(c.name)}">`;
      const fail = c.failed
        ? `<failure message="${escapeXml(c.message)}"/>`
        : '';
      return `    ${open}${fail}${c.failed ? '' : ''}</testcase>`;
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<testsuites name="k6" tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">\n` +
    `  <testsuite name="k6" tests="${tests}" failures="${failures}" time="${time.toFixed(3)}">\n` +
    `${body}\n` +
    `  </testsuite>\n` +
    `</testsuites>\n`
  );
}
