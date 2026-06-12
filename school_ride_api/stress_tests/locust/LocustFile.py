# stress_tests/locust/locustfile.py
#
# Place at: stress_tests/locust/locustfile.py (repo root level)
#
# Install:  pip install locust
# Run UI:   locust -f stress_tests/locust/locustfile.py
#           then open http://localhost:8089
#
# Run headless (CI / scripted):
#   locust -f stress_tests/locust/locustfile.py \
#          --headless --host http://127.0.0.1:8000 \
#          -u 50 -r 5 --run-time 2m
#
# Scenario flags — set via environment variables:
#   SCENARIO=ramp    (default) gradual ramp — find the breaking point
#   SCENARIO=soak    constant load — sustain X users for a duration
#   SCENARIO=spike   sudden burst — hammer then drop
#
#   DRIVER_EMAIL=test@example.com
#   DRIVER_PASSWORD=ENV['PASS']
#   TRIP_ID=1   (an active trip the driver owns)

import os
import json
import random
import logging
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner, WorkerRunner

log = logging.getLogger(__name__)

# Config from environment 
DRIVER_EMAIL = os.getenv("DRIVER_EMAIL")
DRIVER_PASSWORD = os.getenv("DRIVER_PASSWORD")
TRIP_ID = os.getenv("TRIP_ID", "7")
SCENARIO = os.getenv("SCENARIO", "soak")

# Nairobi CBD area — pings will wander realistically
BASE_LAT = -1.2921
BASE_LNG = 36.8219


def _random_offset():
    """Small random GPS drift to simulate vehicle movement."""
    return random.uniform(-0.005, 0.005)


# User class


class DriverUser(HttpUser):
    """
    Simulates a Driver app posting GPS pings to POST /api/trips/{id}/ping/
    Every user logs in once on start, stores the JWT, and then hammers
    the ping endpoint on every task tick.
    """

    # Wait between 3–7 seconds between pings (realistic driver cadence)
    wait_time = between(3, 7)

    def on_start(self):
        """Called once when a simulated user starts. Logs in and stores token."""
        self.token = None
        self.lat = BASE_LAT
        self.lng = BASE_LNG
        self._login()

    def _login(self):
        with self.client.post(
            "/api/auth/login/",
            json={"email": DRIVER_EMAIL, "password": DRIVER_PASSWORD},
            catch_response=True,
            name="POST /api/auth/login/",
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access")
                resp.success()
            else:
                resp.failure(f"Login failed: {resp.status_code} — {resp.text}")
                log.error("Login failed for %s: %s", DRIVER_EMAIL, resp.text)

    def _auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task
    def post_gps_ping(self):
        """POST /api/trips/{id}/ping/ — the endpoint under test."""
        if not self.token:
            self._login()
            return

        # Simulate slight movement from last position
        self.lat += _random_offset()
        self.lng += _random_offset()
        heading = random.uniform(0, 360)
        speed = random.uniform(0, 80)

        payload = {
            "latitude": round(self.lat, 6),
            "longitude": round(self.lng, 6),
            "speed_kmh": round(speed, 2),
            "heading": round(heading, 2),
            "recorded_at": "2025-06-01T08:30:00Z",
        }

        with self.client.post(
            f"/api/trips/{TRIP_ID}/ping/",
            json=payload,
            headers=self._auth_headers(),
            catch_response=True,
            name="POST /api/trips/{id}/ping/",  # grouped name for stats
        ) as resp:
            if resp.status_code == 201:
                resp.success()
            elif resp.status_code == 401:
                # Token expired mid-test — refresh and retry next tick
                resp.failure("401 — token expired, re-logging in")
                self._login()
            elif resp.status_code == 400:
                # Trip not active — mark as failure but keep running
                resp.failure(f"400 — {resp.text}")
            else:
                resp.failure(f"Unexpected {resp.status_code} — {resp.text}")
