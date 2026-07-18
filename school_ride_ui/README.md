# SchoolFleet UI

The frontend application for SchoolFleet - a multi-tenant school bus fleet management system. Built with React 18 and deployed to GitHub Pages, it provides role-specific dashboards, live GPS maps, fleet management tools, and real-time trip tracking for every stakeholder in the school transport workflow.

---

## The Problem Solved

Managing a school bus fleet involves six different types of users who each need a completely different interface: an administrator provisioning schools and staff, a director monitoring fleet health, a manager dispatching vehicles, a teacher recording student check-ins, a driver navigating a route, and a guardian watching their child's bus approach. A single generic interface serves none of them well. SchoolFleet UI renders a tailored experience for each role from a shared codebase, driven by the authenticated user's role stored in Redux on login.

---

## Features

### Role-specific dashboards
Each of the six roles lands on a dashboard built for their workflow. Admins and Directors see fleet-wide statistics and a live map. Teachers see today's active trips with direct check-in links. Drivers see an active trip banner with start/end controls. Guardians see their children's route assignments and a live tracking alert when a bus is active.

### Live fleet map
The Admin and Director dashboards include a Leaflet map that opens a WebSocket connection per active trip. Bus markers update their position and heading in real time as the driver posts GPS pings. Stop markers display ETA labels that update on each ping. A dashed polyline traces the vehicle's path. The map degrades gracefully when no trips are active.

### Fleet management
Full CRUD for vehicles, routes, and stops. Vehicles can be assigned drivers via a dedicated modal. Route stops are managed inline within an expandable stops panel, sortable by sequence. Vehicle status cards summarise the fleet at a glance (available / in-service / maintenance).

### Student management
Students are created with an automatically generated check-in code. Route assignments link a student to a specific route, stop, and direction. Codes can be regenerated on demand. A guardian dropdown filters to users with the Guardian role only.

### Trip management
Trips are scheduled against a route, vehicle, and driver. An active trip alert banner pulses when trips are in progress. The list auto-refreshes every 30 seconds. Trip detail pages expose start/end controls, a live mini-map, a check-in form for teachers and drivers, a check-in event log, and GPS ping history.

### Silent JWT refresh
The Axios instance intercepts every 401 response, calls the refresh endpoint, updates the Redux store with the new access token, and retries the original request. Users are never interrupted by token expiry during normal use. If the refresh itself fails, the user is redirected to login.

### Profile management
Users can view their profile, update their name, phone, and bio, and change their password - all within a tabbed profile page. Saving profile changes updates the Redux store immediately so the sidebar reflects the new name without a page reload.

---

## Architectural Decisions

### Redux Toolkit for auth state, React Query for server state
These two concerns are kept strictly separate. Redux Toolkit persists the JWT tokens and current user across page loads (via redux-persist). React Query manages all server data - users, trips, vehicles, etc. - with automatic caching, background refetching, and cache invalidation on mutations. Mixing them would lead to stale data and complex synchronisation logic.

### `createHashRouter` for GitHub Pages compatibility
React Router's `createBrowserRouter` uses the HTML5 History API, which requires a server that returns `index.html` for all routes. GitHub Pages serves static files and returns 404 for any path it cannot resolve to a file. `createHashRouter` encodes the route in the URL fragment (`/#/dashboard`), which is handled entirely client-side and never sent to the server. This makes every route reloadable without server configuration.

### Leaflet via CDN, not npm
Leaflet is included via CDN script tags in `index.html` and accessed through `window.L`. This avoids bundling Leaflet's CSS and JS through Vite (which requires additional configuration for the icon assets) and keeps the bundle size smaller. The tradeoff is a runtime dependency on the CDN, which is acceptable for this application's deployment context.

### Role-aware rendering with RoleGuard
`RoleGuard` is used at both the route level (wrapping entire pages) and the component level (wrapping individual buttons and actions). A Director sees the Edit and Deactivate buttons on the users table; a Teacher sees the same table but without those controls. The same component tree serves all roles - visibility is controlled by `allowedRoles` prop checks against the Redux-stored `user_type`.

### Vite proxy for local development
`vite.config.js` proxies `/api` and `/ws` to the local Daphne server during development. In production, the `VITE_API_URL` and `VITE_WS_URL` environment variables are injected at build time by GitHub Actions and baked into the bundle. The proxy block is ignored during production builds.

---

## RBAC - What Each Role Sees

