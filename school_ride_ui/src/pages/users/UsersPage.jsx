// src/pages/users/UsersPage.jsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../../store/authSlice";
import { getUsers, deactivateUser } from "../../api/endpoints/users";
import { PageHeader, Button, ConfirmModal } from "../../components/ui";
import { RoleGuard } from "../../components/layout/ProtectedRoute";
import { UsersTable } from "./Components";
import { UserFormModal } from "./UserFormModal";

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "1", label: "Admin" },
  { value: "2", label: "Director" },
  { value: "3", label: "Manager" },
  { value: "4", label: "Teacher" },
  { value: "5", label: "Driver" },
  { value: "6", label: "Guardian" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function UsersPage() {
  const currentUser = useSelector(selectCurrentUser);
  const queryClient = useQueryClient();

  // Modal state
  const [formModal, setFormModal] = useState({ open: false, user: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, user: null });

  // Filter state
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
  });

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchRole = roleFilter ? u.user_type === roleFilter : true;
      const matchStatus =
        statusFilter === "active"
          ? u.is_active
          : statusFilter === "inactive"
            ? !u.is_active
            : true;
      const matchSearch = search
        ? u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchRole && matchStatus && matchSearch;
    });
  }, [users, roleFilter, statusFilter, search]);

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setConfirmModal({ open: false, user: null });
    },
  });

  const activeCount = users?.filter((u) => u.is_active).length ?? 0;
  const totalCount = users?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Users"
        subtitle={`${activeCount} active · ${totalCount} total`}
        action={
          <RoleGuard allowedRoles={["1", "2"]}>
            <Button onClick={() => setFormModal({ open: true, user: null })}>
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
              Create User
            </Button>
          </RoleGuard>
        }
      />

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
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {ROLE_FILTER_OPTIONS.map((o) => (
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
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Clear */}
        {(roleFilter || statusFilter || search) && (
          <button
            onClick={() => {
              setRoleFilter("");
              setStatusFilter("");
              setSearch("");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <UsersTable
        users={filtered}
        loading={isLoading}
        currentUser={currentUser}
        onEdit={(user) => setFormModal({ open: true, user })}
        onDeactivate={(user) => setConfirmModal({ open: true, user })}
      />

      {/* Create / Edit modal */}
      <UserFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, user: null })}
        user={formModal.user}
      />

      {/* Deactivate confirmation */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, user: null })}
        onConfirm={() => deactivateMutation.mutate(confirmModal.user?.id)}
        loading={deactivateMutation.isPending}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${confirmModal.user?.name}? They will no longer be able to log in.`}
      />
    </div>
  );
}
