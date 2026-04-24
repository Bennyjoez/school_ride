from rest_framework import serializers
from apps.schools.models import School
 
 
class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'region', 'timezone', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']