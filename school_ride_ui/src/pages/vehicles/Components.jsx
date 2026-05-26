import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createVehicle,
  updateVehicle,
  assignDriver,
  getSchools,
} from "../../api/endpoints/resources";
import { getDrivers } from "../../api/endpoints/users";
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  ErrorMessage,
  Spinner,
} from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import {
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_BADGE,
  VEHICLE_TYPE_LABEL,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "../../hooks/constants";
import { format } from "date-fns";
import { useSelector } from "react-redux";
import { selectIsAdmin } from "../../store/authSlice";


// Vehicle form modal 

export function VehicleFormModal({ open, onClose, vehicle }) {
  const isAdmin = useSelector(selectIsAdmin);
  const isEdit = Boolean(vehicle);
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
      setApiError(null);
      reset(
        isEdit
          ? {
              vehicle_type: vehicle.vehicle_type,
              license_plate: vehicle.license_plate,
              capacity: vehicle.capacity,
              status: vehicle.status,
              school: vehicle.school,
            }
          : { vehicle_type: "1", status: "available" },
      );
    }
  }, [open, vehicle]);

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => getSchools().then((r) => r.data),
    enabled: open && isAdmin, // only admins pick a school
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? updateVehicle(vehicle.id, data) : createVehicle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      onClose();
    },
    onError: (err) => setApiError(err),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Vehicle" : "Add Vehicle"}
    >
      <form
        onSubmit={handleSubmit((d) => mutation.mutateAsync(d))}
        className="space-y-4"
      >
        <ErrorMessage error={apiError} />
        <Select
          label="Vehicle type"
          error={errors.vehicle_type?.message}
          {...register("vehicle_type", {
            required: "Vehicle type is required",
          })}
        >
          {VEHICLE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          label="License plate"
          placeholder="KCA123B"
          error={errors.license_plate?.message}
          {...register("license_plate", {
            required: "License plate is required",
            pattern: {
              value: /^[A-Za-z0-9]{5,10}$/,
              message: "Must be 5–10 alphanumeric characters",
            },
          })}
        />
        <Input
          label="Capacity (seats)"
          type="number"
          placeholder="30"
          error={errors.capacity?.message}
          {...register("capacity", {
            required: "Capacity is required",
            min: { value: 1, message: "Must be at least 1" },
            valueAsNumber: true,
          })}
        />
        {isEdit && (
          <Select
            label="Status"
            error={errors.status?.message}
            {...register("status", { required: "Status is required" })}
          >
            {VEHICLE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        {isAdmin && (
          <Select
            label="Assign School"
            error={errors.school?.message}
            {...register('school', { required: 'School is required' })}
          >
            <option value="">Select a school</option>
            {schools?.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add vehicle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}



// Assign driver modal 
export function AssignDriverModal({ open, onClose, vehicle }) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);
  const [driverId, setDriverId] = useState("");

  const { data: drivers, isLoading: loadingDrivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers().then((r) => r.data),
    enabled: open,
  });

  useState(() => {
    if (open) {
      setApiError(null);
      setDriverId(vehicle?.driver ?? "");
    }
  }, [open, vehicle]);

  const mutation = useMutation({
    mutationFn: () => assignDriver(vehicle.id, { driver_id: Number(driverId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      onClose();
    },
    onError: (err) => setApiError(err),
  });

  return (
    <Modal open={open} onClose={onClose} title="Assign Driver">
      <div className="space-y-4">
        <ErrorMessage error={apiError} />
        <p className="text-sm text-gray-500">
          Assigning a driver to{" "}
          <span className="font-medium text-gray-800">
            {vehicle?.license_plate}
          </span>
          .
        </p>
        {loadingDrivers ? (
          <div className="flex justify-center py-4">
            <Spinner className="text-primary-600" />
          </div>
        ) : !drivers?.length ? (
          <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
            No active drivers in this school.
          </div>
        ) : (
          <Select
            label="Select driver"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            <option value="">Unassign driver</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.phone_number}
              </option>
            ))}
          </Select>
        )}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={loadingDrivers}
          >
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  );
}



// Vehicles table 

export function VehiclesTable({
  vehicles,
  loading,
  onEdit,
  onAssignDriver,
  onDelete,
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!vehicles?.length) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No vehicles found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {[
              "Plate",
              "Type",
              "Capacity",
              "Driver",
              "Status",
              "Updated",
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
        <tbody className="bg-white divide-y divide-gray-50">
          {vehicles.map((v) => (
            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <span className="text-sm font-mono font-semibold text-gray-900">
                  {v.license_plate}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {VEHICLE_TYPE_LABEL[v.vehicle_type] ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {v.capacity} seats
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {v.driver_name ?? (
                  <span className="text-gray-300 italic">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant={VEHICLE_STATUS_BADGE[v.status] ?? "default"}>
                  {VEHICLE_STATUS_LABEL[v.status] ?? v.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-gray-400">
                {format(new Date(v.updated_at), "dd MMM yyyy")}
              </td>
              <td className="px-4 py-3">
                <RoleGuard allowedRoles={["1", "2", "3"]}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onEdit(v)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onAssignDriver(v)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Driver
                    </button>
                    <button
                      onClick={() => onDelete(v)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </RoleGuard>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}