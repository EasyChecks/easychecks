import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  // Check if user has required role
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on user role
    const dashboardPath = getDashboardPath(user.role)
    return <Navigate to={dashboardPath} replace />
  }

  return children
}

const getDashboardPath = (role) => {
  switch (role) {
    case 'superadmin':
      return '/superadmin'
    case 'admin':
      return '/admin'
    case 'manager':
      return '/manager'
    case 'user':
      return '/user'
    default:
      return '/user'
  }
}

export default ProtectedRoute