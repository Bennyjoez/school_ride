from django.db import models
from django.conf import settings


class Notification(models.Model):

    class Channel(models.TextChoices):
        PUSH = "push", "Push"
        SMS = "sms", "SMS"
        EMAIL = "email", "Email"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    class EventType(models.TextChoices):
        TRIP_STARTED = "trip_started", "Trip Started"
        TRIP_COMPLETED = "trip_completed", "Trip Completed"
        STUDENT_BOARDED = "student_boarded", "Student Boarded"
        STUDENT_ALIGHTED = "student_alighted", "Student Alighted"
        ETA_UPDATE = "eta_update", "ETA Update"

    # Who receives the notification
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    # Which trip triggered it (nullable so we can send non-trip notifications)
    trip = models.ForeignKey(
        "trips.Trip",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    # Which student this notification is about (guardian use-case)
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    event_type = models.CharField(max_length=20, choices=EventType.choices)
    channel = models.CharField(max_length=5, choices=Channel.choices)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )

    # Human-readable message body (also the SMS/email body)
    message = models.TextField()

    # Delivery metadata
    external_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="FCM message ID, Twilio SID, or SendGrid message ID",
    )
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "status"]),
            models.Index(fields=["trip", "event_type"]),
        ]

    def __str__(self):
        return f"[{self.channel}] {self.event_type} → {self.recipient} ({self.status})"
