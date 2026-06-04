// src/router/index.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { ProtectedRoute } from "../components/layout/ProtectedRoute";

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
      { path: "dashboard", element: <DashboardPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "schools", element: <SchoolsPage /> },
      { path: "vehicles", element: <VehiclesPage /> },
      { path: "routes", element: <RoutesPage /> },
      { path: "students", element: <StudentsPage /> },
      { path: "trips", element: <TripsPage /> },
      { path: "trips/:id", element: <TripDetailPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "trips/:id/map", element: <LiveMapPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
