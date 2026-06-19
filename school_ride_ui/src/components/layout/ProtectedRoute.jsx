// src/components/layout/ProtectedRoute.jsx
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { selectCurrentUser } from "../../store/authSlice";

/**
 * Redirects to /login if the user is not authenticated.
 */
export function ProtectedRoute({ children }) {
  const user = useSelector(selectCurrentUser);
  const location = useLocation();

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Renders children only if the user's role is in allowedRoles.
 * Otherwise renders fallback (default: nothing).
 *
 * Usage:
 *   <RoleGuard allowedRoles={['1', '2']}>
 *     <CreateUserButton />
 *   </RoleGuard>
 */
export function RoleGuard({ allowedRoles, children, isRouteNavigation = false, fallback = null }) {
  const user = useSelector(selectCurrentUser);
  if (!user) return fallback;
  if (!allowedRoles.includes(user.user_type)){
    if (isRouteNavigation) {
      return <Navigate to="/dashboard" replace />;
    } else {
      return fallback;
    }
  }
  return children;
}