| Page / Feature | Admin | Director | Manager | Teacher | Driver | Guardian |
|---|---|---|---|---|---|---|
| Admin dashboard (stats + fleet map) | ✅ | ✅ | ✅ | - | - | - |
| Teacher dashboard (today's trips) | - | - | - | ✅ | - | - |
| Driver dashboard (active trip banner) | - | - | - | - | ✅ | - |
| Guardian dashboard (children + live alert) | - | - | - | - | - | ✅ |
| Users page (full CRUD) | ✅ | ✅ | - | - | - | - |
| Schools page | ✅ | - | - | - | - | - |
| Vehicles page | ✅ | ✅ | ✅ | - | - | - |
| Routes page | ✅ | ✅ | ✅ | - | - | - |
| Students page | ✅ | ✅ | ✅ | - | - | - |
| Trips list | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Trip detail (start/end) | ✅ | ✅ | ✅ | - | ✅ | - |
| Trip detail (check-in form) | - | - | - | ✅ | ✅ | - |
| Live map | ✅ | ✅ | ✅ | - | - | ✅ |
| Notifications | ✅ | ✅ | ✅ | - | - | ✅ |
| Profile page | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Authorization

### Login flow

The login page posts credentials to `POST /api/auth/login/`. On success, the response `{ access, refresh, user }` is dispatched to Redux via `setCredentials`. The access token is attached to every subsequent Axios request via a request interceptor.

### Token refresh flow

```
Request → 401 response
  → POST /auth/refresh/ with stored refresh token
  → Success: store new access token, retry original request
  → Failure: dispatch logout(), redirect to /login
```

### Route protection

All routes are wrapped in `<ProtectedRoute>`, which checks for a user in Redux and redirects to `/login` if absent. Individual pages are further wrapped in `<RoleGuard allowedRoles={[...]}>`, which redirects to `/dashboard` if the user's role is not in the allowed list.

### WebSocket authentication

The `useWebSocket` hook appends the access token from Redux as a query parameter when opening the connection:

```javascript
const url = `${WS_BASE}/ws/trips/${tripId}/track/?token=${token}`
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Language | JavaScript (ES2022) |
| Routing | React Router v6 (`createHashRouter`) |
| Client state | Redux Toolkit, Redux Persist |
| Server state | TanStack React Query v5 |
| HTTP client | Axios |
| Styling | Tailwind CSS v3 |
| Forms | React Hook Form |
| Maps | Leaflet 1.9 (CDN via `window.L`) |
| Date utilities | date-fns |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

---

## Project Structure

```
school_ride_ui/
├── public/
│   └── .nojekyll               # Disables Jekyll on GitHub Pages
├── src/
│   ├── api/
│   │   ├── axios.js            # Axios instance with JWT attach + silent refresh
│   │   └── endpoints/
│   │       ├── users.js        # Auth, user CRUD, password change
│   │       └── resources.js    # Schools, vehicles, routes, students, trips
│   ├── store/
│   │   ├── index.js            # Redux store configuration
│   │   └── authSlice.js        # Auth state, selectors, actions
│   ├── hooks/
│   │   ├── constants.js        # Role labels, badge variants, status maps
│   │   └── useWebSocket.js     # WebSocket hook with JWT auth
│   ├── components/
│   │   ├── ui/
│   │   │   └── index.jsx       # Button, Input, Select, Modal, Table, Badge, etc.
│   │   └── layout/
│   │       ├── AppLayout.jsx   # Sidebar + Outlet shell
│   │       ├── Sidebar.jsx     # Role-aware nav, user card, sign out
│   │       └── ProtectedRoute.jsx  # ProtectedRoute + RoleGuard
│   ├── pages/
│   │   ├── auth/               # LoginPage
│   │   ├── dashboard/          # Role-specific dashboards + FleetMap
│   │   ├── users/              # UsersPage, UserFormModal, UsersTable
│   │   ├── schools/            # SchoolsPage, SchoolFormModal
│   │   ├── vehicles/           # VehiclesPage, RoutesPage
│   │   ├── students/           # StudentsPage
│   │   ├── trips/              # TripsPage, TripDetailPage, LiveMapPage
│   │   ├── notifications/      # NotificationsPage
│   │   └── profile/            # ProfilePage
│   ├── router/
│   │   └── index.jsx           # createHashRouter - all routes defined here
│   └── App.jsx                 # QueryClientProvider + RouterProvider
├── index.html                  # Leaflet CDN tags here
├── vite.config.js
└── package.json
```

---

## Local Development

### Prerequisites

- Node.js 20.19.4
- The backend running locally on port 8000 (see `school_ride_api/README.md`)

### Setup

```bash
cd school_ride_ui
npm install --legacy-peer-deps
```

### Environment

Create `.env.development` in `school_ride_ui/`:

```env
VITE_API_URL=http://localhost:8000/api/
VITE_WS_URL=ws://localhost:8000
```

The Vite proxy in `vite.config.js` handles `/api` and `/ws` automatically for local development, so this file is optional locally - the proxy takes precedence.

### Start

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## Production Deployment (GitHub Pages)

Deployment is fully automated via GitHub Actions. Every push to the `stage` branch that touches `school_ride_ui/**` triggers the workflow.

### Required GitHub repository secrets

| Secret | Value |
|---|---|
| `VITE_API_URL` | `https://your-app.onrender.com/api/` |
| `VITE_WS_URL` | `wss://your-app.onrender.com` |

### Workflow summary

1. Checkout code on Node 20.19.4
2. `npm install --legacy-peer-deps`
3. `npm run build` with secrets injected as environment variables
4. Push `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`

### GitHub Pages settings

- **Source:** Deploy from a branch
- **Branch:** `gh-pages` / `(root)`

The app is served at `https://bennyjoez.github.io/school_ride/`.

### Manual deploy (without Actions)

```bash
npm run build
npx gh-pages -d dist
```

---

## Important Notes

### Leaflet setup
Both tags must be present in `index.html`. Without the script tag, maps render blank with `window.L is undefined` in the console.

```html
<!-- In <head> -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

<!-- Before </body> -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

### ESLint peer dependency conflict
The project uses `--legacy-peer-deps` for installation due to a peer dependency conflict between `eslint@10` and `eslint-plugin-react@7`. This flag must be used for both local installs and CI.

### Hash routing
URLs take the form `/#/dashboard`, `/#/trips/123`. This is intentional - `createHashRouter` is required for GitHub Pages compatibility. Do not switch to `createBrowserRouter` without also configuring a `404.html` fallback.

---

## License

MIT License.
