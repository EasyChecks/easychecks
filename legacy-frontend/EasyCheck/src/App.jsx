import React, { useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { runAttendanceMigration } from './utils/attendanceDataMigration'

// Loading Component - Memoized เพื่อป้องกัน re-render
const LoadingScreen = memo(() => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-orange-50">
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-700 font-medium">กำลังโหลด...</p>
    </div>
  </div>
));

LoadingScreen.displayName = 'LoadingScreen';

function App() {
  const { user, loading, getDashboardPath } = useAuth()
  const navigate = useNavigate()

  // 🔄 Run data migration on app start
  useEffect(() => {
    runAttendanceMigration();
  }, []);

  useEffect(() => {
    if (!loading) {
      if (user) {
        // ผู้ใช้ล็อกอินแล้ว - ไปหน้า dashboard
        const dashboardPath = getDashboardPath(user.role)
        navigate(dashboardPath, { replace: true })
      } else {
        // ผู้ใช้ยังไม่ล็อกอิน - ไปหน้า auth
        navigate('/auth', { replace: true })
      }
    }
  }, [user, loading, navigate, getDashboardPath])

  if (loading) {
    return <LoadingScreen />
  }

  return null();
}

export default App
