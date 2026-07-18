"""
Signal receivers that fire notification creation when:
  - A Trip transitions to ACTIVE or COMPLETED
  - A CheckInEvent is created (board or alight)

Connected in NotificationsConfig.ready() - see apps.py.
All exceptions are caught here so a notification failure never
breaks the triggering view action.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.trips.models import Trip, CheckInEvent

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Trip)
def on_trip_save(sender, instance: Trip, created: bool, update_fields=None, **kwargs):
    """
    Fire trip_started / trip_completed when the status field is written.

    The trip views always call save(update_fields=['status', ...]), so
    checking for 'status' in update_fields is a reliable guard.
    When update_fields is None (full save), we also act.
    """
    fields = update_fields or []
    if update_fields is not None and "status" not in fields:
        return  # status wasn't touched - nothing to do

    try:
        if instance.status == Trip.Status.ACTIVE:
            from apps.notifications.service import notify_trip_started

            notify_trip_started(instance)

        elif instance.status == Trip.Status.COMPLETED:
            from apps.notifications.service import notify_trip_completed

            notify_trip_completed(instance)

    except Exception as exc:
        logger.exception(
            "Failed to send trip notification for Trip pk=%s: %s",
            instance.pk,
            exc,
        )


@receiver(post_save, sender=CheckInEvent)
def on_checkin_event_save(sender, instance: CheckInEvent, created: bool, **kwargs):
    """
    Fire student_boarded / student_alighted on every new CheckInEvent.
    Updates are ignored - check-in events are immutable once created.
    """
    if not created:
        return

    try:
        if instance.event_type == CheckInEvent.EventType.BOARD:
            from apps.notifications.service import notify_student_boarded

            notify_student_boarded(instance)

        elif instance.event_type == CheckInEvent.EventType.ALIGHT:
            from apps.notifications.service import notify_student_alighted

            notify_student_alighted(instance)

    except Exception as exc:
        logger.exception(
            "Failed to send checkin notification for CheckInEvent pk=%s: %s",
            instance.pk,
            exc,
        )
