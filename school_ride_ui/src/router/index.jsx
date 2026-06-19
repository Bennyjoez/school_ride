// src/router/index.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { ProtectedRoute, RoleGuard } from "../components/layout/ProtectedRoute";

import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import UsersPage from "../pages/users/UsersPage";
import SchoolsPage from "../pages/schools/SchoolsPage";
import VehiclesPage from "../pages/vehicles/VehiclesPage";
import RoutesPage from "../pages/routes/RoutesPage";
import StudentsPage from "../pages/students/StudentsPage";
import TripsPage from "../pages/trips/TripsPage";
import TripDetailPage from "../pages/trips/TripDetailPage";
import ProfilePage from "../pages/profile/ProfilePage";
import NotFoundPage from "../pages/NotFoundPage";
import LiveMapPage from "../pages/trips/Livemappage";
import NotificationsPage from "../pages/notifications/NotificationPage";

// Define role constants for cleaner code readability
const ADMINS = ["1", "2", "3"]; 
const STAFF = ["1", "2", "3", "4", "5"];
const ALL_ROLES = ["1", "2", "3", "4", "5", "6"];

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      
      // Shared Routes across all roles
      { path: "dashboard", element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "trips/:id/map", element: <LiveMapPage /> },

      // Notifications (Everyone except Teachers and Drivers)
      { 
        path: "notifications", 
        element: (
          <RoleGuard allowedRoles={["1", "2", "3", "6"]} isRouteNavigation={true} >
            <NotificationsPage />
          </RoleGuard>
        ) 
      },

      // Trip Management (Admins, School Directors, Managers, Teachers, Drivers)
      { 
        path: "trips", 
        element: (
          <RoleGuard allowedRoles={STAFF} isRouteNavigation={true} >
            <TripsPage />
          </RoleGuard>
        ) 
      },
      { 
        path: "trips/:id", 
        element: (
          <RoleGuard allowedRoles={STAFF} isRouteNavigation={true} >
            <TripDetailPage />
          </RoleGuard>
        ) 
      },

      // Admin & Management Only Routes
      { 
        path: "users", 
        element: (
          <RoleGuard allowedRoles={ADMINS} isRouteNavigation={true} >
            <UsersPage />
          </RoleGuard>
        ) 
      },
      { 
        path: "schools", 
        element: (
          <RoleGuard allowedRoles={ADMINS} isRouteNavigation={true} >
            <SchoolsPage />
          </RoleGuard>
        ) 
      },
      { 
        path: "vehicles", 
        element: (
          <RoleGuard allowedRoles={ADMINS} isRouteNavigation={true} >
            <VehiclesPage />
          </RoleGuard>
        ) 
      },
      { 
        path: "routes", 
        element: (
          <RoleGuard allowedRoles={ADMINS} isRouteNavigation={true} >
            <RoutesPage />
          </RoleGuard>
        ) 
      },
      { 
        path: "students", 
        element: (
          <RoleGuard allowedRoles={ADMINS} isRouteNavigation={true} >
            <StudentsPage />
          </RoleGuard>
        ) 
      },

      // Fallback 404
      { path: "*", element: <NotFoundPage /> }
    ]
  },
]);