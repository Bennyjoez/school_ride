# stress_tests/locust/scenarios.py
#
# Custom load shapes for each scenario.
# Import the one you want by passing it on the command line:
#
#   locust -f stress_tests/locust/locustfile.py,stress_tests/locust/scenarios.py \
#          --host http://127.0.0.1:8000 --headless
#
# Only one LoadTestShape subclass can be active at a time.
# Comment out the two you don't need, or use the SCENARIO env var
# in locustfile.py to drive which shape class Locust picks up.

from locust import LoadTestShape

# Scenario 1: Ramp
# Gradually increases load to find the breaking point.
# Users climb by 10 every 30 seconds up to 200.
# If your server starts dropping requests, the response time graph will
# show a sharp elbow - that is your saturation point.
#
# Total duration: ~10 minutes

# # NOTE; to run this scenario, set SCENARIO=ramp in the environment variables on locustfile.py when you launch Locust.
# class RampShape(LoadTestShape):
#     """
#     Gradual ramp-up to find the saturation point.

#     Stage  | Users | Spawn rate | Duration
#     -------|-------|------------|----------
#     1      |    10 |          2 |  30 s
#     2      |    25 |          3 |  30 s
#     3      |    50 |          5 |  60 s
#     4      |   100 |         10 |  60 s
#     5      |   150 |         10 |  60 s
#     6      |   200 |         10 |  60 s
#     Drain  |     0 |         50 |  30 s
#     """

#     stages = [
#         {"duration": 30, "users": 10, "spawn_rate": 2},
#         {"duration": 60, "users": 25, "spawn_rate": 3},
#         {"duration": 120, "users": 50, "spawn_rate": 5},
#         {"duration": 180, "users": 100, "spawn_rate": 10},
#         {"duration": 240, "users": 150, "spawn_rate": 10},
#         {"duration": 300, "users": 200, "spawn_rate": 10},
#         {"duration": 330, "users": 0, "spawn_rate": 50},  # drain
#     ]

#     def tick(self):
#         run_time = self.get_run_time()
#         for stage in self.stages:
#             if run_time < stage["duration"]:
#                 return stage["users"], stage["spawn_rate"]
#         return None  # stop the test


# Scenario 2: Soak
# Sustains a moderate constant load for an extended period.
# Purpose: catch memory leaks, DB connection pool exhaustion, and
# gradual performance degradation that only shows up over time.
#
# Total duration: 10 minutes at 50 concurrent drivers


class SoakShape(LoadTestShape):
    """
    Constant load for 10 minutes.

    Stage   | Users | Spawn rate | Duration
    --------|-------|------------|----------
    Warm-up |    50 |         5  |  60 s
    Soak    |    50 |         0  | 540 s  (9 min)
    Drain   |     0 |        50  |  30 s
    """

    stages = [
        {"duration": 60, "users": 50, "spawn_rate": 5},  # warm-up
        {"duration": 600, "users": 50, "spawn_rate": 1},  # soak
        {"duration": 630, "users": 0, "spawn_rate": 50},  # drain
    ]

    def tick(self):
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        return None


# Scenario 3: Spike
# Simulates a sudden burst of drivers all starting trips at the same time -
# e.g. school pick-up at 07:30 when 150 buses all depart within 2 minutes.
# Checks whether Django + Channels + Celery can absorb a sudden load surge
# and recover cleanly when it drops.
#
# Total duration: ~5 minutes


class SpikeShape(LoadTestShape):
    """
    Sudden burst then drop.

    Stage      | Users | Spawn rate | Duration
    -----------|-------|------------|----------
    Baseline   |    10 |          2 |  30 s
    Spike      |   200 |        100 |  90 s   ← sudden burst
    Recover    |    10 |         50 | 150 s   ← drop back, watch recovery
    Drain      |     0 |         50 | 180 s
    """

    stages = [
        {"duration": 30, "users": 10, "spawn_rate": 2},  # baseline
        {"duration": 90, "users": 200, "spawn_rate": 100},  # spike
        {"duration": 150, "users": 10, "spawn_rate": 50},  # recover
        {"duration": 180, "users": 0, "spawn_rate": 50},  # drain
    ]

    def tick(self):
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        return None
