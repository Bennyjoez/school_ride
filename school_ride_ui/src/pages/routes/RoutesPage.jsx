// src/pages/vehicles/RoutesPage.jsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getStops,
  createStop,
  updateStop,
  deleteStop,
  getVehicles,
} from "../../api/endpoints/resources";
import { getDrivers } from "../../api/endpoints/users";
import {
  PageHeader,
  Button,
  Input,
  Select,
  Modal,
  ConfirmModal,
  Badge,
  ErrorMessage,
  Spinner,
} from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import { DIRECTION_LABEL, DIRECTION_OPTIONS } from "../../hooks/constants";
import { format } from "date-fns";
import { RouteFormModal, RoutesTable } from "./Components";

// Main page

export default function RoutesPage() {
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState({ open: false, route: null });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    route: null,
  });
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: () => getRoutes().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    if (!routes) return [];
    return routes.filter((r) => {
      const matchSearch = search
        ? r.name.toLowerCase().includes(search.toLowerCase()) ||
          (r.driver_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (r.vehicle_license ?? "").toLowerCase().includes(search.toLowerCase())
        : true;
      const matchDir = dirFilter ? r.direction === dirFilter : true;
      const matchStatus =
        statusFilter === "active"
          ? r.is_active
          : statusFilter === "inactive"
            ? !r.is_active
            : true;
      return matchSearch && matchDir && matchStatus;
    });
  }, [routes, search, dirFilter, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      setConfirmModal({ open: false, route: null });
    },
  });

  const activeCount = routes?.filter((r) => r.is_active).length ?? 0;
  const totalCount = routes?.length ?? 0;
  const totalStops =
    routes?.reduce((acc, r) => acc + (r.stops?.length ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Routes"
        subtitle={`${activeCount} active · ${totalCount} total`}
        action={
          <RoleGuard allowedRoles={["1", "2", "3"]}>
            <Button onClick={() => setFormModal({ open: true, route: null })}>
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
              Create Route
            </Button>
          </RoleGuard>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Routes", value: totalCount, color: "text-gray-900" },
          { label: "Active", value: activeCount, color: "text-green-600" },
          {
            label: "Total Stops",
            value: totalStops,
            color: "text-primary-600",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4"
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
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
            placeholder="Search by name, driver, or vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Direction filter */}
        <select
          value={dirFilter}
          onChange={(e) => setDirFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All directions</option>
          {DIRECTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {(search || dirFilter || statusFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setDirFilter("");
              setStatusFilter("");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-400">
        Click a route row to expand and manage its stops.
      </p>

      {/* Table */}
      <RoutesTable
        routes={filtered}
        loading={isLoading}
        onEdit={(route) => setFormModal({ open: true, route })}
        onDelete={(route) => setConfirmModal({ open: true, route })}
      />

      {/* Route form modal */}
      <RouteFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, route: null })}
        route={formModal.route}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, route: null })}
        onConfirm={() => deleteMutation.mutate(confirmModal.route?.id)}
        loading={deleteMutation.isPending}
        title="Delete Route"
        message={`Are you sure you want to delete "${confirmModal.route?.name}"? All stops and student assignments for this route will also be removed.`}
      />
    </div>
  );
}
