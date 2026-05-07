# apps/tracking/routing.py
from django.urls import re_path
from apps.tracking.consumers import TripTrackingConsumer

websocket_urlpatterns = [
    re_path(r'^ws/trips/(?P<trip_id>\d+)/track/$', TripTrackingConsumer.as_asgi()),
]