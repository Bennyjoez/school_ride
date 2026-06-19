import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from mixins import SchoolScopedMixin
from apps.trips.models import Trip, GPSPing, CheckInEvent
from apps.students.models import Student
from apps.trips.serializers import (
    TripSerializer,
    GPSPingSerializer,
    CheckInEventSerializer,
)
from apps.users.permissions import IsAdminOrDirectorOrManager, IsDriverOfTrip

logger = logging.getLogger(__name__)


class TripViewSet(SchoolScopedMixin, ModelViewSet):
    """
    GET    /trips/               - list trips in school
    POST   /trips/               - schedule a new trip
    GET    /trips/{id}/          - retrieve a trip
    PATCH  /trips/{id}/          - update a trip
    POST   /trips/{id}/start/    - driver starts the trip
    POST   /trips/{id}/end/      - driver ends the trip
    POST   /trips/{id}/checkin/  - record a student board/alight event
    POST   /trips/{id}/ping/     - driver posts a GPS location
    GET    /trips/{id}/pings/    - full GPS ping history for a trip
    """

    queryset = (
        Trip.objects.select_related("route__school", "vehicle", "driver")
        .prefetch_related("pings", "checkin_events")
        .order_by("-trip_date")
    )
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch"]

    # SchoolScopedMixin expects a 'school' field on the queryset model.
    # Trip is school-scoped via its route, so we override get_queryset directly.
    def get_queryset(self):
        user = self.request.user
        qs = Trip.objects.select_related("route__school", "vehicle", "driver").order_by(
            "-trip_date"
        )

        if user.user_type == "1":
            return qs

        school = getattr(user, "school", None)
        if school is None:
            return qs.none()

        # Drivers only see their own trips
        if user.user_type == "5":
            return qs.filter(route__school=school, driver=user)

        return qs.filter(route__school=school)

    def perform_create(self, serializer):
        """Trips don't have a direct school FK - school is on route."""
        serializer.save()

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsAdminOrDirectorOrManager()]
        if self.action in ["start", "end", "ping"]:
            return [IsAuthenticated(), IsDriverOfTrip()]
        if self.action == "checkin":
            return [IsAuthenticated()]  # drivers + teachers
        return [IsAuthenticated()]

    # ------------------------------------------------------------------
    # /trips/{id}/start/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        trip = self.get_object()

        if trip.status != Trip.Status.SCHEDULED:
            return Response(
                {"detail": f'Cannot start a trip with status "{trip.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trip.status = Trip.Status.ACTIVE
        trip.actual_start = timezone.now()
        trip.save(update_fields=["status", "actual_start"])

        return Response(TripSerializer(trip).data)

    # ------------------------------------------------------------------
    # /trips/{id}/end/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="end")
    def end(self, request, pk=None):
        trip = self.get_object()

        if trip.status != Trip.Status.ACTIVE:
            return Response(
                {"detail": f'Cannot end a trip with status "{trip.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trip.status = Trip.Status.COMPLETED
        trip.actual_end = timezone.now()
        trip.save(update_fields=["status", "actual_end"])

        # Mark vehicle as available again
        if trip.vehicle:
            trip.vehicle.status = "available"
            trip.vehicle.save(update_fields=["status", "updated_at"])

        return Response(TripSerializer(trip).data)

    # ------------------------------------------------------------------
    # /trips/{id}/checkin/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="checkin")
    def checkin(self, request, pk=None):
        trip = self.get_object()

        if trip.status != Trip.Status.ACTIVE:
            return Response(
                {"detail": "Check-in events can only be recorded on active trips."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student_code = request.data.get("student_code")
        student = Student.objects.filter(student_code=student_code).first()
        if not student:
            return Response(
                {"detail": "Student with this code does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # confirm the student is not actively on board already for this trip or another trip in the same time window
        active_boardings = CheckInEvent.objects.filter(
            student=student,
            event_type=request.data.get("event_type"),
            trip__status=Trip.Status.ACTIVE,
        )

        if active_boardings.exists():
            if active_boardings.filter(trip=trip).exists():
                return Response(
                    {"detail": "This student is already boarded for this trip."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            logger.error(
                f"Attempt to check in student {student.full_name}: {student.student_code} trip: {active_boardings.first().trip_id} who is already boarded on another active trip."
            )
            return Response(
                {"detail": "This student is already on board for another trip."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CheckInEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(trip=trip, student=student, recorded_by=request.user)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # /trips/{id}/ping/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="ping")
    def ping(self, request, pk=None):
        trip = self.get_object()

        if trip.status != Trip.Status.ACTIVE:
            return Response(
                {"detail": "GPS pings can only be posted on active trips."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = GPSPingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ping_instance = serializer.save(trip=trip)

        # Broadcast to WebSocket channel group (tracking app)
        # Wrapped in try/except so pings still save if Channels is unavailable
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"trip_{trip.pk}",
                {
                    "type": "gps.ping",
                    "data": GPSPingSerializer(ping_instance).data,
                },
            )
        except Exception:
            pass  # Channels not configured - degrade gracefully

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # /trips/{id}/pings/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["get"], url_path="pings")
    def pings(self, request, pk=None):
        trip = self.get_object()
        qs = trip.pings.all()
        return Response(GPSPingSerializer(qs, many=True).data)
