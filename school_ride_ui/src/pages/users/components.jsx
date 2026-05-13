import { ROLELABELS } from "../../hooks/constants"

export function UsersTable({ users, loading, handleEdit }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!users?.length) {
    return (
      <div className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No users found.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Email', 'Phone', 'Type', 'Bio', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {users.map(user => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {user.email}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">{user.phone_number ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{ROLELABELS[user.user_type] ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{user.bio ?? '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                <button className="text-blue-500 hover:text-blue-700" onClick={() => handleEdit(user)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}