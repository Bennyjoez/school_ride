"""
Notification creation helpers.

The model tracks *delivery attempts* - one row per (recipient, channel).
Each helper creates the appropriate rows and then hands them to the
channel-specific delivery backends (push / SMS / email).

TODO: Swap the stub bodies for real SDK calls when you integrate a provider.
"""

from __future__ import annotations

import logging
from django.utils import timezone

from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


# internal helpers


def _default_channels() -> list[str]:
    """Return the channels that are active. Extend when SMS/email are wired."""
    return [Notification.Channel.PUSH]


def _build_rows(
    recipients,
    event_type: str,
    message: str,
    channels: list[str] | None = None,
    trip=None,
    student=None,
) -> list[Notification]:
    """
    Create one Notification row per (recipient, channel), deduplicated by
    recipient pk. Returns the saved instances.
    """
    if channels is None:
        channels = _default_channels()

    seen: set[int] = set()
    rows: list[Notification] = []

    for user in recipients:
        if not user or user.pk in seen:
            continue
        seen.add(user.pk)
        for channel in channels:
            rows.append(
                Notification(
                    recipient=user,
                    event_type=event_type,
                    channel=channel,
                    message=message,
                    trip=trip,
                    student=student,
                    status=Notification.Status.PENDING,
                )
            )

    if rows:
        Notification.objects.bulk_create(rows)
        # Attempt delivery for each row
        for row in rows:
            _dispatch(row)

    return rows


def _dispatch(notification: Notification) -> None:
    """
    Route a single notification to the appropriate delivery backend.
    Updates status + delivered_at / error_message in-place.
    """
    try:
        if notification.channel == Notification.Channel.PUSH:
            _send_push(notification)
        elif notification.channel == Notification.Channel.SMS:
            _send_sms(notification)
        elif notification.channel == Notification.Channel.EMAIL:
            _send_email(notification)
    except Exception as exc:
        logger.exception(
            "Delivery failed for Notification pk=%s channel=%s: %s",
            notification.pk,
            notification.channel,
            exc,
        )
        notification.status = Notification.Status.FAILED
        notification.error_message = str(exc)
        notification.save(update_fields=["status", "error_message"])


# delivery stubs (replace with real SDK calls)


def _send_push(n: Notification) -> None:
    """
    Send a Firebase Cloud Messaging push notification.

    Replace the body below with your FCM integration, e.g.:
        from firebase_admin import messaging
        msg = messaging.Message(
            notification=messaging.Notification(title=..., body=n.message),
            token=n.recipient.fcm_token,
        )
        response = messaging.send(msg)
        n.external_id = response          # FCM returns the message ID string
        n.status = Notification.Status.SENT
        n.delivered_at = timezone.now()
        n.save(update_fields=['external_id', 'status', 'delivered_at'])
    """
    # TODO: Replace with real FCM integration
    logger.debug("[PUSH stub] Would send to %s: %s", n.recipient, n.message)
    n.status = Notification.Status.SENT
    n.delivered_at = timezone.now()
    n.save(update_fields=["status", "delivered_at"])


def _send_sms(n: Notification) -> None:
    """
    Send via Twilio (or any SMS provider).

    Replace with:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=n.message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=n.recipient.phone_number,
        )
        n.external_id = msg.sid
        n.status = Notification.Status.SENT
        n.delivered_at = timezone.now()
        n.save(update_fields=['external_id', 'status', 'delivered_at'])
    """
    # TODO: Replace with real Twilio integration
    logger.debug("[SMS stub] Would send to %s: %s", n.recipient, n.message)
    n.status = Notification.Status.SENT
    n.delivered_at = timezone.now()
    n.save(update_fields=["status", "delivered_at"])


def _send_email(n: Notification) -> None:
    """
    Send via SendGrid / Django's built-in email backend.

    Replace with your preferred email integration.
    """
    # TODO: Replace with real email integration
    logger.debug("[EMAIL stub] Would send to %s: %s", n.recipient, n.message)
    n.status = Notification.Status.SENT
    n.delivered_at = timezone.now()
    n.save(update_fields=["status", "delivered_at"])


# public helpers (one per EventType)


def notify_trip_started(trip) -> None:
    """
    Alert every guardian of students assigned to this trip's route.
    Assumes Student has a `guardian` FK to the user model and a `route` FK.
    """
    from apps.students.models import Student

    students = (
        Student.objects.filter(route_assignments__route=trip.route)
        .select_related("guardian")
        .exclude(guardian=None)
    )

    guardians = [s.guardian for s in students]
    vehicle = getattr(trip.vehicle, "license_plate", "-")

    _build_rows(
        guardians,
        event_type=Notification.EventType.TRIP_STARTED,
        message=(
            f"The bus for route '{trip.route.name}' has departed. "
            f"Vehicle: {vehicle}."
        ),
        trip=trip,
    )


def notify_trip_completed(trip) -> None:
    """Alert guardians that the trip has finished."""
    from apps.students.models import Student

    students = (
        Student.objects.filter(route_assignments__route=trip.route)
        .select_related("guardian")
        .exclude(guardian=None)
    )

    guardians = [s.guardian for s in students]

    _build_rows(
        guardians,
        event_type=Notification.EventType.TRIP_COMPLETED,
        message=f"The bus for route '{trip.route.name}' has completed its journey.",
        trip=trip,
    )


def notify_student_boarded(checkin_event) -> None:
    """Tell the guardian their child has boarded."""
    student = checkin_event.student
    guardian = getattr(student, "guardian", None)
    if not guardian:
        return

    stop_name = getattr(checkin_event.stop, "name", "a stop")

    _build_rows(
        [guardian],
        event_type=Notification.EventType.STUDENT_BOARDED,
        message=f"{student.full_name} has boarded the bus at '{stop_name}'.",
        trip=checkin_event.trip,
        student=student,
    )


def notify_student_alighted(checkin_event) -> None:
    """Tell the guardian their child has alighted."""
    student = checkin_event.student
    guardian = getattr(student, "guardian", None)
    if not guardian:
        return

    stop_name = getattr(checkin_event.stop, "name", "a stop")

    _build_rows(
        [guardian],
        event_type=Notification.EventType.STUDENT_ALIGHTED,
        message=f"{student.full_name} has alighted from the bus at '{stop_name}'.",
        trip=checkin_event.trip,
        student=student,
    )


def notify_eta_update(trip, stop, eta_minutes: int) -> None:
    """
    Notify guardians of students who board/alight at a specific stop
    that the ETA has changed. Useful for significant deviations.
    """
    from apps.students.models import Student

    students = (
        Student.objects.filter(
            route_assignments__stop=stop
        )  # students who use this specific stop
        .select_related("guardian")
        .exclude(guardian=None)
    )

    guardians = [s.guardian for s in students]

    _build_rows(
        guardians,
        event_type=Notification.EventType.ETA_UPDATE,
        message=(
            f"Bus for route '{trip.route.name}' is approximately "
            f"{eta_minutes} minute(s) away from '{stop.name}'."
        ),
        trip=trip,
    )
