# apps/notifications/tasks.py
from __future__ import annotations

import logging
from datetime import datetime

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# ETA Recalculation
# =============================================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def recalculate_eta(self, trip_id: int, ping_id: int):
    """
    Triggered after every GPS ping is saved.
    Re-estimates arrival times for remaining stops and broadcasts
    the updated ETAs to connected WebSocket clients.
    """
    try:
        from apps.trips.models import Trip, GPSPing
        from apps.vehicles.models import Stop

        trip = Trip.objects.select_related('route').prefetch_related(
            'route__stops'
        ).get(pk=trip_id)

        ping = GPSPing.objects.get(pk=ping_id)

        if trip.status != Trip.Status.ACTIVE:
            return

        # Simple straight-line ETA estimation.
        # Replace with a routing API (e.g. Google Maps, OSRM) for production.
        import math

        def haversine_km(lat1, lon1, lat2, lon2):
            R = 6371
            dlat = math.radians(float(lat2) - float(lat1))
            dlon = math.radians(float(lon2) - float(lon1))
            a = (math.sin(dlat / 2) ** 2
                 + math.cos(math.radians(float(lat1)))
                 * math.cos(math.radians(float(lat2)))
                 * math.sin(dlon / 2) ** 2)
            return R * 2 * math.asin(math.sqrt(a))

        speed = max(ping.speed_kmh, 5.0)  # floor at 5 km/h to avoid divide-by-zero
        eta_map = {}

        for stop in trip.route.stops.order_by('sequence'):
            dist_km = haversine_km(
                ping.latitude, ping.longitude,
                stop.latitude, stop.longitude,
            )
            eta_minutes = round((dist_km / speed) * 60)
            eta_map[stop.pk] = eta_minutes

        # Broadcast updated ETAs over WebSocket
        _broadcast_eta(trip_id, eta_map)

        # Trigger proximity notifications (≤ 5 min away)
        for stop_id, minutes in eta_map.items():
            if minutes <= 5:
                notify_guardians_eta.delay(trip_id, stop_id, minutes)

    except Exception as exc:
        logger.exception('recalculate_eta failed for trip %s', trip_id)
        raise self.retry(exc=exc)


def _broadcast_eta(trip_id: int, eta_map: dict):
    """Push ETA updates to the trip's WebSocket channel group."""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'trip_{trip_id}',
            {
                'type': 'eta.update',
                'data': {'stop_etas': eta_map},
            }
        )
    except Exception:
        logger.warning('Could not broadcast ETA for trip %s — Channels unavailable', trip_id)


