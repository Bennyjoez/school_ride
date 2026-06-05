"""
Endpoints
─────────
GET  /notifications/                 Current user's notifications (newest first, max 100)
GET  /notifications/?status=pending  Filter by delivery status
GET  /notifications/?event_type=student_boarded  Filter by event type
GET  /notifications/{id}/            Single notification
GET  /notifications/unread_count/    Fast unread badge count (pending rows)

No create / delete exposed — notifications are system-generated only.
No update endpoint — delivery status is managed internally by the service.
"""
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.viewsets import GenericViewSet

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(ListModelMixin, RetrieveModelMixin, GenericViewSet):
    """
    Read-only viewset — delivery status is managed by the service layer,
    not by the client.

    Query params accepted on list:
      ?status=pending|sent|failed
      ?event_type=trip_started|trip_completed|student_boarded|student_alighted|eta_update
      ?channel=push|sms|email
    """
    serializer_class   = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get']

    def get_queryset(self):
        qs = (
            Notification.objects
            .filter(recipient=self.request.user)
            .select_related('trip', 'student', 'recipient')
            .order_by('-created_at')[:100]
        )

        params = self.request.query_params

        status_filter = params.get('status')
        if status_filter in Notification.Status.values:
            qs = qs.filter(status=status_filter)

        event_filter = params.get('event_type')
        if event_filter in Notification.EventType.values:
            qs = qs.filter(event_type=event_filter)

        channel_filter = params.get('channel')
        if channel_filter in Notification.Channel.values:
            qs = qs.filter(channel=channel_filter)

        return qs

    # ------------------------------------------------------------------
    # GET /notifications/unread_count/
    # "Unread" here means status=PENDING — not yet delivered to the device.
    # For in-app feed purposes this is the number the badge should show.
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            status=Notification.Status.PENDING,
        ).count()
        return Response({'unread_count': count})