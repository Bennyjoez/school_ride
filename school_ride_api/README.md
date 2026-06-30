# SchoolFleet API

The backend service for SchoolFleet - a multi-tenant school bus fleet management system. Built with Django REST Framework and served over ASGI to support both standard HTTP and persistent WebSocket connections for real-time GPS tracking.

---

## The Problem Solved

School bus operations generate a continuous stream of events - vehicle departures, student boardings, GPS position updates, ETA changes - that need to reach multiple audiences simultaneously. A traditional request-response API cannot deliver live updates to guardian clients without constant polling. This backend solves that by combining a REST API for data mutations with a WebSocket layer for real-time event delivery, all within a single ASGI process.

---

## Features

### REST API
Full CRUD for schools, users, vehicles, routes, stops, students, and trips. Every endpoint is school-scoped, role-gated, and serializer-validated. Thin views delegate business logic to serializers and service layers.

### Real-time GPS streaming
Drivers POST GPS pings to a REST endpoint. The server saves each ping to PostgreSQL and simultaneously publishes it to a Redis-backed Django Channels group. Guardian clients connected to the matching WebSocket channel receive the ping in real time without polling.

### ETA recalculation
A Celery task fires on each GPS ping, recalculates arrival estimates for every remaining stop on the route, and pushes updated ETAs to connected clients via the channel layer.

### Multi-tenant isolation
`SchoolScopedMixin` filters every queryset to the requesting user's school at the ORM level. Admins retain cross-school visibility. No other role can discover or access records belonging to a different school.

### Student check-in audit log
Every board and alight event is recorded with a timestamp, the student, the stop, the trip, and the user who recorded it. The full log is retrievable per trip.

### Guardian notifications
Celery workers dispatch push (FCM), SMS (Twilio), and email (SendGrid) notifications on trip start, student check-in, and ETA threshold events.

### Soft deletes
Users, students, and schools are deactivated rather than deleted. Hard deletes are not exposed through the API.

---

## Architectural Decisions

### Daphne over Gunicorn
The server is Daphne, not Gunicorn. Gunicorn is a WSGI server and cannot handle WebSocket connections. Daphne is the reference ASGI server for Django Channels and handles both HTTP and WebSocket through a single entry point (`config/asgi.py`).

### Queryset-level tenancy
Multi-tenancy is enforced in `get_queryset()`, not in view logic or middleware. The `SchoolScopedMixin` is mixed into every ViewSet. Even if a developer forgets to add a filter in a new view, the mixin catches it. Admins bypass the filter by design - their cross-school access is an explicit business requirement, not a hole in the system.

### Serializer-level validation
Validation logic lives in serializers, not views. License plate format, driver role verification, stop-to-route consistency, and duplicate trip detection are all enforced in `validate_*` methods and `validate()`. Views call `is_valid(raise_exception=True)` and trust the serializer.

### Celery for async work
ETA calculation and notification delivery are offloaded to Celery. The GPS ping endpoint returns 201 in milliseconds. The worker handles the computation and third-party API calls asynchronously, preventing slow external services from blocking the real-time feed.

### JWT with query-parameter WebSocket auth
REST endpoints use `Authorization: Bearer <token>` headers. WebSocket connections pass the token as `?token=<access_token>` in the URL because browser WebSocket APIs do not support custom headers at the handshake stage. The Channels consumer validates the token on connect and disconnects with code `4001` or `4003` on failure.

---

## RBAC

| Role | Code | Key API Permissions |
|---|---|---|
| Admin | `1` | All endpoints, all schools |
| Director | `2` | All endpoints within own school |
| Manager | `3` | Fleet, routes, vehicles, students - own school only |
| Teacher | `4` | Read trips, record check-in events |
| Driver | `5` | Start/end own trips, post GPS pings, record check-in events |
| Guardian | `6` | Read live trip data for trips their children are on |

### Permission classes

| Class | Behaviour |
|---|---|
| `IsAdmin` | Allows only `user_type == '1'` |
| `IsAdminOrDirector` | Allows `user_type` in `('1', '2')` |
| `IsAdminOrDirectorOrManager` | Allows `user_type` in `('1', '2', '3')` |
| `IsSelfOrAdminOrDirector` | Object-level: allows if `obj.pk == request.user.pk` or Admin/Director |
| `IsDriverOfTrip` | Object-level: allows if `trip.driver == request.user` or Admin/Director/Manager |

---

## Authorization

### Login

```http
POST /api/auth/login/
Content-Type: application/json

{
  "email": "user@school.com",
  "password": "password"
}
```

Response:
```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>",
  "user": { ... }
}
```

### Authenticated requests

```http
GET /api/users/
Authorization: Bearer <access_token>
```

### Token refresh

```http
POST /api/auth/refresh/
Content-Type: application/json

{ "refresh": "<refresh_token>" }
```

### WebSocket connection

```
wss://<host>/ws/trips/<trip_id>/track/?token=<access_token>
```

Close codes: `4001` unauthenticated, `4003` unauthorized.

---

## API Reference

All endpoints are prefixed with `/api/`.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login/` | Obtain access + refresh tokens |
| `POST` | `/auth/refresh/` | Refresh access token |

### Users
| Method | Endpoint | Description |
|---|---|---|
| `GET POST` | `/users/` | List / create users |
| `GET PATCH DELETE` | `/users/{id}/` | Retrieve / update / deactivate |
| `GET PATCH` | `/users/me/` | Current user profile |
| `POST` | `/users/me/change-password/` | Change own password |
| `GET` | `/users/drivers/` | List active drivers in school |

### Schools
| Method | Endpoint | Description |
|---|---|---|
| `GET POST` | `/schools/` | List / create schools |
| `GET PATCH DELETE` | `/schools/{id}/` | Retrieve / update / deactivate |

### Vehicles
| Method | Endpoint | Description |
|---|---|---|
| `GET POST` | `/vehicles/` | List / create vehicles |
| `GET` | `/vehicles/available/` | Available vehicles in school |
| `GET PATCH DELETE` | `/vehicles/{id}/` | Retrieve / update / delete |
| `PATCH` | `/vehicles/{id}/assign-driver/` | Assign driver to vehicle |

### Routes
| Method | Endpoint | Description |
|---|---|---|
| `GET POST` | `/routes/` | List / create routes |
| `GET PATCH DELETE` | `/routes/{id}/` | Retrieve / update / delete |
| `GET POST` | `/routes/{id}/stops/` | List / add stops |
| `GET PATCH DELETE` | `/routes/{id}/stops/{stop_id}/` | Manage individual stop |

### Students
| Method | Endpoint | Description |
|---|---|---|
| `GET POST` | `/students/` | List / create students |
| `GET PATCH DELETE` | `/students/{id}/` | Retrieve / update / deactivate |
| `POST` | `/students/{id}/generate-code/` | Regenerate QR/PIN check-in code |
| `GET POST` | `/students/{id}/routes/` | List / assign route |
| `GET PATCH DELETE` | `/students/{id}/routes/{assignment_id}/` | Manage route assignment |

### Trips
| Method | Endpoint | Description |
|---|---|---|
| `GET POST` | `/trips/` | List / schedule trips |
| `GET PATCH` | `/trips/{id}/` | Retrieve / update trip |
| `POST` | `/trips/{id}/start/` | Driver starts trip |
| `POST` | `/trips/{id}/end/` | Driver ends trip |
| `POST` | `/trips/{id}/checkin/` | Record board / alight event |
| `POST` | `/trips/{id}/ping/` | Post GPS location |
| `GET` | `/trips/{id}/pings/` | Full ping history |

### WebSocket
```
ws://<host>/ws/trips/<trip_id>/track/?token=<access_token>
```

Server pushes:
```json
{ "type": "gps_ping",   "data": { "latitude": 0.0, "longitude": 0.0, "speed_kmh": 0.0, "heading": 0.0, "recorded_at": "" } }
{ "type": "eta_update", "data": { "stop_etas": { "<stop_id>": "<minutes>" } } }
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | Python 3.12 |
| Framework | Django 6, Django REST Framework |
| ASGI server | Daphne 4 |
| Real-time | Django Channels 4 |
| Channel layer | channels-redis, Redis (Upstash) |
| Background tasks | Celery 5, Redis broker |
| Database | PostgreSQL 15 (Aiven) |
| Authentication | djangorestframework-simplejwt |
| Static files | WhiteNoise |
| CORS | django-cors-headers |
| Config | python-decouple |
| Notifications | Firebase FCM, Twilio, SendGrid |
| Hosting | Render (free tier) |

---

## Project Structure

```
school_ride_api/
├── config/
│   ├── settings.py         # All settings, env-var driven via python-decouple
│   ├── asgi.py             # ProtocolTypeRouter - HTTP + WebSocket
│   ├── celery.py           # Celery app configuration
│   └── urls.py             # Root URL conf → /api
├── api/
│   └── urls.py             # DRF DefaultRouter - all ViewSets registered here
├── apps/
│   ├── users/              # Custom User model, JWT auth views, permission classes
│   ├── schools/            # School model - multi-tenant boundary
│   ├── vehicles/           # Vehicle, Route, Stop models
│   ├── students/           # Student, StudentRoute models
│   ├── trips/              # Trip, GPSPing, CheckInEvent models
│   ├── notifications/      # Notification model, Celery delivery tasks
│   └── tracking/           # Django Channels WebSocket consumer + routing
├── mixins.py               # SchoolScopedMixin
├── requirements.txt
└── manage.py
```

---

## Local Development

### Prerequisites

- Python 3.12
- PostgreSQL 15
- Redis

### Setup

```bash
git clone https://github.com/Bennyjoez/school_ride.git
cd school_ride
python -m venv env
source env/bin/activate
cd school_ride_api
pip install -r requirements.txt
```

Create a `.env` file in `school_ride_api/`:

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=school_ride
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

REDIS_URL=redis://localhost:6379/0

ACCESS_TOKEN_LIFETIME_MINUTES=60
REFRESH_TOKEN_LIFETIME_DAYS=7

DEFAULT_FROM_EMAIL=noreply@schoolfleet.app

# Leave blank until integrating third-party services
FCM_SERVER_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
```

### Run migrations and create admin

```bash
python manage.py migrate
python manage.py create_default_admin
```

### Start the server

```bash
# Terminal 1 - Django via Daphne (required for WebSocket support)
daphne -p 8000 config.asgi:application

# Terminal 2 - Celery worker
celery -A config worker -l info

# Terminal 3 - Celery beat (scheduled tasks)
celery -A config beat -l info
```

The API is available at `http://localhost:8000/api/`.

---

## Production Deployment (Render)

**Root Directory:** `school_ride_api`

**Build command:**
```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate && python manage.py create_default_admin
```

**Start command:**
```bash
daphne -b 0.0.0.0 -p $PORT config.asgi:application
```

**Required environment variables on Render:**

| Key | Value |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings` |
| `SECRET_KEY` | Generated secret key |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `your-app.onrender.com` |
| `DATABASE_URL` | Aiven PostgreSQL Service URI |
| `REDIS_URL` | Upstash Redis URL (`rediss://...`) |
| `CORS_ALLOWED_ORIGINS` | `https://bennyjoez.github.io` |

---

## License

MIT License.
