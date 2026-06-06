// src/pages/students/StudentsPage.jsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStudents,
  deactivateStudent,
} from "../../api/endpoints/resources";
import {
  PageHeader,
  Button,
  ConfirmModal,
} from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import {
  StudentFormModal,
  StudentsTable,
  RouteAssignmentModal,
  GenerateCodeModal,
} from "./Components";

//  Main page
export default function StudentsPage() {
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState({ open: false, student: null });
  const [routeModal, setRouteModal] = useState({ open: false, student: null });
  const [codeModal, setCodeModal] = useState({ open: false, student: null });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    student: null,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => getStudents().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => {
      const matchSearch = search
        ? s.full_name.toLowerCase().includes(search.toLowerCase()) ||
          s.student_code.toLowerCase().includes(search.toLowerCase()) ||
          (s.guardian_name ?? "").toLowerCase().includes(search.toLowerCase())
        : true;
      const matchStatus =
        statusFilter === "active"
          ? s.is_active
          : statusFilter === "inactive"
            ? !s.is_active
            : true;
      return matchSearch && matchStatus;
    });
  }, [students, search, statusFilter]);

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setConfirmModal({ open: false, student: null });
    },
  });

  const activeCount = students?.filter((s) => s.is_active).length ?? 0;
  const totalCount = students?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${activeCount} active · ${totalCount} total`}
        action={
          <RoleGuard allowedRoles={["1", "2", "3"]}>
            <Button onClick={() => setFormModal({ open: true, student: null })}>
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
              Add Student
            </Button>
          </RoleGuard>
        }
      />

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
            placeholder="Search by name, code, or guardian..."
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <StudentsTable
        students={filtered}
        loading={isLoading}
        onEdit={(s) => setFormModal({ open: true, student: s })}
        onDeactivate={(s) => setConfirmModal({ open: true, student: s })}
        onRoutes={(s) => setRouteModal({ open: true, student: s })}
        onCode={(s) => setCodeModal({ open: true, student: s })}
      />

      {formModal.open && (
        <StudentFormModal
          open={formModal.open}
          onClose={() => setFormModal({ open: false, student: null })}
          student={formModal.student}
        />
      )}

      <RouteAssignmentModal
        open={routeModal.open}
        onClose={() => setRouteModal({ open: false, student: null })}
        student={routeModal.student}
      />

      <GenerateCodeModal
        open={codeModal.open}
        onClose={() => setCodeModal({ open: false, student: null })}
        student={codeModal.student}
      />

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, student: null })}
        onConfirm={() => deactivateMutation.mutate(confirmModal.student?.id)}
        loading={deactivateMutation.isPending}
        title="Deactivate Student"
        message={`Deactivate ${confirmModal.student?.full_name}? They will no longer appear in active listings.`}
      />
    </div>
  );
}
