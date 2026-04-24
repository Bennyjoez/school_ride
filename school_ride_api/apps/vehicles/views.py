# apps/vehicles/views.py
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from mixins import SchoolScopedMixin
from apps.vehicles.models import Vehicle, Route, Stop
from apps.vehicles.serializers import (
    VehicleSerializer,
    RouteSerializer,
    StopSerializer,
    AssignDriverSerializer,
)
from apps.users.permissions import IsAdminOrDirectorOrManager


class VehicleViewSet(SchoolScopedMixin, ModelViewSet):
    """
    GET    /vehicles/                  — list vehicles in school
    POST   /vehicles/                  — create a vehicle
    GET    /vehicles/{id}/             — retrieve a vehicle
    PATCH  /vehicles/{id}/             — update a vehicle
    DELETE /vehicles/{id}/             — delete a vehicle
    GET    /vehicles/available/        — vehicles with status=available
    PATCH  /vehicles/{id}/assign-driver/ — assign a driver to a vehicle
    """
    queryset = Vehicle.objects.select_related('driver', 'school').order_by('-created_at')
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_permissions(self):
        if self.action in ['create', 'partial_update', 'destroy', 'assign_driver']:
            return [IsAuthenticated(), IsAdminOrDirectorOrManager()]
        return [IsAuthenticated()]

    # ------------------------------------------------------------------
    # /vehicles/available/
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        qs = self.get_queryset().filter(status=Vehicle.VehicleStatus.AVAILABLE)
        return Response(VehicleSerializer(qs, many=True).data)

    # ------------------------------------------------------------------
    # /vehicles/{id}/assign-driver/
    # ------------------------------------------------------------------
    @action(detail=True, methods=['patch'], url_path='assign-driver',
            permission_classes=[IsAuthenticated, IsAdminOrDirectorOrManager])
    def assign_driver(self, request, pk=None):
        vehicle = self.get_object()
        serializer = AssignDriverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # validated_data['driver_id'] is already a User object (see serializer)
        driver = serializer.validated_data['driver_id']
        vehicle.driver = driver
        vehicle.save(update_fields=['driver', 'updated_at'])

        return Response(
            VehicleSerializer(vehicle).data,
            status=status.HTTP_200_OK,
        )


class RouteViewSet(SchoolScopedMixin, ModelViewSet):
    """
    GET    /routes/                    — list routes in school
    POST   /routes/                    — create a route
    GET    /routes/{id}/               — retrieve a route (with stops)
    PATCH  /routes/{id}/               — update a route
    DELETE /routes/{id}/               — delete a route
    GET    /routes/{id}/stops/         — list stops for a route
    POST   /routes/{id}/stops/         — add a stop to a route
    GET    /routes/{id}/stops/{stop_id}/ — retrieve a stop
    PATCH  /routes/{id}/stops/{stop_id}/ — update a stop
    DELETE /routes/{id}/stops/{stop_id}/ — delete a stop
    """
    queryset = Route.objects.select_related(
        'school', 'vehicle', 'driver'
    ).prefetch_related('stops').order_by('name')
    serializer_class = RouteSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_permissions(self):
        if self.action in ['create', 'partial_update', 'destroy',
                           'stops_create', 'stops_update', 'stops_destroy']:
            return [IsAuthenticated(), IsAdminOrDirectorOrManager()]
        return [IsAuthenticated()]

    # ------------------------------------------------------------------
    # /routes/{id}/stops/
    # ------------------------------------------------------------------
    def _get_route(self, pk):
        """Return the route, already school-scoped."""
        return self.get_queryset().get(pk=pk)

    @action(detail=True, methods=['get', 'post'], url_path='stops')
    def stops(self, request, pk=None):
        route = self.get_object()

        if request.method == 'GET':
            qs = route.stops.all()
            return Response(StopSerializer(qs, many=True).data)

        # POST — add a stop
        serializer = StopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(route=route)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'patch', 'delete'],
            url_path=r'stops/(?P<stop_id>\d+)')
    def stop_detail(self, request, pk=None, stop_id=None):
        route = self.get_object()
        try:
            stop = route.stops.get(pk=stop_id)
        except Stop.DoesNotExist:
            return Response(
                {'detail': 'Stop not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == 'GET':
            return Response(StopSerializer(stop).data)

        if request.method == 'PATCH':
            serializer = StopSerializer(stop, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        # DELETE
        stop.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)