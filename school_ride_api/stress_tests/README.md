# SchoolFleet — Ping Endpoint Stress Tests

Tests target: `POST /api/trips/{id}/ping/`

All tests authenticate as a Driver, obtain a JWT, and hammer the GPS ping
endpoint with realistic payloads — wandering coordinates, random speed and
heading — at a realistic 3–7 second cadence between pings.

---

## Directory structure

```
stress_tests/
├── locust/
│   ├── locustfile.py     # Locust user class + tasks
│   └── scenarios.py      # RampShape, SoakShape, SpikeShape
└── k6/
    ├── ramp.js           # Gradual ramp — find the breaking point
    ├── soak.js           # Constant load — catch leaks and degradation
    ├── spike.js          # Sudden burst — simulate morning school rush
    └── reports/          # HTML reports written here after each run
```

---

## Prerequisites

### Locust
```bash
# Ubuntu 24.04 — install build dependencies first
# Python 3.12 (shipped with Ubuntu 24.04) needs these to compile some locust deps
sudo apt install -y python3-dev gcc

# From repo root, with env active
pip install locust

# Verify
locust --version
```

### k6
```bash
# macOS
brew install k6

# Ubuntu 24.04
sudo apt update
sudo apt install -y gnupg

# Add the k6 GPG key
curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg

# Add the repository
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list

# Install
sudo apt update
sudo apt install k6

# Verify
k6 version
```

---

## Before running any test

1. **The Django server must be running:**
   ```bash
   cd school_ride_api && python manage.py runserver
   ```

2. **Redis must be running** (required for Channels to broadcast pings):
   ```bash
   redis-server
   ```

3. **A Driver user must exist** with a known email + password.

4. **An active trip must exist** that the Driver owns.
   - Create a trip via the API or admin panel
   - Start it: `POST /api/trips/{id}/start/`
   - Note the trip `id` — you'll pass it as `TRIP_ID`

5. **Create the reports directory** (k6 writes HTML reports here):
   ```bash
   mkdir -p stress_tests/k6/reports
   ```

---

## Running with Locust

### Interactive UI mode (recommended for first run)

```bash
source env/bin/activate
locust -f stress_tests/locust/LocustFile.py,stress_tests/locust/Scenarios.py \
       --host http://127.0.0.1:8000 \
       --web-host 127.0.0.1
```

Then open **http://localhost:8089** in your browser.

Set:
- **Number of users:** start with 50
- **Spawn rate:** 5
- **Host:** http://127.0.0.1:8000

Hit **Start swarming** and watch the real-time charts.

---

### Headless (scripted / CI)

Set your credentials and trip ID via environment variables:

```bash
export DRIVER_EMAIL=driver@school.com
export DRIVER_PASSWORD=changeme
export TRIP_ID=1
```

**Ramp test:**
```bash
locust -f stress_tests/locust/LocustFile.py,stress_tests/locust/Scenarios.py \
       --host http://127.0.0.1:8000 \
       --web-host 127.0.0.1 \
       --headless \
       --run-time 6m \
       --users 200 --spawn-rate 10 \
       --csv stress_tests/locust/reports/ramp
```

**Soak test:**
```bash
locust -f stress_tests/locust/LocustFile.py,stress_tests/locust/Scenarios.py \
       --host http://127.0.0.1:8000 \
       --web-host 127.0.0.1 \
       --headless \
       --run-time 11m \
       --users 50 --spawn-rate 5 \
       --csv stress_tests/locust/reports/soak
```

**Spike test:**
```bash
locust -f stress_tests/locust/LocustFile.py,stress_tests/locust/Scenarios.py \
       --host http://127.0.0.1:8000 \
       --web-host 127.0.0.1 \
       --headless \
       --run-time 3m \
       --users 200 --spawn-rate 100 \
       --csv stress_tests/locust/reports/spike
```

CSV reports are written to `stress_tests/locust/reports/`.

---

## Running with k6

Pass credentials and trip ID as `-e` flags:

```bash
# Ramp
k6 run stress_tests/k6/ramp.js \
   -e BASE_URL=http://127.0.0.1:8000 \
   -e DRIVER_EMAIL=driver@school.com \
   -e DRIVER_PASSWORD=changeme \
   -e TRIP_ID=1

# Soak
k6 run stress_tests/k6/soak.js \
   -e BASE_URL=http://127.0.0.1:8000 \
   -e DRIVER_EMAIL=driver@school.com \
   -e DRIVER_PASSWORD=changeme \
   -e TRIP_ID=1

# Spike
k6 run stress_tests/k6/spike.js \
   -e BASE_URL=http://127.0.0.1:8000 \
   -e DRIVER_EMAIL=driver@school.com \
   -e DRIVER_PASSWORD=changeme \
   -e TRIP_ID=1
```

HTML reports are written to `stress_tests/k6/reports/` after each run.
Open them in any browser:

```bash
open stress_tests/k6/reports/ramp_report.html
```

---

## Scenario summary

| Scenario | Tool shape | Peak users | Duration | Purpose |
|---|---|---|---|---|
| **Ramp** | Gradual increase | 200 | ~6 min | Find the saturation point |
| **Soak** | Constant load | 50 | ~10 min | Catch memory leaks, DB pool exhaustion |
| **Spike** | Sudden burst | 200 | ~3 min | Simulate morning school rush |

---

## Thresholds — what pass/fail means

| Metric | Ramp | Soak | Spike |
|---|---|---|---|
| p(95) response time | < 500 ms | < 600 ms | < 1000 ms |
| p(99) response time | — | < 1000 ms | — |
| Error rate | < 1% | < 0.5% | < 2% |

k6 will print `✓` or `✗` next to each threshold at the end of a run.
Locust shows a red failure count in the UI and CSV.

---

## Reading the results

### Key numbers to look at

**Requests/second (RPS)** — how many pings the server handled per second.
The ping endpoint writes a `GPSPing` row, broadcasts via Channels, and
triggers a Celery notification task. A realistic target for a single Django
worker is 50–150 RPS. If RPS plateaus while users keep climbing, you've
hit the ceiling.

**p(95) response time** — 95% of requests completed in under this time.
Under 200 ms is excellent. 200–500 ms is acceptable. Over 500 ms under
moderate load suggests a bottleneck (DB, Celery queue, Redis).

**Error rate** — anything above 1% under moderate load needs investigation.
Common causes:
- `400` — trip is not active (check `TRIP_ID` is for a running trip)
- `401` — JWT expired; the scripts handle this by re-logging in
- `500` — Django exception, check `manage.py runserver` output
- Connection refused — Django crashed, check for OOM or DB pool exhaustion

### Ramp — look for the elbow
Plot RPS vs users. RPS climbs linearly, then flattens. The point where it
stops climbing is your saturation point. Response time will spike upward
at the same user count. That number tells you how many concurrent drivers
your current setup can handle.

### Soak — look for drift
Response time should stay flat for the full 10 minutes. If p(95) climbs
from 150 ms to 600 ms over 10 minutes with constant user count, you have
a resource leak — likely DB connections, Redis connections, or unclosed
file handles.

### Spike — look for recovery time
After the spike drops back to baseline (10 users), response time should
return to pre-spike levels within 30–60 seconds. If it takes longer, or
never recovers without a server restart, you have a queuing or connection
pool problem.

---

## Common issues

**`400 Bad Request` on every ping**
The trip is not active. Call `POST /api/trips/{TRIP_ID}/start/` first.

**`403 Forbidden`**
The user is not the driver assigned to that trip. Assign the driver in the
admin panel or create a trip with that driver as the owner.

**`401` not recovering**
The access token has expired and re-login is failing. Check that
`DRIVER_EMAIL` and `DRIVER_PASSWORD` are correct.

**Very low RPS (< 10) even at low user counts**
Celery is probably not running. The ping view broadcasts to Channels and
creates a notification — if Celery is backed up, DB transactions queue up.
Start the Celery worker before testing:
```bash
cd school_ride_api && celery -A api worker -l info
```

**k6 `ERRO` on htmlReport import**
k6 needs internet access to fetch the reporter bundle on first run.
If running offline, remove the `handleSummary` export or vendor the
bundle locally.
