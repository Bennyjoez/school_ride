import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import {
  createRoute,
  updateRoute,
  createStop,
  updateStop,
  deleteStop,
  getVehicles,
  getSchools,
} from "../../api/endpoints/resources";
import { getDrivers } from "../../api/endpoints/users";
import {
  Button,
  Input,
  Select,
  Modal,
  ConfirmModal,
  Badge,
  ErrorMessage,
} from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import {
  DIRECTION_BADGE,
  DIRECTION_LABEL,
  DIRECTION_OPTIONS,
} from "../../hooks/constants";
import { selectIsAdmin } from "../../store/authSlice";

// Route form modal
export function RouteFormModal({ open, onClose, route }) {
  const isAdmin = useSelector(selectIsAdmin);
  const isEdit = Boolean(route);
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => getSchools().then((r) => r.data),
    enabled: open && isAdmin, // only admins pick a school
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles().then((r) => r.data),
    enabled: open,
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers().then((r) => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiError(null);
      reset(
        isEdit
          ? {
              name: route.name,
              direction: route.direction,
              scheduled_start: route.scheduled_start ?? "",
              vehicle: route.vehicle ?? "",
              driver: route.driver ?? "",
              school: route.school ?? "",
            }
          : {
              direction: "AM",
            },
      );
    }
  }, [isEdit, open, reset, route]);

  const mutation = useMutation({
    mutationFn: (data) => {
      // Send null for empty optional FK fields
      const payload = {
        ...data,
        vehicle: data.vehicle || null,
        driver: data.driver || null,
      };
      return isEdit ? updateRoute(route.id, payload) : createRoute(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      setApiError(null);
      reset();
      onClose();
    },
    onError: (err) => setApiError(err),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Route" : "Create Route"}
    >
      <form
        onSubmit={handleSubmit((d) => mutation.mutateAsync(d))}
        className="space-y-4"
      >
        <ErrorMessage error={apiError} />

        <Input
          label="Route name"
          placeholder="Westlands Morning Route"
          error={errors.name?.message}
          {...register("name", { required: "Route name is required" })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Direction"
            error={errors.direction?.message}
            {...register("direction", { required: "Direction is required" })}
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <Input
            label="Scheduled start"
            type="time"
            error={errors.scheduled_start?.message}
            {...register("scheduled_start")}
          />
        </div>

        {isAdmin && (
          <Select
            label="Assign School"
            error={errors.school?.message}
            {...register("school", { required: "School is required" })}
          >
            <option value="">Select a school</option>
            {schools?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}

        <Select label="Assign vehicle (optional)" {...register("vehicle")}>
          <option value="">No vehicle assigned</option>
          {vehicles?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.license_plate} -{" "}
              {v.vehicle_type === "1"
                ? "Bus"
                : v.vehicle_type === "2"
                  ? "Van"
                  : "Car"}
            </option>
          ))}
        </Select>

        <Select label="Assign driver (optional)" {...register("driver")}>
          <option value="">No driver assigned</option>
          {drivers?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} - {d.phone_number}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create route"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Stop form modal
export function StopFormModal({ open, onClose, routeId, stop }) {
  const isEdit = Boolean(stop);
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiError(null);
      reset(
        isEdit
          ? {
              name: stop.name,
              latitude: stop.latitude,
              longitude: stop.longitude,
              sequence: stop.sequence,
              eta_minutes: stop.eta_minutes,
            }
          : {
              sequence: 1,
              eta_minutes: 0,
            },
      );
    }
  }, [isEdit, open, reset, stop]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? updateStop(routeId, stop.id, data) : createStop(routeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      setApiError(null);
      reset();
      onClose();
    },
    onError: (err) => setApiError(err),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Stop" : "Add Stop"}
    >
      <form
        onSubmit={handleSubmit((d) => mutation.mutateAsync(d))}
        className="space-y-4"
      >
        <ErrorMessage error={apiError} />

        <Input
          label="Stop name"
          placeholder="Westlands Stage"
          error={errors.name?.message}
          {...register("name", { required: "Stop name is required" })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Latitude"
            type="number"
            step="any"
            placeholder="-1.268320"
            error={errors.latitude?.message}
            {...register("latitude", {
              required: "Latitude is required",
              min: { value: -90, message: "Min -90" },
              max: { value: 90, message: "Max 90" },
              valueAsNumber: true,
            })}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            placeholder="36.811140"
            error={errors.longitude?.message}
            {...register("longitude", {
              required: "Longitude is required",
              min: { value: -180, message: "Min -180" },
              max: { value: 180, message: "Max 180" },
              valueAsNumber: true,
            })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Sequence"
            type="number"
            placeholder="1"
            error={errors.sequence?.message}
            {...register("sequence", {
              required: "Sequence is required",
              min: { value: 1, message: "Must be 1 or greater" },
              valueAsNumber: true,
            })}
          />
          <Input
            label="ETA (minutes from start)"
            type="number"
            placeholder="0"
            error={errors.eta_minutes?.message}
            {...register("eta_minutes", {
              required: "ETA is required",
              min: { value: 0, message: "Cannot be negative" },
              valueAsNumber: true,
            })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save stop" : "Add stop"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Stops panel (inline expandable per route)
export function StopsPanel({ route }) {
  const queryClient = useQueryClient();
  const [stopModal, setStopModal] = useState({ open: false, stop: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, stop: null });

  const stops = route.stops ?? [];

  const deleteMutation = useMutation({
    mutationFn: (stopId) => deleteStop(route.id, stopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      setConfirmModal({ open: false, stop: null });
    },
  });

  return (
    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {stops.length} Stop{stops.length !== 1 ? "s" : ""}
        </p>
        <RoleGuard allowedRoles={["1", "2", "3"]}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setStopModal({ open: true, stop: null })}
          >
            + Add stop
          </Button>
        </RoleGuard>
      </div>

      {stops.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No stops added yet.</p>
      ) : (
        <div className="space-y-1">
          {[...stops]
            .sort((a, b) => a.sequence - b.sequence)
            .map((stop) => (
              <div
                key={stop.id}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-5 h-5 rounded-full bg-primary-100 text-primary-700
                  text-xs font-bold flex items-center justify-center shrink-0"
                  >
                    {stop.sequence}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {stop.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {stop.eta_minutes} min ·{" "}
                      {Number(stop.latitude).toFixed(4)},{" "}
                      {Number(stop.longitude).toFixed(4)}
                    </p>
                  </div>
                </div>
                <RoleGuard allowedRoles={["1", "2", "3"]}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStopModal({ open: true, stop })}
                      className="text-xs text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmModal({ open: true, stop })}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </RoleGuard>
              </div>
            ))}
        </div>
      )}

      <StopFormModal
        open={stopModal.open}
        onClose={() => setStopModal({ open: false, stop: null })}
        routeId={route.id}
        stop={stopModal.stop}
      />

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, stop: null })}
        onConfirm={() => deleteMutation.mutate(confirmModal.stop?.id)}
        loading={deleteMutation.isPending}
        title="Remove Stop"
        message={`Remove "${confirmModal.stop?.name}" from this route?`}
      />
    </div>
  );
}

