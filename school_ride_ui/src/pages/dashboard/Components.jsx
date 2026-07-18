// src/pages/dashboard/components.jsx
// Shared components used across all role dashboards

import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";

// Stat Card
export function StatCard({
  label,
  value,
  icon,
  color = "blue",
  linkTo,
  loading,
}) {
  const colors = {
    blue: {
      bg: "bg-blue-50",
      icon: "bg-blue-100 text-blue-600",
      text: "text-blue-700",
    },
    green: {
      bg: "bg-green-50",
      icon: "bg-green-100 text-green-600",
      text: "text-green-700",
    },
    amber: {
      bg: "bg-amber-50",
      icon: "bg-amber-100 text-amber-600",
      text: "text-amber-700",
    },
    red: {
      bg: "bg-red-50",
      icon: "bg-red-100 text-red-600",
      text: "text-red-700",
    },
    purple: {
      bg: "bg-purple-50",
      icon: "bg-purple-100 text-purple-600",
      text: "text-purple-700",
    },
  };
  const c = colors[color];

  const inner = (
    <div
      className={`${c.bg} rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between pt-50 bg-red-50">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            {label}
          </p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-3xl font-bold ${c.text}`}>{value ?? "-"}</p>
          )}
        </div>
        <div className={`${c.icon} p-2.5 rounded-xl`}>{icon}</div>
      </div>
      {linkTo && (
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
          View all
          <svg
            className="w-1 h-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </p>
      )}
    </div>
  );

  if (linkTo) return <Link to={linkTo}>{inner}</Link>;
  return inner;
}

// Section Header
export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        {title}
      </h2>
      {action}
    </div>
  );
}

// Trip Status Badge
export function TripStatusBadge({ status }) {
  const styles = {
    scheduled: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-600",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] ?? styles.scheduled}`}
    >
      {status === "active" && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
      )}
      {status}
    </span>
  );
}

// Recent Trips Table
export function RecentTripsTable({ trips, loading }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!trips?.length) {
    return (
      <div className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No trips found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {["Route", "Date", "Driver", "Vehicle", "Status"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {trips.map((trip) => (
            <tr key={trip.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {trip.route_name}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {trip.trip_date
                  ? format(parseISO(trip.trip_date), "dd MMM yyyy")
                  : "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {trip.driver_name ?? "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">
                {trip.vehicle_plate ?? "-"}
              </td>
              <td className="px-4 py-3">
                <TripStatusBadge status={trip.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Empty State
export function EmptyState({ icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center bg-gray-50 rounded-2xl border border-gray-100">
      <div className="text-gray-300 mb-3">{icon}</div>
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
}

// Quick Link Card─
export function QuickLink({ to, label, icon, description }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm transition-all group"
    >
      <div className="p-2 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}
