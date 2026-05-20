// User fixtures via SharedArray — loaded once and shared across all VUs to avoid
// per-VU memory bloat. Each VU picks a user round-robin by VU id.
//
// Note: QuickPizza ships with one default seeded user (default/12345678). The fixture file
// here exists so tests can be parameterized over multiple credentials when running against
// a self-hosted QuickPizza with extra seeded users.

import { SharedArray } from 'k6/data';

export const users = new SharedArray('users', () => {
  return JSON.parse(open('../../fixtures/users.json'));
});

// Round-robin pick — VU 1 gets users[0], VU 2 gets users[1], etc.
// Avoids the thundering-herd problem of every VU logging in as the same user.
export function pickUser(vuId = __VU) {
  return users[(vuId - 1) % users.length];
}
