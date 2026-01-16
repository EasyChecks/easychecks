import React, { createContext, useState, useContext, useEffect } from 'react'

// Create Context
const EventContext = createContext()

// Initial default events - ร้านชานม Tea Time
const defaultEvents = [
  // ========== กรุงเทพ สาขา 1 (BKK - Branch 101) ==========
  {
    id: 1,
    name: 'เปิดตัวเมนูชานมใหม่ ฤดูหนาว',
    date: '15/11/2025',
    startDate: '15/11/2025',
    endDate: '15/11/2025',
    description: 'เปิดตัวเมนูชานมรสชาติใหม่พิเศษสำหรับฤดูหนาว พร้อมสาธิตการชงและชิมฟรี',
    locationName: 'Tea Time สาขาสยาม',
    latitude: 13.7245,
    longitude: 100.5316,
    radius: 100,
    status: 'ongoing',
    startTime: '10:00',
    endTime: '16:00',
    teams: ['บาริสต้า', 'การตลาด'],
    assignedUsers: [],
    assignedDepartments: ['Sales', 'Marketing'],
    assignedPositions: [],
    createdBy: {
      userId: 1,
      username: 'BKK1010001',
      branch: '101'
    }
  },
  {
    id: 2,
    name: 'อบรมบาริสต้ารุ่นใหม่',
    date: '18/11/2025',
    startDate: '18/11/2025',
    endDate: '18/11/2025',
    description: 'ฝึกอบรมทักษะการชงชา การบริการลูกค้า และมาตรฐานคุณภาพสำหรับบาริสต้าใหม่',
    locationName: 'ห้องฝึกอบรม Tea Time Academy',
    latitude: 13.7250,
    longitude: 100.5320,
    radius: 120,
    status: 'ongoing',
    startTime: '13:00',
    endTime: '17:00',
    teams: ['บาริสต้า', 'HR'],
    assignedUsers: [],
    assignedDepartments: ['Operations', 'HR'],
    assignedPositions: ['Barista'],
    createdBy: {
      userId: 1,
      username: 'BKK1010001',
      branch: '101'
    }
  },
  {
    id: 3,
    name: 'ตรวจสอบคลังวัตถุดิบประจำเดือน',
    date: '20/11/2025',
    startDate: '20/11/2025',
    endDate: '20/11/2025',
    description: 'ตรวจนับสต็อกใบชา ไข่มุก วัตถุดิบ และเครื่องดื่มทุกประเภท พร้อมวางแผนสั่งซื้อเดือนหน้า',
    locationName: 'คลังกลาง บางนา',
    latitude: 13.6709,
    longitude: 100.6311,
    radius: 200,
    status: 'ongoing',
    startTime: '08:30',
    endTime: '16:30',
    teams: ['คลังสินค้า', 'จัดซื้อ'],
    assignedUsers: [],
    assignedDepartments: ['Warehouse', 'Purchasing'],
    assignedPositions: [],
    createdBy: {
      userId: 1,
      username: 'BKK1010001',
      branch: '101'
    }
  },

  // ========== เชียงใหม่ (CNX - Branch 201) ==========
  {
    id: 4,
    name: 'เปิดสาขาใหม่ ห้างเซ็นทรัลเฟสติวัล',
    date: '17/11/2025',
    startDate: '17/11/2025',
    endDate: '17/11/2025',
    description: 'พิธีเปิดสาขาใหม่พร้อมแจกเครื่องดื่มฟรีและส่วนลด 50% ตลอดวัน',
    locationName: 'Tea Time สาขาเซ็นทรัล เชียงใหม่',
    latitude: 18.7883,
    longitude: 98.9853,
    radius: 180,
    status: 'ongoing',
    startTime: '09:00',
    endTime: '21:00',
    teams: ['ทีมเปิดสาขา', 'การตลาด', 'พนักงานทุกคน'],
    assignedUsers: [],
    assignedDepartments: ['Sales', 'Marketing', 'Operations'],
    assignedPositions: [],
    createdBy: {
      userId: 2,
      username: 'CNX2010001',
      branch: '201'
    }
  },
  {
    id: 7,
    name: 'ประชุมผู้จัดการสาขาภาคเหนือ',
    date: '21/11/2025',
    startDate: '21/11/2025',
    endDate: '21/11/2025',
    description: 'ประชุมรายงานยอดขาย แลกเปลี่ยนประสบการณ์ และวางแผนกลยุทธ์การขาย Q4',
    locationName: 'ห้องประชุม Tea Time Office เชียงใหม่',
    latitude: 18.7960,
    longitude: 98.9800,
    radius: 100,
    status: 'ongoing',
    startTime: '13:00',
    endTime: '17:00',
    teams: ['ผู้จัดการสาขา'],
    assignedUsers: [],
    assignedDepartments: ['Management'],
    assignedPositions: ['Branch Manager', 'Area Manager'],
    createdBy: {
      userId: 2,
      username: 'CNX2010001',
      branch: '201'
    }
  },
  {
    id: 8,
    name: 'จัดหาผู้จำหน่ายใบชาท้องถิ่น',
    date: '25/11/2025',
    startDate: '25/11/2025',
    endDate: '25/11/2025',
    description: 'พบปะผู้จำหน่ายใบชาคุณภาพจากเชียงใหม่ เพื่อหาแหล่งวัตถุดิบคุณภาพดี',
    locationName: 'ศูนย์ใบชา ดอยสะเก็ด',
    latitude: 18.8950,
    longitude: 99.1350,
    radius: 200,
    status: 'ongoing',
    startTime: '10:00',
    endTime: '15:00',
    teams: ['จัดซื้อ', 'ควบคุมคุณภาพ'],
    assignedUsers: [],
    assignedDepartments: ['Purchasing', 'QC'],
    assignedPositions: [],
    createdBy: {
      userId: 2,
      username: 'CNX2010001',
      branch: '201'
    }
  },

  // ========== ภูเก็ต (PKT - Branch 301) ==========
  {
    id: 5,
    name: 'ชิมชาเมนูพิเศษชายหาด',
    date: '22/11/2025',
    startDate: '22/11/2025',
    endDate: '22/11/2025',
    description: 'เปิดตัวเมนูชาเย็นพิเศษสำหรับนักท่องเที่ยวชายหาด พร้อมบูธชิมฟรี',
    locationName: 'Tea Time สาขาป่าตอง',
    latitude: 7.8950,
    longitude: 98.2980,
    radius: 150,
    status: 'ongoing',
    startTime: '14:00',
    endTime: '20:00',
    teams: ['บาริสต้า', 'พนักงานขาย'],
    assignedUsers: [],
    assignedDepartments: ['Sales', 'Operations'],
    assignedPositions: ['Barista', 'Sales Staff'],
    createdBy: {
      userId: 5,
      username: 'PKT3010001',
      branch: '301'
    }
  },
  {
    id: 6,
    name: 'ตรวจสอบมาตรฐานความสะอาด',
    date: '26/11/2025',
    startDate: '26/11/2025',
    endDate: '26/11/2025',
    description: 'ตรวจสอบมาตรฐานความสะอาดร้าน อุปกรณ์ชง และพื้นที่เตรียมเครื่องดื่มทุกสาขา',
    locationName: 'Tea Time ทุกสาขาในภูเก็ต',
    latitude: 7.8804,
    longitude: 98.3923,
    radius: 200,
    status: 'ongoing',
    startTime: '09:00',
    endTime: '17:00',
    teams: ['ควบคุมคุณภาพ', 'ผู้จัดการสาขา'],
    assignedUsers: [],
    assignedDepartments: ['QC', 'Management'],
    assignedPositions: ['Branch Manager', 'QC Officer'],
    createdBy: {
      userId: 5,
      username: 'PKT3010001',
      branch: '301'
    }
  }
]

