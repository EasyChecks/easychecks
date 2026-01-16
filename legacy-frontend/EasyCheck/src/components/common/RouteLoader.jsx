import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLoading } from '../../contexts/useLoading'

function RouteLoader({ children }) {
  const location = useLocation()
  const { showLoading } = useLoading()

  // แสดง loading เมื่อเปลี่ยนหน้า (child component จะ hideLoading เอง)
  useEffect(() => {
    showLoading('กำลังโหลด...')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return children
}

export default RouteLoader
