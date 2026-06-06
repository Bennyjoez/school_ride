// src/pages/trips/TripsPage.jsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getTrips,
} from "../../api/endpoints/resources";
import {
  PageHeader,
  Button,
} from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import { TripFormModal, TripsTable } from "./Components";

// Main page
export default function TripsPage() {
  const [formModal, setFormModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: () => getTrips().then((r) => r.data),
    refetchInterval: 30_000, // refresh every 30s to catch active trip updates
  });

  const filtered = useMemo(() => {
    if (!trips) return [];
    return trips.filter((t) => {
      const matchSearch = search
        ? t.route_name.toLowerCase().includes(search.toLowerCase()) ||
          (t.driver_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (t.vehicle_plate ?? "").toLowerCase().includes(search.toLowerCase())
        : true;
      const matchStatus = statusFilter ? t.status === statusFilter : true;
      const matchDate = dateFilter ? t.trip_date === dateFilter : true;
      return matchSearch && matchStatus && matchDate;
    });
  }, [trips, search, statusFilter, dateFilter]);

  // Summary counts
  const scheduled = trips?.filter((t) => t.status === "scheduled").length ?? 0;
  const active = trips?.filter((t) => t.status === "active").length ?? 0;
  const completed = trips?.filter((t) => t.status === "completed").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips"
        subtitle={`${trips?.length ?? 0} total`}
        action={
          <RoleGuard allowedRoles={["1", "2", "3"]}>
            <Button onClick={() => setFormModal(true)}>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Schedule Trip
            </Button>
          </RoleGuard>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Scheduled",
            value: scheduled,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
          },
          {
            label: "Active",
            value: active,
            color: "text-green-600",
            bg: "bg-green-50",
            border: "border-green-100",
          },
          {
            label: "Completed",
            value: completed,
            color: "text-gray-600",
            bg: "bg-gray-50",
            border: "border-gray-200",
          },
        ].map(({ label, value, color, bg, border }) => (
          <div
            key={label}
            className={`${bg} rounded-xl border ${border} px-5 py-4`}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Active trips alert */}
      {active > 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            {active} trip{active > 1 ? "s" : ""} currently active
          </p>
          <button
            onClick={() => setStatusFilter("active")}
            className="ml-auto text-xs font-medium text-green-700 hover:text-green-900 underline"
          >
            View active
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by route, driver, or plate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {(search || statusFilter || dateFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setDateFilter("");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <TripsTable trips={filtered} loading={isLoading} />

      <TripFormModal open={formModal} onClose={() => setFormModal(false)} />
    </div>
  );
}
