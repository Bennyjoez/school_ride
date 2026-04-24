from rest_framework import serializers
from apps.trips.models import Trip, GPSPing, CheckInEvent
 
 
class GPSPingSerializer(serializers.ModelSerializer):
    class Meta:
        model = GPSPing
        fields = ['id', 'latitude', 'longitude', 'speed_kmh', 'heading', 'recorded_at']
        read_only_fields = ['id']
 
 
class CheckInEventSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    stop_name = serializers.CharField(source='stop.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)
 
    class Meta:
        model = CheckInEvent
        fields = [
            'id', 'student', 'student_name', 'stop', 'stop_name',
            'event_type', 'recorded_by', 'recorded_by_name', 'occurred_at',
        ]
        read_only_fields = ['id', 'occurred_at', 'student_name', 'stop_name', 'recorded_by_name', 'recorded_by']
 
 
class TripSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source='route.name', read_only=True)
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    vehicle_plate = serializers.CharField(source='vehicle.license_plate', read_only=True)
    pings_count = serializers.IntegerField(source='pings.count', read_only=True)
 
    class Meta:
        model = Trip
        fields = [
            'id', 'route', 'route_name', 'vehicle', 'vehicle_plate',
            'driver', 'driver_name', 'trip_date', 'status',
            'actual_start', 'actual_end', 'pings_count', 'created_at',
        ]
        read_only_fields = [
            'id', 'status', 'actual_start', 'actual_end',
            'route_name', 'driver_name', 'vehicle_plate', 'pings_count', 'created_at',
        ]
 
    def validate(self, attrs):
        # Prevent duplicate route+date combinations at the serializer level
        route = attrs.get('route')
        trip_date = attrs.get('trip_date')
        qs = Trip.objects.filter(route=route, trip_date=trip_date)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A trip for this route on this date already exists.'
            )
        return attrs