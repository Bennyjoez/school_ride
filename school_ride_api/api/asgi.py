"""
ASGI config for api project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')
django.setup()

# Initialise Django before importing anything that touches models
django_asgi_app = get_asgi_application()

from apps.tracking.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    # Standard HTTP requests handled by Django
    'http': django_asgi_app,

    # WebSocket connections authenticated by AllowedHostsOriginValidator
    # then routed to the tracking consumer
    'websocket': AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})