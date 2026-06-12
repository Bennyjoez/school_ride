// stress_tests/k6/spike.js
//
// Sudden burst then drop — simulates all school buses departing at once
// during morning pick-up (e.g. 150 drivers all start trips within 2 minutes).
// Checks whether the system can absorb a sudden surge and recover cleanly.
//
// Run:
//   k6 run stress_tests/k6/spike.js \
//      -e BASE_URL=http://127.0.0.1:8000 \
//      -e DRIVER_EMAIL=driver1@gmail.com \
//      -e DRIVER_PASSWORD=REDACTED_PASSWORD \
//      -e TRIP_ID=1

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
    { duration: "30s", target: 10 }, // baseline — normal morning traffic
    { duration: "30s", target: 200 }, // spike    — all buses depart at once
    { duration: "1m", target: 200 }, // sustain  — peak load held briefly
    { duration: "30s", target: 10 }, // recover  — most buses are en-route, pings slow
    { duration: "30s", target: 0 }, // drain
  ],
  thresholds: {
    // During the spike, allow higher latency — we care that it recovers,
    // not that it's fast at 200 users
    ping_duration_ms: ["p(95)<1000"],
    // Error rate must stay under 2% even during the spike
    ping_error_rate: ["rate<0.02"],
    http_req_failed: ["rate<0.02"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const EMAIL = __ENV.DRIVER_EMAIL || "driver1@gmail.com";
const PASSWORD = __ENV.DRIVER_PASSWORD || "REDACTED_PASSWORD";
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
    "response < 1000ms": (r) => r.timings.duration < 1000,
  });

  if (!ok) {
    pingErrorRate.add(1);
    if (res.status === 401) _token = null;
  } else {
    pingErrorRate.add(0);
  }

  // During a spike drivers are more frantic — shorter sleep
  sleep(2 + Math.random() * 3);
}

export function handleSummary(data) {
  return {
    "stress_tests/k6/reports/spike_report.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
