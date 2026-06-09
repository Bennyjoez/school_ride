import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createStudent,
  updateStudent,
  generateCode,
  getStudentRoutes,
  assignStudentRoute,
  removeStudentRoute,
  getRoutes,
} from "../../api/endpoints/resources";
import { getUsers } from "../../api/endpoints/users";
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
import { DIRECTION_LABEL } from "../../hooks/constants";

// Student form modal
export function StudentFormModal({ open, onClose, student }) {
  const isEdit = Boolean(student);
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  const { data: guardians } = useQuery({
    queryKey: ["users", "guardians"],
    queryFn: () =>
      getUsers().then((r) =>
        r.data.filter((u) => u.user_type === "6" && u.is_active),
      ),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiError(null);
    reset(
      isEdit
        ? {
            full_name: student.full_name,
            grade: student.grade,
            guardian: student.guardian ?? "",
          }
        : {
            full_name: "",
            grade: "",
            guardian: "",
          },
    );
  }, [isEdit, open, reset, student, guardians]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, guardian: data.guardian || null };
      return isEdit
        ? updateStudent(student.id, payload)
        : createStudent(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
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
      title={isEdit ? "Edit Student" : "Add Student"}
    >
      <form
        onSubmit={handleSubmit((d) => mutation.mutateAsync(d))}
        className="space-y-4"
      >
        <ErrorMessage error={apiError} />
        <Input
          label="Full name"
          placeholder="Jane Doe"
          error={errors.full_name?.message}
          {...register("full_name", { required: "Full name is required" })}
        />
        <Input
          label="Grade"
          placeholder="Grade 5"
          error={errors.grade?.message}
          {...register("grade", { required: "Grade is required" })}
        />
        <Select label="Guardian (optional)" {...register("guardian")}>
          <option value="">No guardian assigned</option>
          {guardians?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} — {g.phone_number}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add student"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Route assignment modal
export function RouteAssignmentModal({ open, onClose, student }) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);

  const { data: routes } = useQuery({
    queryKey: ["routes"],
    queryFn: () => getRoutes().then((r) => r.data.filter((r) => r.is_active)),
    enabled: open,
  });

  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ["student-routes", student?.id],
    queryFn: () => getStudentRoutes(student.id).then((r) => r.data),
    enabled: open && Boolean(student),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedRoute = watch("route");

  // Stops for the selected route
  const selectedRouteObj = routes?.find((r) => String(r.id) === String(watchedRoute));
  const stops = selectedRouteObj?.stops ?? [];

  useEffect(() => {
    if (!open) return;

    setApiError(null);
    reset({});
  }, [open, reset]);

  const assignMutation = useMutation({
    mutationFn: (data) => assignStudentRoute(student.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-routes", student.id],
      });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      reset({});
    },
    onError: (err) => setApiError(err),
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId) => removeStudentRoute(student.id, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["student-routes", student.id],
      });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Routes — ${student?.full_name}`}
      className="max-w-lg"
    >
      <div className="space-y-5">
        <ErrorMessage error={apiError} />

        {/* Current assignments */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Current assignments
          </p>
          {loadingAssignments ? (
            <div className="flex justify-center py-4">
              <Spinner className="text-primary-600" />
            </div>
          ) : !assignments?.length ? (
            <p className="text-xs text-gray-400 italic">
              No routes assigned yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {a.route_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {a.stop_name} ·{" "}
                      {DIRECTION_LABEL[a.direction] ?? a.direction}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.is_active ? "green" : "default"}>
                      {a.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <button
                      onClick={() => removeMutation.mutate(a.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new assignment */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Assign to route
          </p>
          <form
            onSubmit={handleSubmit((d) => assignMutation.mutateAsync(d))}
            className="space-y-3"
          >
            <Select
              label="Route"
              error={errors.route?.message}
              {...register("route", { required: "Route is required" })}
            >
              <option value="">Select a route</option>
              {routes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>

            <Select
              label="Stop"
              error={errors.stop?.message}
              {...register("stop", { required: "Stop is required" })}
              disabled={!stops.length}
            >
              <option value="">Select a stop</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sequence}. {s.name}
                </option>
              ))}
            </Select>

            <Select
              label="Direction"
              error={errors.direction?.message}
              {...register("direction", { required: "Direction is required" })}
            >
              <option value="">Select direction</option>
              <option value="AM">Morning (AM)</option>
              <option value="PM">Afternoon (PM)</option>
            </Select>

            <Button type="submit" size="sm" loading={isSubmitting}>
              Assign route
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

// Generate code modal
export function GenerateCodeModal({ open, onClose, student }) {
  const queryClient = useQueryClient();
  const [newCode, setNewCode] = useState(null);

  const mutation = useMutation({
    mutationFn: () => generateCode(student.id),
    onSuccess: (res) => {
      setNewCode(res.data.student_code);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  useState(() => {
    if (open) setNewCode(null);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Check-in Code">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Current code for{" "}
          <span className="font-medium text-gray-800">
            {student?.full_name}
          </span>
          :
        </p>

        {/* Current / new code display */}
        <div className="flex justify-center">
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl px-8 py-6 text-center">
            <p className="text-3xl font-mono font-bold tracking-widest text-gray-900">
              {newCode ?? student?.student_code}
            </p>
            {newCode && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                New code generated
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          This code is used for QR scan or PIN check-in at boarding/alighting.
        </p>

        <div className="flex justify-between pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            Regenerate code
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Students table
export function StudentsTable({
  students,
  loading,
  onEdit,
  onDeactivate,
  onRoutes,
  onCode,
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!students?.length) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No students found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {[
              "Student",
              "Grade",
              "Guardian",
              "Code",
              "Routes",
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
        <tbody className="bg-white divide-y divide-gray-50">
          {students.map((s) => (
            <tr
              key={s.id}
              className={`transition-colors ${s.is_active ? "hover:bg-gray-50" : "bg-gray-50 opacity-60"}`}
            >
              {/* Name */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full bg-primary-100 text-primary-700
                    flex items-center justify-center text-xs font-semibold shrink-0"
                  >
                    {s.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {s.full_name}
                  </span>
                </div>
              </td>

              {/* Grade */}
              <td className="px-4 py-3 text-sm text-gray-500">{s.grade}</td>

              {/* Guardian */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {s.guardian_name ?? (
                  <span className="text-gray-300 italic">None</span>
                )}
              </td>

              {/* Code */}
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {s.student_code}
                </span>
              </td>

              {/* Route count */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {s.route_assignments?.filter((a) => a.is_active).length ?? 0}{" "}
                active
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <Badge variant={s.is_active ? "green" : "default"}>
                  {s.is_active ? "Active" : "Inactive"}
                </Badge>
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <RoleGuard allowedRoles={["1", "2", "3"]}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => onEdit(s)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onRoutes(s)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Routes
                    </button>
                    <button
                      onClick={() => onCode(s)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      Code
                    </button>
                    {s.is_active && (
                      <button
                        onClick={() => onDeactivate(s)}
                        className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
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
