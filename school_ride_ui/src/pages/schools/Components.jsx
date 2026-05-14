// src/pages/schools/components.jsx
import { format } from "date-fns";
import { Badge } from "../../components/ui";

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function SchoolsTable({ schools, loading, onEdit, onDeactivate }) {
  if (loading) return <SkeletonRows />;

  if (!schools?.length) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No schools found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {[
              "School",
              "Region",
              "Timezone",
              "Status",
              "Created",
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
          {schools.map((school) => (
            <tr
              key={school.id}
              className={`transition-colors ${
                school.is_active ? "hover:bg-gray-50" : "bg-gray-50 opacity-60"
              }`}
            >
              {/* Name with initial avatar */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700
                    flex items-center justify-center text-xs font-bold shrink-0"
                  >
                    {school.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {school.name}
                  </span>
                </div>
              </td>

              {/* Region */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {school.region}
              </td>

              {/* Timezone */}
              <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">
                {school.timezone}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <Badge variant={school.is_active ? "green" : "default"}>
                  {school.is_active ? "Active" : "Inactive"}
                </Badge>
              </td>

              {/* Created date */}
              <td className="px-4 py-3 text-sm text-gray-400">
                {format(new Date(school.created_at), "dd MMM yyyy")}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onEdit(school)}
                    className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                  >
                    Edit
                  </button>
                  {school.is_active && (
                    <button
                      onClick={() => onDeactivate(school)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                  {!school.is_active && (
                    <span className="text-xs text-gray-400 italic">
                      Inactive
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
