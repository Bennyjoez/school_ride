# SchoolFleet

A multi-tenant school bus fleet management system that gives schools real-time visibility into their vehicle fleet, automates student check-in and check-out, and keeps guardians informed throughout every trip.

---

## The Problem Solved

Schools operating bus fleets face a fragmented operational reality: drivers have no structured way to report their position, guardians have no visibility into where their child's bus is, administrators have no audit trail of who boarded or alighted, and fleet managers have no single place to coordinate vehicles, routes, and drivers. Incidents go unrecorded. ETAs are guesswork. Guardians call the school office repeatedly for updates.

SchoolFleet replaces that chaos with a single platform that connects every stakeholder - from the system administrator provisioning a new school down to a guardian watching a bus move across a map in real time.

---

## Features

### Multi-tenant school isolation
Every school operates in a fully isolated data environment. Vehicles, routes, students, trips, and users belonging to one school are never visible to another. Isolation is enforced at the database query level through a `SchoolScopedMixin` applied to every ViewSet - not just at the UI layer.

### Role-based access control
Six distinct roles govern what each user can see and do. Permissions are enforced on every API endpoint, not just in the frontend. See the RBAC section below for the full matrix.

### Real-time GPS tracking
Drivers stream their location from a mobile browser every few seconds via a REST ping endpoint. The server saves each ping to PostgreSQL and simultaneously broadcasts it over a Django Channels WebSocket to any connected guardian clients. Guardians see a live-updating map without polling.

### Student check-in and check-out
Each student has a unique QR code or PIN. Drivers and teachers scan or enter the code at boarding and alighting. Every event is timestamped, attributed to the recorder, and linked to the stop where it occurred, creating a full audit log per trip.

### ETA calculation
A Celery background task fires on every GPS ping, recalculates arrival estimates for each remaining stop on the route, and pushes updated ETAs back to connected guardian clients over the same WebSocket channel.

### Guardian notifications
Push, SMS, and email alerts are dispatched when a trip starts, when the bus is approaching a student's stop, and when a student boards or alights. Delivery is handled by Celery workers using Firebase Cloud Messaging, Twilio, and SendGrid.

### Vehicle lifecycle management
Vehicle status transitions automatically between `available`, `in_service`, and `maintenance`. The assign-driver endpoint enforces that only users with the Driver role can be assigned to a vehicle.

### Soft deletes throughout
No user, student, or school record is ever hard-deleted. Records are deactivated (`is_active = False`), preserving audit history and referential integrity.

---

## Architectural Decisions

### Django REST Framework + Daphne (ASGI)
The backend is served by Daphne rather than a traditional WSGI server. This is a deliberate choice: `manage.py runserver` does not support WebSockets. Daphne handles both standard HTTP requests and the persistent WebSocket connections used for live GPS feeds through a single ASGI entry point.

### Django Channels + Redis for real-time
Rather than polling, guardian clients open a single persistent WebSocket connection. The driver's GPS ping hits a REST endpoint; the server saves the data and then publishes it to a Redis-backed Channels group. All connected clients in that group receive the update immediately. Redis acts as the channel layer broker, decoupling the HTTP handler from the WebSocket consumers.

### Celery + Redis for background work
ETA recalculation and notification delivery are offloaded to Celery workers. This keeps the GPS ping endpoint fast - it saves the ping, publishes to the channel layer, and returns 201 in milliseconds. The heavy work (distance calculations, third-party API calls) happens asynchronously.

### Queryset-level multi-tenancy
The `SchoolScopedMixin` overrides `get_queryset()` and `perform_create()` on every ViewSet. Non-admin users can only ever retrieve or create records within their own school. This is enforced at the ORM level, so even a crafted API request cannot leak cross-school data.

### JWT authentication
Stateless JWT tokens (access + refresh) are used throughout. The access token is short-lived (60 minutes). Refresh tokens allow silent renewal without re-authentication. WebSocket connections pass the token as a query parameter at handshake time, since browser WebSocket APIs cannot send custom headers.

### React + Redux Toolkit + React Query
The frontend separates concerns cleanly: Redux Toolkit owns authentication state (tokens, current user) which persists across page loads; React Query owns all server data (users, trips, vehicles) with automatic caching and background refetching. Axios intercepts 401 responses, silently refreshes the token, and retries the original request - users are never unexpectedly logged out mid-session.

