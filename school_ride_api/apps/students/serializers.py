from rest_framework import serializers
from apps.students.models import Student, StudentRoute
 
 
class StudentRouteSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source='route.name', read_only=True)
    stop_name = serializers.CharField(source='stop.name', read_only=True)
 
    class Meta:
        model = StudentRoute
        fields = ['id', 'route', 'route_name', 'stop', 'stop_name', 'direction', 'is_active']
        read_only_fields = ['id', 'route_name', 'stop_name']
 
    def validate(self, attrs):
        # Ensure stop belongs to the chosen route
        route = attrs.get('route')
        stop = attrs.get('stop')
        if route and stop and stop.route_id != route.id:
            raise serializers.ValidationError({'stop': 'Stop does not belong to the selected route.'})
        return attrs
 
 
class StudentSerializer(serializers.ModelSerializer):
    guardian_name = serializers.CharField(source='guardian.name', read_only=True)
    route_assignments = StudentRouteSerializer(many=True, read_only=True)
 
    class Meta:
        model = Student
        fields = [
            'id', 'full_name', 'grade', 'student_code', 'is_active',
            'guardian', 'guardian_name', 'school',
            'route_assignments', 'created_at',
        ]
        read_only_fields = ['id', 'student_code', 'created_at', 'guardian_name', 'school', 'route_assignments']
        extra_kwargs = {
            'guardian': {'required': False},
        }
 
    def validate_guardian(self, value):
        if value and value.user_type != '6':
            raise serializers.ValidationError('Assigned user must be a Guardian.')
        return value