// Routes table

export function RoutesTable({ routes, loading, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!routes?.length) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No routes found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {[
              "Route",
              "Direction",
              "Start",
              "Vehicle",
              "Driver",
              "Stops",
              "Status",
              "Actions",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {routes.map((route) => (
            <>
              <tr
                key={route.id}
                className={`transition-colors cursor-pointer ${
                  route.is_active ? "hover:bg-gray-50" : "bg-gray-50 opacity-60"
                }`}
                onClick={() =>
                  setExpandedId(expandedId === route.id ? null : route.id)
                }
              >
                {/* Route name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                        expandedId === route.id ? "rotate-90" : ""
                      }`}
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
                    <span className="text-sm font-medium text-gray-900">
                      {route.name}
                    </span>
                  </div>
                </td>

                {/* Direction */}
                <td className="px-4 py-3">
                  <Badge
                    variant={DIRECTION_BADGE[route.direction] ?? "default"}
                  >
                    {DIRECTION_LABEL[route.direction] ?? route.direction}
                  </Badge>
                </td>

                {/* Scheduled start */}
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                  {route.scheduled_start ?? "-"}
                </td>

                {/* Vehicle */}
                <td className="px-4 py-3 text-sm text-gray-500">
                  {route.vehicle_license ?? (
                    <span className="text-gray-300 italic">None</span>
                  )}
                </td>

                {/* Driver */}
                <td className="px-4 py-3 text-sm text-gray-500">
                  {route.driver_name ?? (
                    <span className="text-gray-300 italic">None</span>
                  )}
                </td>

                {/* Stop count */}
                <td className="px-4 py-3 text-sm text-gray-500">
                  {route.stops?.length ?? 0}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Badge variant={route.is_active ? "green" : "default"}>
                    {route.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>

                {/* Actions */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <RoleGuard allowedRoles={["1", "2", "3"]}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onEdit(route)}
                        className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(route)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </RoleGuard>
                </td>
              </tr>

              {/* Expandable stops panel */}
              {expandedId === route.id && (
                <tr key={`stops-${route.id}`}>
                  <td colSpan={8} className="p-0">
                    <StopsPanel route={route} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
