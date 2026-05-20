// Thin wrapper around k6/http that:
//   - injects baseUrl + auth headers (QuickPizza uses `Authorization: token <X>`, not Bearer)
//   - applies a default check on every response
//   - records a custom failure metric so we can break down failures by endpoint
//
// Tests use this instead of calling `http` directly, so retries, logging, and metrics stay consistent.

import http from 'k6/http';
import { check } from 'k6';
import { getEnv } from '../../config/environments.js';
import { httpErrors } from '../metrics/custom.js';

const env = getEnv();

function buildUrl(path) {
  if (path.startsWith('http')) return path;
  return `${env.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildParams(params = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(params.headers || {}),
  };
  // QuickPizza expects `Authorization: token <X>` (lower-case "token"), not "Bearer".
  if (token) headers.Authorization = `token ${token}`;
  return { ...params, headers };
}

function recordOutcome(res, name) {
  const ok = check(res, {
    [`${name}: status is success`]: (r) => r.status >= 200 && r.status < 400,
  });
  if (!ok) {
    httpErrors.add(1, { endpoint: name, status: String(res.status) });
  }
  return ok;
}

export const apiClient = {
  get(path, { token, params, name } = {}) {
    const res = http.get(buildUrl(path), buildParams(params, token));
    recordOutcome(res, name || path);
    return res;
  },

  post(path, body, { token, params, name } = {}) {
    const payload = body === null || body === undefined
      ? null
      : (typeof body === 'string' ? body : JSON.stringify(body));
    const res = http.post(buildUrl(path), payload, buildParams(params, token));
    recordOutcome(res, name || path);
    return res;
  },

  put(path, body, { token, params, name } = {}) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const res = http.put(buildUrl(path), payload, buildParams(params, token));
    recordOutcome(res, name || path);
    return res;
  },

  patch(path, body, { token, params, name } = {}) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const res = http.patch(buildUrl(path), payload, buildParams(params, token));
    recordOutcome(res, name || path);
    return res;
  },

  del(path, { token, params, name } = {}) {
    const res = http.del(buildUrl(path), null, buildParams(params, token));
    recordOutcome(res, name || path);
    return res;
  },
};

// Safe JSON parse — QuickPizza occasionally returns plain-text errors on misuse.
export function parseJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}
