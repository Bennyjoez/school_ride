from rest_framework import serializers
from apps.vehicles.models import Vehicle, Route, Stop
 
 
class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = ['id', 'name', 'latitude', 'longitude', 'sequence', 'eta_minutes']
        read_only_fields = ['id']
 
    def validate_sequence(self, value):
        if value < 1:
            raise serializers.ValidationError('Sequence must be 1 or greater.')
        return value
 
 
class RouteSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    
    vehicle_license = serializers.CharField(source='vehicle.license_plate', read_only=True, default=None)
    driver_name = serializers.CharField(source='driver.name', read_only=True, default=None)
    school_name   = serializers.CharField(source='school.name', read_only=True, default=None)
 
    class Meta:
        model = Route
        fields = [
            'id', 'name', 'direction', 'scheduled_start', 'is_active',
            'school', 'school_name',
            'vehicle', 'vehicle_license', 
            'driver', 'driver_name',
            'stops', 'created_at',
        ]
        # Removed explicitly declared read-only fields from here
        read_only_fields = ['id', 'created_at'] 
        extra_kwargs = {
            'vehicle': {'required': False, 'allow_null': True},
            'driver': {'required': False, 'allow_null': True},
            'school':  {'required': False},
        }
 
 
class VehicleSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.name', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
 
    class Meta:
        model = Vehicle
        fields = [
            'id', 'vehicle_type', 'license_plate', 'capacity', 'status',
            'driver', 'driver_name', 'school', 'school_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'driver_name', 'school_name']
        extra_kwargs = {
            'school': {'required': False},  # injected by SchoolScopedMixin
            'driver': {'required': False, 'allow_null': True},
        }
 
    def validate_license_plate(self, value):
        import re
        plate = value.upper().replace(' ', '')
        if not re.match(r'^[A-Z0-9]{5,10}$', plate):
            raise serializers.ValidationError('Invalid license plate format.')
        return plate
 
    def validate_capacity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Capacity must be a positive integer.')
        return value
 
    def validate_driver(self, value):
        if value and value.user_type != '5':
            raise serializers.ValidationError('Assigned user must be a Driver.')
        return value
 
 
class AssignDriverSerializer(serializers.Serializer):
    driver_id = serializers.IntegerField()
 
    def validate_driver_id(self, value):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            driver = User.objects.get(pk=value, user_type='5')
        except User.DoesNotExist:
            raise serializers.ValidationError('No active driver found with this ID.')
        return driver  # return the object so the view can use it directly