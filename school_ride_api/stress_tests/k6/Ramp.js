// stress_tests/k6/ramp.js
//
// Gradual ramp-up to find the breaking point.
//
// Install k6: https://grafana.com/docs/grafana-cloud/testing/k6/get-started/
//   sudo apt install k6       (Linux)
//
// Run:
// k6 run stress_tests/k6/ramp.js \
//    -e BASE_URL=http://127.0.0.1:8000 \
//    -e DRIVER_EMAIL=ENV['DRIVER_EMAIL'] \
//    -e DRIVER_PASSWORD=ENV[`PASS'] \
//    -e TRIP_ID=7
//
// Output: terminal summary + ramp.html report (open in browser)

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// Custom metrics
const pingErrorRate = new Rate("ping_error_rate");
const pingDuration = new Trend("ping_duration_ms", true);
const pingCount = new Counter("ping_total");

// Scenario config
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // warm-up
    { duration: "30s", target: 25 },
    { duration: "60s", target: 50 },
    { duration: "60s", target: 100 },
    { duration: "60s", target: 150 },
    { duration: "60s", target: 200 },
    { duration: "30s", target: 0 }, // drain
  ],
  thresholds: {
    // 95th percentile response time must stay under 500 ms
    ping_duration_ms: ["p(95)<500"],
    // Error rate must stay under 1%
    ping_error_rate: ["rate<0.01"],
    // Built-in: overall HTTP failure rate
    http_req_failed: ["rate<0.01"],
  },
};

// Helpers
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const EMAIL = __ENV.DRIVER_EMAIL || "ENV['DRIVER_EMAIL']";
const PASSWORD = __ENV.DRIVER_PASSWORD || "ENV[`PASS']";
const TRIP_ID = __ENV.TRIP_ID || "7";

function login() {
  const res = http.post(
    `${BASE_URL}/api/auth/login/`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "login 200": (r) => r.status === 200 });
  return res.json("access");
}

function randomOffset() {
  return (Math.random() - 0.5) * 0.01;
}

// Per-VU setup (runs once per virtual user)
export function setup() {
  // Login once and share token across all VUs via returned data
  // Note: k6 setup() runs once total; for per-VU tokens use init context below
  return { token: login() };
}

// Main scenario
let _token = null;

export default function (data) {
  // Lazy per-VU login (k6 setup() data is read-only shared state)
  if (!_token) {
    _token = login();
  }

  const lat = -1.2921 + randomOffset();
  const lng = 36.8219 + randomOffset();
  const payload = JSON.stringify({
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
    speed_kmh: (Math.random() * 80).toFixed(2),
    heading: (Math.random() * 360).toFixed(2),
    recorded_at: new Date().toISOString(),
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/trips/${TRIP_ID}/ping/`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_token}`,
    },
    tags: { name: "POST /api/trips/{id}/ping/" },
  });
  const elapsed = Date.now() - start;

  pingDuration.add(elapsed);
  pingCount.add(1);

  const ok = check(res, {
    "ping 201": (r) => r.status === 201,
    "response < 500ms": (r) => r.timings.duration < 500,
  });

  if (!ok) {
    pingErrorRate.add(1);
    if (res.status === 401) {
      // Token expired - re-login next iteration
      _token = null;
    }
  } else {
    pingErrorRate.add(0);
  }

  // Realistic driver ping cadence: 3–7 seconds between pings
  sleep(3 + Math.random() * 4);
}

// Reports
export function handleSummary(data) {
  return {
    "stress_tests/k6/reports/ramp_report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
