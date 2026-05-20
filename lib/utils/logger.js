// Lightweight structured logger. Off by default; enable with `-e LOG_LEVEL=debug`.
//
// k6's stdout is the test summary surface; we don't want log noise polluting it during normal runs.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[(__ENV.LOG_LEVEL || 'warn').toLowerCase()] || LEVELS.warn;

function log(level, msg, fields = {}) {
  if (LEVELS[level] < currentLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    vu: __VU,
    iter: __ITER,
    msg,
    ...fields,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg, fields) => log('debug', msg, fields),
  info: (msg, fields) => log('info', msg, fields),
  warn: (msg, fields) => log('warn', msg, fields),
  error: (msg, fields) => log('error', msg, fields),
};
