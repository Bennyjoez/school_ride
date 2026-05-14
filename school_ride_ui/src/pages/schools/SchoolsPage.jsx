// src/pages/schools/SchoolsPage.jsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchools, deactivateSchool } from "../../api/endpoints/resources";
import { PageHeader, Button, ConfirmModal } from "../../components/ui";
import { SchoolsTable } from "./Components";
import { SchoolFormModal } from "./SchoolFormModal";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function SchoolsPage() {
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState({ open: false, school: null });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    school: null,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: () => getSchools().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    if (!schools) return [];
    return schools.filter((s) => {
      const matchSearch = search
        ? s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.region.toLowerCase().includes(search.toLowerCase()) ||
          s.timezone.toLowerCase().includes(search.toLowerCase()) ||
          s.region.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchStatus =
        statusFilter === "active"
          ? s.is_active
          : statusFilter === "inactive"
            ? !s.is_active
            : true;
      return matchSearch && matchStatus;
    });
  }, [schools, search, statusFilter]);

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateSchool(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      setConfirmModal({ open: false, school: null });
    },
  });

  const activeCount = schools?.filter((s) => s.is_active).length ?? 0;
  const totalCount = schools?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools"
        subtitle={`${activeCount} active · ${totalCount} total`}
        action={
          <Button onClick={() => setFormModal({ open: true, school: null })}>
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
            Create School
          </Button>
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
            placeholder="Search by name or region..."
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
            Clear filters
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Total", value: totalCount, color: "text-gray-900" },
          { label: "Active", value: activeCount, color: "text-green-600" },
          {
            label: "Inactive",
            value: totalCount - activeCount,
            color: "text-gray-400",
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

      {/* Table */}
      <SchoolsTable
        schools={filtered}
        loading={isLoading}
        onEdit={(school) => setFormModal({ open: true, school })}
        onDeactivate={(school) => setConfirmModal({ open: true, school })}
      />

      <SchoolFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, school: null })}
        school={formModal.school}
      />

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, school: null })}
        onConfirm={() => deactivateMutation.mutate(confirmModal.school?.id)}
        loading={deactivateMutation.isPending}
        title="Deactivate School"
        message={`Are you sure you want to deactivate "${confirmModal.school?.name}"? All associated users and vehicles will lose access. This can be reversed by an administrator.`}
      />
    </div>
  );
}
