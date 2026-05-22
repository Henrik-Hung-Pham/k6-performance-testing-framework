// Optional deterministic RNG.
//
// Default behavior: `random()` is just `Math.random()`. Test runs differ
// from each other, which is what you want most of the time.
//
// Set SEED=<anything> to get reproducible runs. Each VU is seeded with
// SEED + __VU, so iterations remain distinguishable across VUs (no
// lockstep dice rolls) but the same SEED produces the same dice rolls
// across runs. Useful when bisecting a flaky test, comparing two
// versions of the SUT, or producing screenshots for a PR.
//
// k6 instantiates this module once per VU, so the PRNG is lazily
// initialized on first use (since __VU is 0 during the init phase).

const SEED = __ENV.SEED;

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

let next = null;

export function random() {
  if (!SEED) return Math.random();
  if (next === null) {
    const numericSeed = Number.isFinite(Number(SEED)) ? Number(SEED) : hashString(String(SEED));
    next = mulberry32((numericSeed + __VU) | 0);
  }
  return next();
}

export function randInt(minInclusive, maxInclusive) {
  return Math.floor(random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export function pickOne(arr) {
  return arr[Math.floor(random() * arr.length)];
}

// Sample up to `max` items from arr without replacement.
export function sample(arr, max) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(max, copy.length));
}
