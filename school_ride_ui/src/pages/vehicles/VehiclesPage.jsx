// src/pages/vehicles/VehiclesPage.jsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVehicles,
  deleteVehicle,
} from "../../api/endpoints/resources";
import {
  PageHeader,
  Button,
  ConfirmModal,
} from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import { AssignDriverModal, VehicleFormModal, VehiclesTable } from "./Components";

// Constants 

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "in_service", label: "In Service" },
  { value: "maintenance", label: "Maintenance" },
];

// Main page 

export default function VehiclesPage() {
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState({ open: false, vehicle: null });
  const [assignModal, setAssignModal] = useState({
    open: false,
    vehicle: null,
  });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    vehicle: null,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter((v) => {
      const matchStatus = statusFilter ? v.status === statusFilter : true;
      const matchSearch = search
        ? v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
          (v.driver_name ?? "").toLowerCase().includes(search.toLowerCase())
        : true;
      return matchStatus && matchSearch;
    });
  }, [vehicles, statusFilter, search]);

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setConfirmModal({ open: false, vehicle: null });
    },
  });

  const available =
    vehicles?.filter((v) => v.status === "available").length ?? 0;
  const inService =
    vehicles?.filter((v) => v.status === "in_service").length ?? 0;
  const maintenance =
    vehicles?.filter((v) => v.status === "maintenance").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        subtitle={`${vehicles?.length ?? 0} total`}
        action={
          <RoleGuard allowedRoles={["1", "2", "3"]}>
            <Button onClick={() => setFormModal({ open: true, vehicle: null })}>
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
              Add Vehicle
            </Button>
          </RoleGuard>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Available",
            value: available,
            color: "text-green-600",
            bg: "bg-green-50",
            border: "border-green-100",
          },
          {
            label: "In Service",
            value: inService,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
          },
          {
            label: "Maintenance",
            value: maintenance,
            color: "text-red-500",
            bg: "bg-red-50",
            border: "border-red-100",
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
            placeholder="Search by plate or driver..."
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
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
          >
            Clear
          </button>
        )}
      </div>

      <VehiclesTable
        vehicles={filtered}
        loading={isLoading}
        onEdit={(v) => setFormModal({ open: true, vehicle: v })}
        onAssignDriver={(v) => setAssignModal({ open: true, vehicle: v })}
        onDelete={(v) => setConfirmModal({ open: true, vehicle: v })}
      />

      <VehicleFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, vehicle: null })}
        vehicle={formModal.vehicle}
      />

      <AssignDriverModal
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, vehicle: null })}
        vehicle={assignModal.vehicle}
      />

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, vehicle: null })}
        onConfirm={() => deleteMutation.mutate(confirmModal.vehicle?.id)}
        loading={deleteMutation.isPending}
        title="Delete Vehicle"
        message={`Are you sure you want to permanently delete ${confirmModal.vehicle?.license_plate}? This cannot be undone.`}
      />
    </div>
  );
}
