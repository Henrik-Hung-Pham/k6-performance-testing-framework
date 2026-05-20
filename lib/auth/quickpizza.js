// QuickPizza auth helpers. Two modes:
//
// 1. Static token (default, no login overhead) — QuickPizza ships a dev token `abcdef0123456789`
//    that's hardcoded on the server for load-testing convenience. Use for read/write tests where
//    auth isn't the focus.
//
// 2. CSRF + login flow — exercises the real auth path. Use for tests that should include
//    login latency in the journey (e.g., e2e, stress on auth).
//
// Endpoints:
//   POST /api/csrf-token            -> sets csrf_token cookie
//   POST /api/users/token/login     -> { token } (requires csrf in body)

import { check, group } from 'k6';
import { apiClient, parseJson } from '../http/client.js';
import { loginSuccess } from '../metrics/custom.js';

// QuickPizza's dev token — see https://github.com/grafana/quickpizza
// Used by every k6 example in the upstream repo.
export const STATIC_TOKEN = 'abcdef0123456789';

// Default seeded user — see QuickPizza server fixtures.
export const DEFAULT_USER = { username: 'default', password: '12345678' };

const tokenCache = new Map(); // VU-scoped (k6 isolates module state per VU)

// Fetch a CSRF token, then login, returning the auth token. Caches per-VU per-user.
export function login(user = DEFAULT_USER) {
  const cached = tokenCache.get(user.username);
  if (cached) return cached;

  let token = null;
  group('auth', () => {
    const csrfRes = apiClient.post('/api/csrf-token', null, { name: 'csrf' });
    const csrfOk = check(csrfRes, { 'csrf: 200': (r) => r.status === 200 });
    if (!csrfOk) {
      loginSuccess.add(false);
      return;
    }

    const csrfCookie = csrfRes.cookies && csrfRes.cookies.csrf_token;
    const csrf = csrfCookie && csrfCookie[0] && csrfCookie[0].value;
    if (!csrf) {
      loginSuccess.add(false);
      return;
    }

    const loginRes = apiClient.post(
      '/api/users/token/login',
      { username: user.username, password: user.password, csrf },
      { name: 'login' }
    );
    const ok = check(loginRes, {
      'login: 200 ok': (r) => r.status === 200,
      'login: returns token': (r) => {
        const body = parseJson(r);
        return body && typeof body.token === 'string';
      },
    });
    loginSuccess.add(ok);

    if (ok) token = parseJson(loginRes).token;
  });

  if (token) tokenCache.set(user.username, token);
  return token;
}

export function clearTokenCache() {
  tokenCache.clear();
}
