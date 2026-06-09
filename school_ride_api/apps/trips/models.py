from django.db import models
from django.conf import settings


class Trip(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    route = models.ForeignKey(
        "vehicles.Route", on_delete=models.CASCADE, related_name="trips"
    )
    vehicle = models.ForeignKey(
        "vehicles.Vehicle", on_delete=models.SET_NULL, null=True, related_name="trips"
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        limit_choices_to={"user_type": "5"},
        related_name="trips",
    )
    trip_date = models.DateTimeField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.SCHEDULED
    )
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["route", "trip_date", "status", "vehicle"],
                name="unique_route_trip_date",
            )
        ]

    def __str__(self):
        return f"{self.route.name} - {self.trip_date}"


class GPSPing(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="pings")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    speed_kmh = models.FloatField(default=0)
    heading = models.FloatField(default=0, help_text="Degrees 0–360")
    recorded_at = models.DateTimeField()

    class Meta:
        ordering = ["recorded_at"]

    def __str__(self):
        return f"Ping for {self.trip} at {self.recorded_at}"


class CheckInEvent(models.Model):
    class EventType(models.TextChoices):
        BOARD = "board", "Boarded"
        ALIGHT = "alight", "Alighted"

    trip = models.ForeignKey(
        Trip, on_delete=models.CASCADE, related_name="checkin_events"
    )
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="checkin_events"
    )
    stop = models.ForeignKey(
        "vehicles.Stop",
        on_delete=models.SET_NULL,
        null=True,
        related_name="checkin_events",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="recorded_checkins",
    )
    event_type = models.CharField(max_length=6, choices=EventType.choices)
    occurred_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} {self.event_type} at {self.stop} - {self.occurred_at:%H:%M}"
