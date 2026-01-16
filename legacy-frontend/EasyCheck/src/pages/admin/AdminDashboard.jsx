import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Circle, LayersControl, useMap, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useLocations } from '../../contexts/LocationContext'
import { useEvents } from '../../contexts/EventContext'
import { useAuth } from '../../contexts/useAuth'
import { usersData } from '../../data/usersData'

// Fix for default marker icon issue in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Component to auto-fit bounds to show all markers
function FitBoundsToMarkers({ locations }) {
  const map = useMap()

  useEffect(() => {
    if (locations && locations.length > 0) {
      // Create bounds from all location coordinates
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude])
      )

      // Fit map to bounds with padding - faster animation
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 17,
        animate: true,
        duration: 0.3 // Much faster (reduced from 0.5)
      })
    }
  }, [locations, map])

  return null
}

// Component to get map reference
function MapRefSetter({ mapRef }) {
  const map = useMap()
  
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  
  return null
}

function AdminDashboard() {
  const { user } = useAuth()
  
  // 🆕 Branch filter state (สำหรับ SuperAdmin เท่านั้น)
  const [selectedBranch, setSelectedBranch] = useState('all')
  
  // ✅ ใช้ฟังก์ชันกรองตาม branch
  const { getFilteredLocations } = useLocations()
  const { getFilteredEvents } = useEvents()
  
  // 🆕 กรอง locations และ events ตาม selectedBranch (สำหรับ SuperAdmin)
  const allLocations = getFilteredLocations(user)
  const allEvents = getFilteredEvents(user)
  
  const locations = useMemo(() => {
    if (user?.role !== 'superadmin' || selectedBranch === 'all') {
      return allLocations
    }
    // SuperAdmin เลือกสาขา - กรองจาก createdBy.branch
    // รองรับทั้งแบบ provinceCode (BKK, CNX, PKT) และ branchCode (101, 102, 201, 301)
    const branchPrefix = selectedBranch === 'BKK' ? '1' : 
                        selectedBranch === 'CNX' ? '2' : 
                        selectedBranch === 'PKT' ? '3' : null
    
    const filtered = allLocations.filter(loc => {
      // เช็คแบบตรงๆ กับ branch code (101, 102, 201, 301)
      if (loc.createdBy?.branch === selectedBranch) {
        return true
      }
      // เช็คแบบ prefix สำหรับ BKK, CNX, PKT
      if (branchPrefix && loc.createdBy?.branch?.startsWith(branchPrefix)) {
        return true
      }
      // เช็คจาก branchCode, provinceCode ถ้ามี
      return loc.branchCode === selectedBranch || 
             loc.provinceCode === selectedBranch
    })
    return filtered
  }, [allLocations, selectedBranch, user?.role])
  
  const events = useMemo(() => {
    if (user?.role !== 'superadmin' || selectedBranch === 'all') {
      return allEvents
    }
    // SuperAdmin เลือกสาขา - กรองจาก createdBy.branch (เหมือน locations)
    // รองรับทั้งแบบ provinceCode (BKK, CNX, PKT) และ branchCode (101, 102, 201, 301)
    const branchPrefix = selectedBranch === 'BKK' ? '1' : 
                        selectedBranch === 'CNX' ? '2' : 
                        selectedBranch === 'PKT' ? '3' : null
    
    const filtered = allEvents.filter(evt => {
      // เช็คแบบตรงๆ กับ branch code (101, 102, 201, 301)
      if (evt.createdBy?.branch === selectedBranch) {
        return true
      }
      // เช็คแบบ prefix สำหรับ BKK, CNX, PKT
      if (branchPrefix && evt.createdBy?.branch?.startsWith(branchPrefix)) {
        return true
      }
      // เช็คจาก branchCode, provinceCode ถ้ามี
      return evt.branchCode === selectedBranch || 
             evt.provinceCode === selectedBranch
    })
    return filtered
  }, [allEvents, selectedBranch, user?.role])

  const [statsType, setStatsType] = useState('attendance') // attendance, event
  const [expandedLocationIds, setExpandedLocationIds] = useState([]) // Track which locations are expanded
  const locationRefs = useRef({}) // Refs for scrolling to location cards
  const scrollPositions = useRef({}) // Store scroll positions before expanding
  
  // State for attendance/event details modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailType, setDetailType] = useState(null) // 'absent', 'leave', 'late'
  const [detailUsers, setDetailUsers] = useState([])
  
  // 🆕 Branch options
  const branchOptions = [
    { code: 'all', name: 'สาขา: ทั้งหมด' },
    { code: 'BKK', name: 'BKK (กรุงเทพ)' },
    { code: 'CNX', name: 'CNX (เชียงใหม่)' },
    { code: 'PKT', name: 'PKT (ภูเก็ต)' }
  ]

  // Calculate real attendance stats from usersData and localStorage
  // Wrapped in useCallback to avoid re-creating the function on every render
  const calculateAttendanceStats = useCallback((branchFilter = 'all') => {
    const today = new Date()
    const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear() + 543}` // Thai year
    
    // ดึงข้อมูลจาก localStorage
    let users = usersData
    try {
      const storedUsers = localStorage.getItem('usersData')
      if (storedUsers) {
        users = JSON.parse(storedUsers)
      }
    } catch (e) {
      console.warn('Failed to load usersData from localStorage:', e)
    }
    
    // 🆕 Filter by branch - รองรับทั้ง branchCode (101, 102) และ provinceCode (BKK, CNX, PKT)
    const branchPrefix = branchFilter === 'BKK' ? '1' : 
                        branchFilter === 'CNX' ? '2' : 
                        branchFilter === 'PKT' ? '3' : null
    
    const filteredUsers = users.filter(u => {
      if (u.role === 'admin' || u.role === 'superadmin') return false
      if (branchFilter === 'all') return true
      
      // เช็คแบบตรงๆ กับ branchCode (101, 102, 201, 301)
      if (u.branchCode === branchFilter) {
        return true
      }
      
      // เช็คแบบ prefix สำหรับ BKK, CNX, PKT
      if (branchPrefix && u.branchCode?.startsWith(branchPrefix)) {
        return true
      }
      
      // เช็คจาก provinceCode สำรอง
      return u.provinceCode === branchFilter || u.branch === branchFilter
    })
    
    const totalEmployees = filteredUsers.length
    
    // 🔥 ดึงข้อมูลจริงจาก attendanceRecords ของแต่ละ user
    const absentUsers = []
    const leaveUsers = []
    const lateUsers = []
    const onTimeUsers = []
    
    filteredUsers.forEach(user => {
      // เช็คจาก attendanceRecords
      const todayRecord = user.attendanceRecords?.find(r => r.date === todayStr)
      
      // 🔥 ตรวจสอบ status = 'leave' ก่อน
      if (todayRecord && (todayRecord.status === 'leave' || todayRecord.checkIn?.status === 'leave')) {
        // วันลาที่อนุมัติแล้ว = ลา ไม่ขาด
        leaveUsers.push(user)
      } else if (!todayRecord || !todayRecord.checkIn) {
        // ไม่มีข้อมูลเข้างาน = ขาด (เว้นแต่จะลา)
        absentUsers.push(user)
      } else {
        // มีข้อมูลเข้างาน - เช็คสถานะ
        const checkInStatus = todayRecord.checkIn.status
        
        if (checkInStatus === 'มาสาย') {
          lateUsers.push(user)
        } else if (checkInStatus === 'ตรงเวลา') {
          onTimeUsers.push(user)
        } else if (checkInStatus === 'ขาด') {
          // เข้างานแต่สายเกิน = นับเป็นขาด
          absentUsers.push(user)
        }
      }
    })
    
    return {
      totalEmployees,
      absentCount: absentUsers.length,
      leaveCount: leaveUsers.length,
      lateCount: lateUsers.length,
      onTimeCount: onTimeUsers.length,
      absentUsers,
      leaveUsers,
      lateUsers,
      onTimeUsers
    }
  }, [])

  // 🆕 Calculate stats based on selected branch
  const attendanceStats = useMemo(() => {
    // SuperAdmin: ใช้ selectedBranch, Admin: ใช้ provinceCode ของตัวเอง
    const branchFilter = user?.role === 'superadmin' ? selectedBranch : (user?.provinceCode || user?.branch || 'all')
    return calculateAttendanceStats(branchFilter)
  }, [selectedBranch, user, calculateAttendanceStats])
  
  // 🔥 ฟังการอัปเดตจาก localStorage - ลบ setAttendanceStats เพราะใช้ useMemo แล้ว
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'usersData') {
        // Force re-render by updating selectedBranch
        setSelectedBranch(prev => prev)
      }
    }
    
    const handleAttendanceUpdate = () => {
      // Force re-calculate stats when attendance is updated
      setSelectedBranch(prev => prev)
    }
    
    // เช็คทุก 3 วินาที (สำหรับ same-tab updates)
    const interval = setInterval(() => {
      setSelectedBranch(prev => prev)
    }, 3000)
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('attendanceUpdated', handleAttendanceUpdate)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('attendanceUpdated', handleAttendanceUpdate)
      clearInterval(interval)
    }
  }, [calculateAttendanceStats])

  // Calculate real event stats from EventContext with branch filter
  const calculateEventStats = useCallback((branchFilter = 'all') => {
    const today = new Date()
    const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`
    
    const activeEvents = events.filter(e => e.status === 'ongoing')
    const todayEvents = events.filter(e => e.date === todayStr || e.startDate === todayStr)
    const completedEvents = events.filter(e => e.status === 'completed')
    
    // ดึงข้อมูลจาก localStorage
    let users = usersData
    try {
      const storedUsers = localStorage.getItem('usersData')
      if (storedUsers) {
        users = JSON.parse(storedUsers)
      }
    } catch (e) {
      console.warn('Failed to load usersData from localStorage:', e)
    }
    
    // 🆕 Filter users by branch - รองรับทั้ง branchCode (101, 102) และ provinceCode (BKK, CNX, PKT)
    const branchPrefix = branchFilter === 'BKK' ? '1' : 
                        branchFilter === 'CNX' ? '2' : 
                        branchFilter === 'PKT' ? '3' : null
    
    const filteredUsers = users.filter(u => {
      if (u.role === 'admin' || u.role === 'superadmin') return false
      if (branchFilter === 'all') return true
      
      // เช็คแบบตรงๆ กับ branchCode (101, 102, 201, 301)
      if (u.branchCode === branchFilter) {
        return true
      }
      
      // เช็คแบบ prefix สำหรับ BKK, CNX, PKT
      if (branchPrefix && u.branchCode?.startsWith(branchPrefix)) {
        return true
      }
      
      // เช็คจาก provinceCode สำรอง
      return u.provinceCode === branchFilter || u.branch === branchFilter
    })
    
    // Mock: สร้างรายชื่อผู้ที่ยังไม่เข้าร่วม, ลางาน, มาสาย (เหมือนการเข้างาน)
    // แต่กรองตาม branch แล้ว
    const notParticipatedUsers = filteredUsers.filter(u => u.id % 6 === 0).slice(0, 4)
    const leaveEventUsers = filteredUsers.filter(u => u.id % 4 === 0 && u.id % 6 !== 0).slice(0, 5)
    const lateEventUsers = filteredUsers.filter(u => u.id % 8 === 0 && u.id % 4 !== 0 && u.id % 6 !== 0).slice(0, 4)
    
    return {
      totalEvents: events.length,
      activeEvents: activeEvents.length,
      todayEvents: todayEvents.length,
      completedEvents: completedEvents.length,
      notParticipatedCount: notParticipatedUsers.length,
      leaveEventCount: leaveEventUsers.length,
      lateEventCount: lateEventUsers.length,
      notParticipatedUsers,
      leaveEventUsers,
      lateEventUsers
    }
  }, [events])

  // 🆕 Calculate event stats based on selected branch
  const eventStats = useMemo(() => {
    // SuperAdmin: ใช้ selectedBranch, Admin: ใช้ provinceCode ของตัวเอง
    const branchFilter = user?.role === 'superadmin' ? selectedBranch : (user?.provinceCode || user?.branch || 'all')
    return calculateEventStats(branchFilter)
  }, [selectedBranch, user, calculateEventStats])
  
  // State for search and map controls
  const [searchQuery, setSearchQuery] = useState('')
  const [mapType, setMapType] = useState('default') // 'default' or 'satellite'
  const [filterType, setFilterType] = useState('all') // 'all', 'location', 'event'

  // Handle detail modal open
  const handleDetailClick = (type, users) => {
    setDetailType(type)
    setDetailUsers(users)
    setShowDetailModal(true)
  }

  // Get title for detail modal
  const getDetailTitle = () => {
    if (statsType === 'attendance') {
      switch (detailType) {
        case 'absent': return 'รายชื่อพนักงานที่ขาดงาน'
        case 'leave': return 'รายชื่อพนักงานที่ลางาน'
        case 'late': return 'รายชื่อพนักงานที่มาสาย'
        default: return 'รายละเอียด'
      }
    } else {
      switch (detailType) {
        case 'notParticipated': return 'รายชื่อผู้ที่ยังไม่เข้าร่วมกิจกรรม'
        case 'leave': return 'รายชื่อผู้ที่ลางานกิจกรรม'
        case 'late': return 'รายชื่อผู้ที่มาสายกิจกรรม'
        default: return 'รายละเอียด'
      }
    }
  }
  
  // Combine locations from both Mapping and Events
  const mappingLocations = locations.map((loc, index) => ({
    ...loc,
    type: 'mapping',
    team: loc.team || ['ทีมพัฒนา', 'ทีมการตลาด', 'ทีมปฏิบัติการ'][index % 3],
    time: loc.time || ['09:15 น.', '09:32 น.', '08:45 น.'][index % 3],
    checkInStatus: 'พื้นที่อนุญาต',
    statusColor: 'text-green-600'
  }))

  const eventLocations = events.map((evt) => ({
    id: `event-${evt.id}`,
    name: evt.locationName,
    description: `งาน: ${evt.name}`,
    latitude: evt.latitude,
    longitude: evt.longitude,
    radius: evt.radius,
    status: evt.status,
    type: 'event',
    team: evt.teams ? evt.teams.join(', ') : 'ไม่ระบุ',
    time: evt.startTime || 'ไม่ระบุ',
    checkInStatus: 'พื้นที่กิจกรรม',
    statusColor: 'text-orange-600'
  }))

  // Combine all locations
  const locationsWithStatus = [...mappingLocations, ...eventLocations]
  
  // Filter locations based on search query and filter type
  const filteredLocations = locationsWithStatus.filter(location => {
    // Filter by type
    if (filterType === 'location' && location.type === 'event') return false
    if (filterType === 'event' && location.type !== 'event') return false
    
    // Filter by search query
    return location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           location.description?.toLowerCase().includes(searchQuery.toLowerCase())
  })
  
  // Get tile layer URL based on map type
  const getTileLayerUrl = () => {
    if (mapType === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  }

  const getTileLayerAttribution = () => {
    if (mapType === 'satellite') {
      return '&copy; <a href="https://www.esri.com/">Esri</a>'
    }
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
  
  // Custom marker icons
  const locationIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjMjJjNTVlIiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
    iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjMjJjNTVlIiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })

  const eventIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjZjk3MzE2IiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
    iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjZjk3MzE2IiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })

  // Toggle location details
  const toggleLocationDetails = (locationId) => {
    const wasExpanded = expandedLocationIds.includes(locationId)
    const element = locationRefs.current[locationId]
    
    if (!element) return
    
    const scrollContainer = element.closest('.overflow-y-auto')
    if (!scrollContainer) return

    if (wasExpanded) {
      // ปิดรายละเอียด - กลับไปตำแหน่งเดิม
      setExpandedLocationIds(prev => prev.filter(id => id !== locationId))
      
      // เลื่อนกลับตำแหน่งเดิม
      setTimeout(() => {
        const savedPosition = scrollPositions.current[locationId]
        if (savedPosition !== undefined) {
          scrollContainer.scrollTo({
            top: savedPosition,
            behavior: 'smooth'
          })
          // ลบตำแหน่งที่บันทึกไว้
          delete scrollPositions.current[locationId]
        }
      }, 50)
    } else {
      // เปิดรายละเอียด - เก็บตำแหน่งปัจจุบันและเลื่อนไปด้านบน
      // บันทึกตำแหน่ง scroll ปัจจุบัน
      scrollPositions.current[locationId] = scrollContainer.scrollTop
      
      setExpandedLocationIds(prev => [...prev, locationId])
      
      // เลื่อนรายการไปชิดใต้แท็บ (top = 0)
      setTimeout(() => {
        // หา offset ของ element เทียบกับ scrollContainer
        const containerRect = scrollContainer.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop
        
        scrollContainer.scrollTo({
          top: relativeTop - 12, // เพิ่มระยะห่าง 12px จากแท็บ
          behavior: 'smooth'
        })
      }, 50)
    }
  }

  // Handle view details button click - fly to marker on map
  const mapRef = useRef(null)
  
  const handleViewDetails = (locationId) => {
    // Find the location
    const location = filteredLocations.find(loc => loc.id === locationId)
    if (!location || !mapRef.current) return

    const map = mapRef.current

    // Fly to the marker position with faster animation
    map.flyTo([location.latitude, location.longitude], 17, {
      duration: 0.5, // Faster animation (reduced from 1.5)
      easeLinearity: 0.5 // Smoother ease
    })

    // Open the popup after flying
    setTimeout(() => {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const latLng = layer.getLatLng()
          if (Math.abs(latLng.lat - location.latitude) < 0.00001 && 
              Math.abs(latLng.lng - location.longitude) < 0.00001) {
            layer.openPopup()
          }
        }
      })
    }, 500) // Faster popup open (reduced from 1500ms)
  }

  // Handle marker click - scroll to list item
  const handleViewDetailsFromMarker = (locationId) => {
    // Scroll to the location card in the list
    const element = locationRefs.current[locationId]
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })

      // Add highlight effect
      element.classList.add('ring-4', 'ring-orange-400')
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-orange-400')
      }, 2000)
    }
  }

  const defaultCenter = [13.7606, 100.5034]

  return (
    <div className="min-h-screen bg-brand-accent">
      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-sm max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">{getDetailTitle()}</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {detailUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-lg font-medium">ไม่มีข้อมูล</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detailUsers.map((user, index) => (
                    <div key={user.id} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-100 hover:border-brand-primary transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 text-lg">{user.name}</h3>
                          <p className="text-sm text-gray-600">{user.department} - {user.position}</p>
                          {user.email && <p className="text-xs text-gray-500 mt-1">{user.email}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ภาพรวมการปฏิบัติงานทั้งหมด</h1>
            <p className="text-sm text-gray-600 mt-1">ข้อมูลเรียลไทม์ของระบบตรวจสอบการเข้างาน การลางาน และพื้นที่อนุญาต</p>
          </div>
          
          {/* 🆕 Branch Filter (SuperAdmin only) */}
          {user?.role === 'superadmin' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">สาขา:</label>
              <div className="relative">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="appearance-none px-4 py-2.5 pr-10 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:border-brand-primary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all outline-none cursor-pointer bg-white min-w-[200px]"
                  style={{ backgroundImage: 'none' }}
                >
                  {branchOptions.map(branch => (
                    <option key={branch.code} value={branch.code}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 py-8 max-w-8xl mx-auto">
        {/* Section 1: Stats with Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {statsType === 'attendance' ? 'สถิติการเข้างาน' : 'สถิติการเข้าร่วมกิจกรรม'}
            </h2>
            <div className="flex gap-2 bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setStatsType('attendance')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${statsType === 'attendance'
                    ? 'bg-white text-brand-primary shadow-sm transform scale-105'
                    : 'text-gray-600 hover:bg-gray-300'
                  }`}
              >
                การเข้างาน
              </button>
              <button
                onClick={() => setStatsType('event')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${statsType === 'event'
                    ? 'bg-white text-brand-primary shadow-sm transform scale-105'
                    : 'text-gray-600 hover:bg-gray-300'
                  }`}
              >
                กิจกรรม
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statsType === 'attendance' ? (
              <>
                {/* Absent - แสดงจำนวนคนที่ขาด */}
                <button
                  onClick={() => handleDetailClick('absent', attendanceStats.absentUsers)}
                  className="bg-red-500 rounded-2xl shadow-sm p-6 text-white hover:bg-red-600 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960" width="60px" fill="white">
                        <path d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/90 text-2xl font-semibold mb-1">ขาดงาน</h3>
                      <p className="text-base text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-7xl font-bold">{attendanceStats.absentCount}</p>
                  </div>
                </button>

                {/* Leave - แสดงจำนวนคนที่ลา (เปลี่ยนเป็นสีฟ้า) */}
                <button
                  onClick={() => handleDetailClick('leave', attendanceStats.leaveUsers)}
                  className="bg-blue-500 rounded-2xl shadow-sm p-6 text-white hover:bg-blue-600 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960" width="60px" fill="white">
                        <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/90 text-2xl font-semibold mb-1">ลางาน</h3>
                      <p className="text-base text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-7xl font-bold">{attendanceStats.leaveCount}</p>
                  </div>
                </button>

                {/* Late - แสดงจำนวนคนที่มาสาย */}
                <button
                  onClick={() => handleDetailClick('late', attendanceStats.lateUsers)}
                  className="bg-orange-500 rounded-2xl shadow-sm p-6 text-white hover:bg-orange-600 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960" width="60px" fill="white">
                        <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/90 text-2xl font-semibold mb-1">มาสาย</h3>
                      <p className="text-base text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-7xl font-bold">{attendanceStats.lateCount}</p>
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Not Participated - ยังไม่เข้าร่วม */}
                <button
                  onClick={() => handleDetailClick('notParticipated', eventStats.notParticipatedUsers)}
                  className="bg-red-500 rounded-2xl shadow-sm p-6 text-white hover:bg-red-600 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960" width="60px" fill="white">
                        <path d="m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/90 text-2xl font-semibold mb-1">ยังไม่เข้าร่วม</h3>
                      <p className="text-base text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-7xl font-bold">{eventStats.notParticipatedCount}</p>
                  </div>
                </button>

                {/* Leave Event - ลางานกิจกรรม (เปลี่ยนเป็นสีฟ้า) */}
                <button
                  onClick={() => handleDetailClick('leave', eventStats.leaveEventUsers)}
                  className="bg-blue-500 rounded-2xl shadow-sm p-6 text-white hover:bg-blue-600 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960" width="60px" fill="white">
                        <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/90 text-2xl font-semibold mb-1">ลางาน</h3>
                      <p className="text-base text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-7xl font-bold">{eventStats.leaveEventCount}</p>
                  </div>
                </button>

                {/* Late Event - มาสายกิจกรรม */}
                <button
                  onClick={() => handleDetailClick('late', eventStats.lateEventUsers)}
                  className="bg-orange-500 rounded-2xl shadow-sm p-6 text-white hover:bg-orange-600 transition-all transform hover:scale-105 cursor-pointer"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" height="60px" viewBox="0 -960 960 960" width="60px" fill="white">
                        <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/90 text-2xl font-semibold mb-1">มาสาย</h3>
                      <p className="text-base text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-7xl font-bold">{eventStats.lateEventCount}</p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section 2: Permitted Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">ตั้งค่าพื้นที่และกิจกรรม</h2>
                <p className="text-sm text-gray-600 mt-1">กำหนดพื้นที่ปฏิบัติงานและกิจกรรมต่างๆ ที่พนักงานสามารถเข้าถึงได้</p>
              </div>
              <div className="bg-orange-100 text-brand-primary px-4 py-2 rounded-full text-sm font-medium">
                {locationsWithStatus.length} รายการ
              </div>
            </div>
          </div>

          {/* Main Content - Map and List Side by Side */}
          <div className="p-6">
            <div className="flex gap-6 h-[650px]">
              {/* Left Side - Map (Flex-1) */}
              <div className="flex-1 relative bg-white rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
                
                {/* Map Type Toggle Button - Top Right */}
                <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                  <button
                    onClick={() => setMapType(mapType === 'default' ? 'satellite' : 'default')}
                    className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm font-medium text-sm transition-all flex items-center gap-2 border border-gray-200"
                    title={mapType === 'default' ? 'สลับเป็นมุมมองดาวเทียม' : 'สลับเป็นมุมมองแผนที่'}
                  >
                    {mapType === 'default' ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <span>ดาวเทียม</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
                        </svg>
                        <span>แผนที่</span>
                      </>
                    )}
                  </button>

                  {/* Stats Badge */}
                  <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-200 min-w-[150px]">
                    <div className="text-xs text-gray-500 mb-2 font-medium">หมุดทั้งหมด</div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 bg-green-50 px-2 py-1.5 rounded-md">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0"></span>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium" style={{ color: '#22c55e' }}>พื้นที่</span>
                          <span className="text-lg font-bold text-green-700">{locations.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-orange-50 px-2 py-1.5 rounded-md">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f97316' }}></span>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium" style={{ color: '#f97316' }}>กิจกรรม</span>
                          <span className="text-lg font-bold text-orange-700">{events.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <MapContainer
                    center={defaultCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution={getTileLayerAttribution()}
                      url={getTileLayerUrl()}
                    />

                    {/* Auto-fit bounds to show all markers */}
                    <FitBoundsToMarkers locations={filteredLocations} />
                    
                    {/* Set map reference */}
                    <MapRefSetter mapRef={mapRef} />

                    {filteredLocations.map((location) => (
                      <React.Fragment key={location.id}>
                        <Marker
                          position={[location.latitude, location.longitude]}
                          icon={location.type === 'event' ? eventIcon : locationIcon}
                          eventHandlers={{
                            click: () => handleViewDetailsFromMarker(location.id)
                          }}
                        >
                          <Popup>
                            <div className="p-2 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-3 h-3 rounded-full ${location.type === 'event' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                <h3 className="font-bold text-gray-800">{location.name}</h3>
                              </div>
                              <p className={`text-xs font-medium mb-2 ${location.type === 'event' ? 'text-orange-700' : 'text-green-600'}`}>
                                {location.checkInStatus}
                              </p>
                              <p className="text-xs text-gray-600 mb-2">{location.description}</p>
                              <p className="text-xs text-gray-500">รัศมี: {location.radius} เมตร</p>
                            </div>
                          </Popup>
                        </Marker>
                        <Circle
                          center={[location.latitude, location.longitude]}
                          radius={location.radius}
                          pathOptions={{
                            color: location.type === 'event' ? '#f97316' : '#22c55e',
                            fillColor: location.type === 'event' ? '#f97316' : '#22c55e',
                            fillOpacity: 0.15
                          }}
                        />
                      </React.Fragment>
                    ))}
                  </MapContainer>

                {/* Map legend */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-md z-[1000] border border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">สัญลักษณ์</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs text-gray-600">พื้นที่อนุญาต</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className="text-xs text-gray-600">กิจกรรม</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel - List View */}
              <div className="w-[480px] bg-white rounded-xl shadow-sm flex flex-col overflow-hidden border-2 border-gray-200">
                {/* Header with Search and Tabs */}
                <div className="p-4 border-b border-gray-200 space-y-3">
                  {/* Search Box */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาพื้นที่หรือกิจกรรม..."
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none transition-colors text-sm"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Tab Filters */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-brand-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ทั้งหมด ({locationsWithStatus.length})
                    </button>
                    <button
                      onClick={() => setFilterType('location')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'location'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      พื้นที่ ({locations.length})
                    </button>
                    <button
                      onClick={() => setFilterType('event')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'event'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      กิจกรรม ({events.length})
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {filteredLocations.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-lg font-medium">ไม่พบรายการ</p>
                      <p className="text-sm mt-2">ลองค้นหาด้วยคำอื่น</p>
                    </div>
                  ) : (
                    filteredLocations.map((location) => {
                      const isExpanded = expandedLocationIds.includes(location.id)
                      const isLocation = location.type !== 'event'

                      return (
                        <div
                          key={location.id}
                          ref={(el) => (locationRefs.current[location.id] = el)}
                          data-item-id={location.id}
                          className={`relative rounded-xl p-4 border-2 shadow-sm transition-all duration-200 ${
                            isLocation 
                              ? 'border-green-100 bg-green-50/50' 
                              : 'border-orange-100 bg-orange-50/50'
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0 pr-2">
                              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold mb-2 ${
                                isLocation 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {isLocation ? 'พื้นที่' : 'กิจกรรม'}
                              </div>
                              <h3 className="font-bold text-lg text-gray-800 mb-1">{location.name}</h3>
                              <p className="text-xs text-gray-600 line-clamp-2">{location.description || 'ไม่มีคำอธิบาย'}</p>
                            </div>
                            
                            {/* Status Badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                              isLocation 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                              </svg>
                              ใช้งาน
                            </span>
                          </div>

                          {/* Quick Info */}
                          <div className="flex items-center gap-4 text-xs text-gray-600 mb-3 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">รัศมี:</span>
                              <span>{location.radius}ม.</span>
                            </div>
                            {!isLocation && location.time && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">เวลา:</span>
                                <span>{location.time}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewDetails(location.id)}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                isLocation
                                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                                  : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              ดูบนแผนที่
                            </button>
                            <button
                              onClick={() => toggleLocationDetails(location.id)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                isExpanded
                                  ? 'bg-gray-700 hover:bg-gray-800 text-white'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              {isExpanded ? 'ซ่อน' : 'รายละเอียด'}
                            </button>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t-2 border-gray-200">
                              <div className="space-y-3">
                                <div className="bg-white rounded-lg p-3 shadow-sm">
                                  <h4 className="text-xs font-semibold text-gray-700 mb-2">ข้อมูลทั่วไป</h4>
                                  <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">ประเภท:</span>
                                      <span className="font-medium text-gray-800">{isLocation ? 'พื้นที่อนุญาต' : 'กิจกรรม'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">รัศมี:</span>
                                      <span className="font-medium text-gray-800">{location.radius} เมตร</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">พิกัด:</span>
                                      <span className="font-medium text-gray-800 font-mono text-[10px]">
                                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                      </span>
                                    </div>
                                    {!isLocation && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">สถานะ:</span>
                                          <span className={`font-medium ${location.status === 'ongoing' ? 'text-green-600' : 'text-gray-600'}`}>
                                            {location.status === 'ongoing' ? 'ดำเนินการ' : 'สิ้นสุด'}
                                          </span>
                                        </div>
                                        {location.time && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">เวลา:</span>
                                            <span className="font-medium text-gray-800">{location.time}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                                {location.team && (
                                  <div className="bg-white rounded-lg p-3 shadow-sm">
                                    <h4 className="text-xs font-semibold text-gray-700 mb-2">ทีมที่เกี่ยวข้อง</h4>
                                    <p className="text-xs text-gray-600">{location.team}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard