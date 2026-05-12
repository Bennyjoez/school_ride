// src/pages/dashboard/DashboardPage.jsx
import { useSelector } from 'react-redux'
import { selectCurrentUser } from '../../store/authSlice'

export default function DashboardPage() {
  const user = useSelector(selectCurrentUser)
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">
        Welcome back, {user?.name}
      </h1>
      <p className="text-sm text-gray-500">
        {user?.school_name} - Dashboard coming soon.
      </p>
    </div>
  )
}