# =============================================================================
# Guardian Notifications
# =============================================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def notify_guardians_eta(self, trip_id: int, stop_id: int, eta_minutes: int):
    """
    Send ETA notifications to guardians whose children board/alight at this stop.
    """
    try:
        from apps.trips.models import Trip
        from apps.vehicles.models import Stop
        from apps.students.models import StudentRoute

        trip = Trip.objects.get(pk=trip_id)
        stop = Stop.objects.get(pk=stop_id)

        assignments = StudentRoute.objects.filter(
            route=trip.route,
            stop=stop,
            is_active=True,
        ).select_related('student__guardian')

        for assignment in assignments:
            student = assignment.student
            guardian = student.guardian
            if not guardian:
                continue

            message = (
                f"The bus is approximately {eta_minutes} minute(s) away "
                f"from {stop.name} for {student.full_name}."
            )

            _dispatch_notification(
                recipient=guardian,
                trip=trip,
                student=student,
                event_type='eta_update',
                message=message,
            )

    except Exception as exc:
        logger.exception('notify_guardians_eta failed for trip %s stop %s', trip_id, stop_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def notify_trip_started(self, trip_id: int):
    """Notify all guardians with students on this trip that the bus has departed."""
    try:
        from apps.trips.models import Trip
        from apps.students.models import StudentRoute

        trip = Trip.objects.select_related('route', 'vehicle').get(pk=trip_id)

        assignments = StudentRoute.objects.filter(
            route=trip.route,
            is_active=True,
        ).select_related('student__guardian')

        for assignment in assignments:
            student = assignment.student
            guardian = student.guardian
            if not guardian:
                continue

            message = (
                f"The school bus for {student.full_name} has departed. "
                f"Route: {trip.route.name}."
            )

            _dispatch_notification(
                recipient=guardian,
                trip=trip,
                student=student,
                event_type='trip_started',
                message=message,
            )

    except Exception as exc:
        logger.exception('notify_trip_started failed for trip %s', trip_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def notify_checkin_event(self, trip_id: int, checkin_event_id: int):
    """Notify guardian when their child boards or alights."""
    try:
        from apps.trips.models import CheckInEvent

        event = CheckInEvent.objects.select_related(
            'student__guardian', 'stop', 'trip__route'
        ).get(pk=checkin_event_id)

        guardian = event.student.guardian
        if not guardian:
            return

        verb = 'boarded' if event.event_type == 'board' else 'alighted'
        message = (
            f"{event.student.full_name} has {verb} the bus "
            f"at {event.stop.name} ({event.occurred_at:%H:%M})."
        )

        _dispatch_notification(
            recipient=guardian,
            trip=event.trip,
            student=event.student,
            event_type=f'student_{verb}',
            message=message,
        )

    except Exception as exc:
        logger.exception('notify_checkin_event failed for event %s', checkin_event_id)
        raise self.retry(exc=exc)


# =============================================================================
# Delivery dispatcher — routes to push / SMS / email
# =============================================================================

def _dispatch_notification(*, recipient, trip, student, event_type, message):
    """
    Create a Notification record and fire the appropriate delivery task
    for each channel the guardian has enabled (push, SMS, email).
    """
    from apps.notifications.models import Notification

    for channel in Notification.Channel.values:
        notif = Notification.objects.create(
            recipient=recipient,
            trip=trip,
            student=student,
            event_type=event_type,
            channel=channel,
            message=message,
        )
        # Fire the right delivery task per channel
        if channel == Notification.Channel.PUSH:
            send_push_notification.delay(notif.pk)
        elif channel == Notification.Channel.SMS:
            send_sms_notification.delay(notif.pk)
        elif channel == Notification.Channel.EMAIL:
            send_email_notification.delay(notif.pk)


# =============================================================================
# Channel-specific delivery tasks
# =============================================================================

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_push_notification(self, notification_id: int):
    """Send a Firebase Cloud Messaging push notification."""
    from apps.notifications.models import Notification
    from django.utils import timezone

    notif = Notification.objects.select_related('recipient').get(pk=notification_id)

    try:
        import requests

        fcm_token = getattr(notif.recipient, 'fcm_token', None)
        if not fcm_token:
            notif.status = Notification.Status.FAILED
            notif.error_message = 'No FCM token on recipient.'
            notif.save(update_fields=['status', 'error_message'])
            return

        response = requests.post(
            'https://fcm.googleapis.com/fcm/send',
            headers={
                'Authorization': f'key={settings.FCM_SERVER_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'to': fcm_token,
                'notification': {
                    'title': 'SchoolFleet',
                    'body': notif.message,
                },
                'data': {
                    'event_type': notif.event_type,
                    'trip_id': str(notif.trip_id),
                },
            },
            timeout=10,
        )
        response.raise_for_status()
        result = response.json()

        notif.status = Notification.Status.SENT
        notif.external_id = result.get('results', [{}])[0].get('message_id', '')
        notif.delivered_at = timezone.now()
        notif.save(update_fields=['status', 'external_id', 'delivered_at'])

    except Exception as exc:
        notif.status = Notification.Status.FAILED
        notif.error_message = str(exc)
        notif.save(update_fields=['status', 'error_message'])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_sms_notification(self, notification_id: int):
    """Send an SMS via Twilio."""
    from apps.notifications.models import Notification
    from django.utils import timezone

    notif = Notification.objects.select_related('recipient').get(pk=notification_id)

    try:
        from twilio.rest import Client

        phone = getattr(notif.recipient, 'phone_number', None)
        if not phone:
            notif.status = Notification.Status.FAILED
            notif.error_message = 'No phone number on recipient.'
            notif.save(update_fields=['status', 'error_message'])
            return

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=notif.message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone,
        )

        notif.status = Notification.Status.SENT
        notif.external_id = message.sid
        notif.delivered_at = timezone.now()
        notif.save(update_fields=['status', 'external_id', 'delivered_at'])

    except Exception as exc:
        notif.status = Notification.Status.FAILED
        notif.error_message = str(exc)
        notif.save(update_fields=['status', 'error_message'])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_email_notification(self, notification_id: int):
    """Send an email via SendGrid."""
    from apps.notifications.models import Notification
    from django.utils import timezone

    notif = Notification.objects.select_related('recipient').get(pk=notification_id)

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        email = getattr(notif.recipient, 'email', None)
        if not email:
            notif.status = Notification.Status.FAILED
            notif.error_message = 'No email address on recipient.'
            notif.save(update_fields=['status', 'error_message'])
            return

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        mail = Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=email,
            subject='SchoolFleet Update',
            plain_text_content=notif.message,
        )
        response = sg.send(mail)

        notif.status = Notification.Status.SENT
        notif.external_id = response.headers.get('X-Message-Id', '')
        notif.delivered_at = timezone.now()
        notif.save(update_fields=['status', 'external_id', 'delivered_at'])

    except Exception as exc:
        notif.status = Notification.Status.FAILED
        notif.error_message = str(exc)
        notif.save(update_fields=['status', 'error_message'])
        raise self.retry(exc=exc)