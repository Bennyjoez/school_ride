// src/pages/users/components.jsx
import { Badge } from '../../components/ui'
import { RoleGuard } from '../../components/layout/ProtectedRoute'
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from '../../hooks/constants'

// Skeleton loader
function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// Action buttons
function RowActions({ user, currentUser, onEdit, onDeactivate }) {
  const isSelf = user.id === currentUser?.id

  return (
    <div className="flex items-center gap-3">
      {/* Edit — Admin or Director only, or self */}
      <RoleGuard allowedRoles={['1', '2']}>
        <button
          onClick={() => onEdit(user)}
          className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
        >
          Edit
        </button>
      </RoleGuard>

      {/* Deactivate — Admin or Director, cannot deactivate self */}
      <RoleGuard allowedRoles={['1', '2']}>
        {user.is_active && !isSelf && (
          <button
            onClick={() => onDeactivate(user)}
            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
          >
            Deactivate
          </button>
        )}
      </RoleGuard>

      {/* Inactive label */}
      {!user.is_active && (
        <span className="text-xs text-gray-400 italic">Inactive</span>
      )}
    </div>
  )
}

// Main table
export function UsersTable({ users, loading, currentUser, onEdit, onDeactivate }) {
  if (loading) return <SkeletonRows />

  if (!users?.length) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No users found.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Email', 'Phone', 'Role', 'School', 'Status', 'Actions'].map(h => (
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
          {users.map(user => (
            <tr
              key={user.id}
              className={`transition-colors ${
                user.is_active ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'
              }`}
            >
              {/* Name */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {/* Avatar initial */}
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700
                    flex items-center justify-center text-xs font-semibold shrink-0">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                </div>
              </td>

              {/* Email */}
              <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>

              {/* Phone */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {user.phone_number ?? '—'}
              </td>

              {/* Role badge */}
              <td className="px-4 py-3">
                <Badge variant={ROLE_BADGE_VARIANT[user.user_type] ?? 'default'}>
                  {ROLE_LABELS[user.user_type] ?? '—'}
                </Badge>
              </td>

              {/* School */}
              <td className="px-4 py-3 text-sm text-gray-500">
                {user.school_name ?? '—'}
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <Badge variant={user.is_active ? 'green' : 'default'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <RowActions
                  user={user}
                  currentUser={currentUser}
                  onEdit={onEdit}
                  onDeactivate={onDeactivate}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}