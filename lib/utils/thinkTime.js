// Realistic think time helpers. A flat `sleep(1)` after every request is the most common
// k6 anti-pattern — real users have variable pauses.

import { sleep } from 'k6';

// Jittered sleep between min and max seconds (uniform distribution).
export function jitteredSleep(minSec = 1, maxSec = 3) {
  const delay = minSec + Math.random() * (maxSec - minSec);
  sleep(delay);
}

// Log-normal think time — better model of human behavior (most pauses short, occasional long ones).
// medianSec controls the typical pause; sigma controls the spread.
export function humanThinkTime(medianSec = 2, sigma = 0.5) {
  // Box-Muller for a normal sample, then exp for log-normal.
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const delay = Math.exp(Math.log(medianSec) + sigma * normal);
  // Clamp to avoid 10-minute pauses.
  sleep(Math.min(Math.max(delay, 0.1), 15));
}
