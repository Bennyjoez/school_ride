from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.schools.models import School
 
User = get_user_model()
 
 
class UserSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
 
    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'phone_number', 'user_type',
            'school', 'school_name', 'bio', 'profile_picture',
            'is_active', 'last_login', 'date_joined',
        ]
        read_only_fields = ['id', 'last_login', 'date_joined', 'school_name']
        extra_kwargs = {
            'school': {'write_only': True, 'required': False},
        }
 
 
class UserCreateSerializer(serializers.ModelSerializer):
    """Used for POST /users/ — accepts a password and hashes it."""
    password = serializers.CharField(write_only=True, min_length=8)
 
    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'phone_number', 'user_type',
            'school', 'bio', 'password',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'school': {'required': False},
        }
 
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
 
 
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
 
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value
 
