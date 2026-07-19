/**
 * k6 smoke — read-heavy endpoints (Phase 7.10)
 *
 * Usage:
 *   k6 run -e BASE_URL=https://api.example.com -e TOKEN=eyJ... load/k6-smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";
const TOKEN = __ENV.TOKEN || "dev.test-user";

export default function () {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  const health = http.get(`${BASE}/v1/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  const me = http.get(`${BASE}/v1/users/me`, { headers });
  check(me, { "me ok-or-404": (r) => r.status === 200 || r.status === 404 });

  const articles = http.get(`${BASE}/v1/content/articles`, { headers });
  check(articles, {
    "articles ok-or-auth": (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,
  });

  sleep(1);
}
