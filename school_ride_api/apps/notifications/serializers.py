
from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='recipient.name', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_name', 'trip', 'student',
            'event_type', 'channel', 'status', 'message',
            'external_id', 'error_message', 'created_at', 'delivered_at',
        ]
        read_only_fields = ['id', 'status', 'external_id', 'error_message', 'created_at', 'delivered_at']