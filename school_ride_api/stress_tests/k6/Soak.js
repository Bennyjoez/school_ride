// stress_tests/k6/soak.js
//
// Constant load for 10 minutes.
// Purpose: catch memory leaks, DB connection pool exhaustion, and
// gradual degradation that only shows up under sustained pressure.
//
// Run:
//   k6 run stress_tests/k6/soak.js \
//      -e BASE_URL \
//      -e DRIVER_EMAIL \
//      -e DRIVER_PASSWORD \
//      -e TRIP_ID=7

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

const pingErrorRate = new Rate("ping_error_rate");
const pingDuration = new Trend("ping_duration_ms", true);
const pingCount = new Counter("ping_total");

export const options = {
  stages: [
    { duration: "1m", target: 50 }, // warm-up: ramp to 50
    { duration: "9m", target: 50 }, // soak: hold 50 users for 9 minutes
    { duration: "30s", target: 0 }, // drain
  ],
  thresholds: {
    // During a soak, response time should stay flat - any upward trend
    // indicates a resource leak. p(99) threshold is looser than ramp.
    ping_duration_ms: ["p(95)<600", "p(99)<1000"],
    ping_error_rate: ["rate<0.005"],
    http_req_failed: ["rate<0.005"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const TRIP_ID = __ENV.TRIP_ID || "7";
const EMAIL = __ENV.DRIVER_EMAIL;
const PASSWORD = __ENV.DRIVER_PASSWORD;

// Fail early if secrets are missing so the script doesn't send blank requests
if (!EMAIL || !PASSWORD) {
  throw new Error("❌ Security Halt: DRIVER_EMAIL and DRIVER_PASSWORD environment variables must be provided.");
}

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

let _token = null;

export default function () {
  if (!_token) {
    _token = login();
  }

  const payload = JSON.stringify({
    latitude: (-1.2921 + randomOffset()).toFixed(6),
    longitude: (36.8219 + randomOffset()).toFixed(6),
    speed_kmh: (Math.random() * 80).toFixed(2),
    heading: (Math.random() * 360).toFixed(2),
    recorded_at: new Date().toISOString(),
  });

  const res = http.post(`${BASE_URL}/api/trips/${TRIP_ID}/ping/`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_token}`,
    },
    tags: { name: "POST /api/trips/{id}/ping/" },
  });

  pingDuration.add(res.timings.duration);
  pingCount.add(1);

  const ok = check(res, {
    "ping 201": (r) => r.status === 201,
    "response < 600ms": (r) => r.timings.duration < 600,
  });

  if (!ok) {
    pingErrorRate.add(1);
    if (res.status === 401) _token = null;
  } else {
    pingErrorRate.add(0);
  }

  sleep(3 + Math.random() * 4);
}

export function handleSummary(data) {
  return {
    "stress_tests/k6/reports/soak_report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
