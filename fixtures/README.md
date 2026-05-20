# Fixtures

JSON data loaded into K6 tests via `SharedArray` (see [lib/data/](../lib/data/)).

## `users.json`

Pool of test users for authenticated flows. Each VU picks one round-robin via
`pickUser(__VU)` to avoid the thundering-herd problem of every VU logging in as
the same account.

QuickPizza's public deployment ships with one seeded user (`default` / `12345678`).
For self-hosted QuickPizza with custom seed data, expand this file with the
matching credentials.

For tests that don't need a real login round-trip, prefer the static token
exposed as `STATIC_TOKEN` in [lib/auth/quickpizza.js](../lib/auth/quickpizza.js) —
that's the official QuickPizza dev token (`abcdef0123456789`) used in all upstream
k6 examples. It removes login overhead from tests where auth isn't the focus.
