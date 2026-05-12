# apps/tracking/consumers.py
import json

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class TripTrackingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for live GPS tracking.

    Connection URL:
        ws://<host>/ws/trips/<trip_id>/track/

    Authentication:
        Pass the JWT access token as a query parameter:
        ws://<host>/ws/trips/<trip_id>/track/?token=<access_token>

    Messages received from server:
        {
            "type": "gps_ping",
            "data": {
                "latitude": 1.234,
                "longitude": 36.789,
                "speed_kmh": 42.0,
                "heading": 270.0,
                "recorded_at": "2024-01-15T08:30:00Z"
            }
        }

    Groups:
        Each trip has its own channel group: trip_<trip_id>
        All connected clients for a trip receive every GPS ping broadcast.
    """

    async def connect(self):
        self.trip_id = self.scope['url_route']['kwargs']['trip_id']
        self.group_name = f'trip_{self.trip_id}'

        # Authenticate via JWT query param
        user = await self._get_user_from_token()
        if user is None or isinstance(user, AnonymousUser):
            await self.close(code=4001)
            return

        # Authorise: user must belong to the trip's school
        # (Admins, school staff, and guardians of students on this trip)
        authorised = await self._is_authorised(user, self.trip_id)
        if not authorised:
            await self.close(code=4003)
            return

        # Join the channel group for this trip
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ------------------------------------------------------------------
    # Messages received from clients (currently read-only feed - clients
    # don't send anything, but we handle gracefully if they do)
    # ------------------------------------------------------------------
    async def receive(self, text_data=None, bytes_data=None):
        pass  # Tracking feed is server → client only

    # ------------------------------------------------------------------
    # Handler for group messages broadcast from the ping view
    # Message type 'gps.ping' maps to method 'gps_ping' (dots → underscores)
    # ------------------------------------------------------------------
    async def gps_ping(self, event):
        await self.send(text_data=json.dumps({
            'type': 'gps_ping',
            'data': event['data'],
        }))

    # ------------------------------------------------------------------
    # Handler for ETA update messages broadcast from Celery tasks
    # ------------------------------------------------------------------
    async def eta_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'eta_update',
            'data': event['data'],
        }))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @database_sync_to_async
    def _get_user_from_token(self):
        """Extract and validate JWT from query string, return User or None."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        query_string = self.scope.get('query_string', b'').decode()
        params = dict(
            pair.split('=') for pair in query_string.split('&') if '=' in pair
        )
        token_str = params.get('token')
        if not token_str:
            return None

        try:
            token = AccessToken(token_str)
            user_id = token['user_id']
            return User.objects.select_related('school').get(pk=user_id, is_active=True)
        except (InvalidToken, TokenError, User.DoesNotExist, KeyError):
            return None

    @database_sync_to_async
    def _is_authorised(self, user, trip_id):
        """
        Return True if user is permitted to watch this trip's live feed:
          - Admin: always
          - School staff (Director/Manager/Teacher/Driver): must share school with trip
          - Guardian: must have a student assigned to this trip's route
        """
        from apps.trips.models import Trip

        try:
            trip = Trip.objects.select_related('route__school').get(pk=trip_id)
        except Trip.DoesNotExist:
            return False

        trip_school = trip.route.school

        # Admin sees everything
        if user.user_type == '1':
            return True

        # All other roles must be in the same school
        if user.school_id != trip_school.pk:
            return False

        # Guardians: only if they have a student on this route
        if user.user_type == '6':
            return user.students.filter(
                route_assignments__route=trip.route,
                route_assignments__is_active=True,
            ).exists()

        # Director / Manager / Teacher / Driver - school match is enough
        return True