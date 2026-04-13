from rest_framework import serializers
from .models import User
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'phone_number', 'email',  'user_type']

    def create(self, validated_data):
        user = User.objects.create_user(
            name=validated_data['name'],
            phone_number=validated_data['phone_number'],
            email=validated_data['email'],
            user_type=validated_data['user_type']
        )
        return user