// Provider Component
export function EventProvider({ children }) {
  // Load events from localStorage or use default
  const [events, setEvents] = useState(() => {
    try {
      const savedEvents = localStorage.getItem('easycheck_events')
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents)
        // ลบข้อมูลที่ซ้ำกัน (ตาม id และ name)
        const uniqueEvents = []
        const seenIds = new Set()
        const seenNames = new Set()
        
        for (const evt of parsed) {
          const normalizedName = evt.name.toLowerCase().trim()
          if (!seenIds.has(evt.id) && !seenNames.has(normalizedName)) {
            seenIds.add(evt.id)
            seenNames.add(normalizedName)
            uniqueEvents.push(evt)
          }
        }
        
        return uniqueEvents
      }
      return defaultEvents
    } catch (error) {
      console.error('Error loading events from localStorage:', error)
      return defaultEvents
    }
  })

  // Save to localStorage whenever events change
  useEffect(() => {
    try {
      localStorage.setItem('easycheck_events', JSON.stringify(events))
    } catch (error) {
      console.error('Error saving events to localStorage:', error)
    }
  }, [events])

  // Listen for localStorage changes (for cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'easycheck_events' && e.newValue !== e.oldValue) {
        try {
          const newEvents = JSON.parse(e.newValue || '[]')
          setEvents(newEvents)
        } catch (error) {
          console.error('Error parsing events from localStorage:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Add new event
  const addEvent = (event) => {
    setEvents(prev => {
      try {
        const base = Array.isArray(prev) ? prev : []
        const newEvents = [...base, event]
        return newEvents
      } catch (e) {
        console.error('[EventContext] addEvent error:', e)
        return prev
      }
    })
  }

  // Update event
  const updateEvent = (id, updatedEvent) => {
    setEvents(prev => {
      const newEvents = prev.map(evt => evt.id === id ? { ...evt, ...updatedEvent } : evt)
      return newEvents
    })
  }

  // Delete event
  const deleteEvent = (id) => {
    setEvents(prev => {
      const newEvents = prev.filter(evt => evt.id !== id)
      return newEvents
    })
  }

  // Get event by id
  const getEvent = (id) => {
    return events.find(evt => evt.id === id)
  }

  // Filter events by user's department/team/assignment + provinceCode
  const getEventsForUser = (userId, userRole, userDepartment, userPosition, userProvinceCode) => {
    return events.filter(event => {
      // 🔒 NEW REQUIREMENT: ต้องมีการ assign เท่านั้น (ไม่แสดงถ้าไม่มี assignment)
      const hasAssignment = 
        (event.assignedUsers && event.assignedUsers.length > 0) ||
        (event.assignedDepartments && event.assignedDepartments.length > 0) ||
        (event.assignedPositions && event.assignedPositions.length > 0) ||
        (event.teams && event.teams.length > 0)
      
      if (!hasAssignment) {
        return false // ไม่แสดงกิจกรรมที่ไม่มี assignment
      }

      // 🌍 NEW REQUIREMENT: กรองตามจังหวัด
      if (event.createdBy?.provinceCode && userProvinceCode) {
        // ถ้า event มี provinceCode แล้วต้องตรงกับ user เท่านั้น
        if (event.createdBy.provinceCode !== userProvinceCode) {
          return false // จังหวัดไม่ตรงกัน -> ไม่แสดง
        }
      }

      // 1. Check if user is directly assigned (by ID or name)
      if (event.assignedUsers && event.assignedUsers.length > 0) {
        const isAssigned = event.assignedUsers.some(assigned => {
          // Check if it's a user ID (number)
          if (typeof assigned === 'number' && assigned === userId) {
            return true
          }
          // Check if it's a user object with id
          if (typeof assigned === 'object' && assigned.id === userId) {
            return true
          }
          // Check if it's a name string (normalize comparison)
          if (typeof assigned === 'string') {
            return assigned.toLowerCase().includes(String(userId).toLowerCase())
          }
          return false
        })
        if (isAssigned) return true
      }

      // 2. Check if user's department is assigned
      if (event.assignedDepartments && event.assignedDepartments.length > 0) {
        if (event.assignedDepartments.some(dept => 
          dept.toLowerCase() === userDepartment?.toLowerCase() ||
          dept.toLowerCase().includes(userDepartment?.toLowerCase()) ||
          userDepartment?.toLowerCase().includes(dept.toLowerCase())
        )) {
          return true
        }
      }

      // 3. Check if user's position is assigned
      if (event.assignedPositions && event.assignedPositions.length > 0) {
        if (event.assignedPositions.some(pos => 
          pos.toLowerCase() === userPosition?.toLowerCase() ||
          pos.toLowerCase().includes(userPosition?.toLowerCase()) ||
          userPosition?.toLowerCase().includes(pos.toLowerCase())
        )) {
          return true
        }
      }

      // 4. Fallback to old teams logic for backward compatibility
      if (event.teams && event.teams.length > 0) {
        const userTeams = [userDepartment, userPosition].filter(Boolean).map(t => t.toLowerCase().trim())
        
        return event.teams.some(eventTeam => {
          const normalizedEventTeam = eventTeam.toLowerCase().trim()
          
          return userTeams.some(userTeam => {
            return (
              normalizedEventTeam === userTeam ||
              normalizedEventTeam.includes(userTeam) || 
              userTeam.includes(normalizedEventTeam)
            )
          })
        })
      }

      // If no assignment criteria matched, don't show the event
      return false
    })
  }

  // Check if user can join event (within 30 minutes after start time)
  const canJoinEvent = (event) => {
    if (!event.startTime || !event.date) {
      return true // If no time specified, allow joining
    }

    try {
      // Parse date (format: DD/MM/YYYY)
      const [day, month, year] = event.date.split('/')
      // Parse time (format: HH:MM)
      const [hours, minutes] = event.startTime.split(':')
      
      // Create event start time
      const eventStartTime = new Date(year, month - 1, day, hours, minutes)
      
      // Add 30 minutes grace period
      const joinDeadline = new Date(eventStartTime.getTime() + 30 * 60 * 1000)
      
      // Get current time
      const now = new Date()
      
      // Can join if current time is before deadline
      return now <= joinDeadline
    } catch (error) {
      console.error('Error parsing event date/time:', error)
      return true // In case of error, allow joining
    }
  }

  // Get time remaining to join event (returns object with hours and minutes)
  const getTimeRemainingToJoin = (event) => {
    if (!event.startTime || !event.date) {
      return null
    }

    try {
      const [day, month, year] = event.date.split('/')
      const [hours, minutes] = event.startTime.split(':')
      
      const eventStartTime = new Date(year, month - 1, day, hours, minutes)
      const joinDeadline = new Date(eventStartTime.getTime() + 30 * 60 * 1000)
      const now = new Date()
      
      const diff = joinDeadline - now
      const totalMinutes = Math.floor(diff / (1000 * 60))
      
      if (totalMinutes <= 0) {
        return { hours: 0, minutes: 0, total: 0 }
      }
      
      const hoursRemaining = Math.floor(totalMinutes / 60)
      const minutesRemaining = totalMinutes % 60
      
      return {
        hours: hoursRemaining,
        minutes: minutesRemaining,
        total: totalMinutes,
        formatted: `${hoursRemaining}:${minutesRemaining.toString().padStart(2, '0')}`
      }
    } catch (error) {
      console.error('Error calculating time remaining:', error)
      return null
    }
  }

  // Get all events (unfiltered) - for ID generation
  const getAllEvents = () => {
    return events
  }

  // ✅ Get filtered events based on user role and branch
  const getFilteredEvents = (user) => {
    if (!user) return []
    
    // SuperAdmin เห็นทุกอย่าง
    if (user.role === 'superadmin') {
      return events
    }
    
    // Admin เห็นเฉพาะสาขาของตัวเอง
    if (user.role === 'admin') {
      return events.filter(evt => {
        // ถ้ายังไม่มี branch (event เก่า) ให้แสดงทุกอัน
        if (!evt.createdBy?.branch) return true
        // ถ้ามี branch ให้แสดงเฉพาะที่ตรงกับสาขาของ admin
        return evt.createdBy.branch === user.branchCode
      })
    }
    
    // Manager และ User ใช้ getEventsForUser แทน (เพิ่ม provinceCode)
    return getEventsForUser(user.id, user.role, user.department, user.position, user.provinceCode)
  }

  const value = {
    events,
    setEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    getEvent,
    getAllEvents,
    getEventsForUser,
    getFilteredEvents,
    canJoinEvent,
    getTimeRemainingToJoin
  }

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  )
}

// Custom hook to use EventContext
export function useEvents() {
  const context = useContext(EventContext)
  if (!context) {
    throw new Error('useEvents must be used within an EventProvider')
  }
  return context
}

export default EventContext