### Monorepo structure
The API and UI live in the same repository under `school_ride_api/` and `school_ride_ui/`. This simplifies cross-cutting changes (e.g. adding a new endpoint and its corresponding frontend call in one pull request) while keeping deployment independent - the backend deploys to Render and the frontend deploys to GitHub Pages through separate CI/CD pipelines.

---

## RBAC - Role-Based Access Control

| Role | Code | Scope | Key Permissions |
|---|---|---|---|
| Admin | `1` | System-wide | Full access to all schools, users, and data. Only role with cross-school visibility. |
| Director | `2` | School-scoped | Full access within their school. Can manage staff, fleet, routes, and reports. |
| Manager | `3` | School-scoped | Manage fleet and routes. Cannot manage other staff accounts. |
| Teacher | `4` | School | Record student check-in and check-out events. View trips. |
| Driver | `5` | Own trips only | Start and end assigned trips. Post GPS pings. Record check-in events. |
| Guardian | `6` | Own children | View live map for trips their children are on. Receive notifications. View ETAs. |

### Permission enforcement layers

Permissions are enforced at three independent layers, so no single bypass is sufficient:

**1. ViewSet-level permissions** - Each ViewSet declares `permission_classes`. Write actions require at minimum `IsAdminOrDirectorOrManager`. Start/end/ping actions on trips require `IsDriverOfTrip`.

**2. Object-level permissions** - `IsSelfOrAdminOrDirector` and `IsDriverOfTrip` implement `has_object_permission()`, checked after the object is retrieved. A Driver cannot start another driver's trip even if they know the trip ID.

**3. Queryset-level scoping** - `SchoolScopedMixin` filters the queryset before any permission check runs. A user cannot even discover that records from another school exist.

---

## Authorization

### JWT flow

```
POST /api/v1/auth/login/   { email, password }
→ { access, refresh, user }

POST /api/v1/auth/refresh/  { refresh }
→ { access }
```

Every subsequent request must include:
```
Authorization: Bearer <access_token>
```

### WebSocket authorization

WebSocket handshakes cannot carry `Authorization` headers. The token is passed as a query parameter:

```
wss://<host>/ws/trips/<trip_id>/track/?token=<access_token>
```

The `TripTrackingConsumer` validates the token on connection, checks that the connecting user belongs to the correct school, and for Guardian users verifies that at least one of their children is assigned to a route on this trip. Invalid or unauthorized connections receive close code `4001` (unauthenticated) or `4003` (unauthorized) and are immediately disconnected.

### Silent token refresh

The Axios instance intercepts every 401 response, calls `/auth/refresh/` with the stored refresh token, updates the Redux store with the new access token, and retries the original request transparently. If the refresh call itself fails (expired or revoked refresh token), the user is logged out and redirected to the login page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend language | Python 3.12 |
| Web framework | Django 6, Django REST Framework |
| ASGI server | Daphne 4 |
| Real-time | Django Channels 4, Redis (channel layer) |
| Background tasks | Celery 5, Redis (broker) |
| Database | PostgreSQL 15 (Aiven hosted) |
| Authentication | Simple JWT |
| Frontend framework | React 18, Vite |
| Client state | Redux Toolkit, Redux Persist |
| Server state | TanStack React Query v5 |
| HTTP client | Axios (with JWT interceptor) |
| Routing | React Router v6 (`createHashRouter`) |
| Styling | Tailwind CSS v3 |
| Forms | React Hook Form |
| Maps | Leaflet (CDN) |
| Notifications | Firebase Cloud Messaging, Twilio, SendGrid |
| CI/CD | GitHub Actions |
| Frontend hosting | GitHub Pages |
| Backend hosting | Render |
| Redis hosting | Upstash |

---

## Repository Structure

```
school_ride/
├── .github/
│   └── workflows/
│       └── deploy-ui.yml       # GitHub Actions - builds and deploys UI to GitHub Pages
├── school_ride_api/            # Django backend
│   └── README.md
├── school_ride_ui/             # React frontend
│   └── README.md
├── .gitignore
├── .gitleaks.toml
└── README.md                   # This file
```

---

## Live Deployment

| Service | URL |
|---|---|
| Frontend | `https://bennyjoez.github.io/school_ride/` |
| Backend API | `https://<your-app>.onrender.com/api/` |
| API Docs | `https://<your-app>.onrender.com/api/docs/` |

---

## License

MIT License.


