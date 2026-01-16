import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { useLoading } from '../../contexts/useLoading'
import { useLocations } from '../../contexts/LocationContext'
import { validateBuddy, sampleSchedules } from '../../data/usersData'
import { AttendanceStatsRow } from '../../components/common/AttendanceStatsCard'
import { useCamera } from '../../hooks/useCamera'
import { config } from '../../config'
import { getCheckInStatus } from '../../utils/attendanceCalculator'
import { shouldBlockCheckIn } from '../../utils/leaveAttendanceIntegration'

function UserDashboard() {
  const { attendance, user, attendanceRecords } = useAuth()
  const { hideLoading } = useLoading()
  const { locations } = useLocations()
  const navigate = useNavigate()
  
  // Camera hook สำหรับขออนุญาตกล้อง
  const { requestCameraPermission } = useCamera()
  
  const [showBuddyCheckIn, setShowBuddyCheckIn] = useState(false)
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(false)
  const [buddyData, setBuddyData] = useState({
    employeeId: '',
    phone: ''
  })
  const [buddyError, setBuddyError] = useState('')
  const [buddySuccess, setBuddySuccess] = useState(false)
  const [_currentLocation, _setCurrentLocation] = useState(null) // เก็บไว้สำหรับอนาคต
  const [isWithinAllowedArea, setIsWithinAllowedArea] = useState(false)
  const [checkingLocation, setCheckingLocation] = useState(true)
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [popupInfoMessage, setPopupInfoMessage] = useState('');
  const [checkingCamera, setCheckingCamera] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0) // For real-time updates
  const [selectedShift, setSelectedShift] = useState(null) // 🆕 เก็บกะที่เลือก
  const [leaveBlockInfo, setLeaveBlockInfo] = useState(null) // 🔄 STEP 2: เก็บข้อมูลการลา

  // 🔥 Real-time schedule updates (เหมือนการเข้า-ออกงาน)
  useEffect(() => {
    // 1. ฟัง CustomEvent สำหรับ same tab (ทำงานทันที)
    const handleScheduleUpdate = (event) => {
      console.log('📢 [Same Tab User] Schedule updated:', event.detail?.action)
      // Force refresh โดยเปลี่ยน refreshKey
      setRefreshKey(prev => prev + 1)
    }

    // 2. ฟัง storage event สำหรับ cross-tab (รวมถึงตอนลบ)
    const handleStorageChange = (e) => {
      // ฟังทั้ง scheduleUpdateTrigger และ attendanceSchedules
      if (e.key === 'scheduleUpdateTrigger' && e.newValue) {
        try {
          const update = JSON.parse(e.newValue)
          console.log(' [Cross Tab User] Schedule update:', update.action)
          setRefreshKey(prev => prev + 1)
        } catch (error) {
          console.error('Error parsing schedule update:', error)
        }
      } else if (e.key === 'attendanceSchedules') {
        //  ฟังการเปลี่ยนแปลงของ attendanceSchedules โดยตรง (ตอนลบ/แก้ไข)
        // console.log('📢 [Cross Tab User] attendanceSchedules changed')
        setRefreshKey(prev => prev + 1)
      }
    }

    // ฟัง CustomEvent (same tab)
    window.addEventListener('scheduleUpdated', handleScheduleUpdate)
    // ฟัง storage event (cross-tab)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('scheduleUpdated', handleScheduleUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // STEP 2: ตรวจสอบว่าวันนี้มีการลาที่อนุมัติหรือไม่
  useEffect(() => {
    if (user) {
      const today = new Date().toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      
      const blockInfo = shouldBlockCheckIn(user.id, today)
      setLeaveBlockInfo(blockInfo)
      
      // console.log('[UserDashboard] Leave check:', {
      //   userId: user.id,
      //   date: today,
      //   blocked: blockInfo.blocked,
      //   reason: blockInfo.reason,
      //   leaveData: blockInfo.leaveData
      // });
      
      // 🔍 Debug: ตรวจสอบ leaveList
      const leaveList = JSON.parse(localStorage.getItem('leaveList') || '[]');
      const myLeaves = leaveList.filter(l => !l.userId || l.userId === user.id);
      const approvedLeaves = myLeaves.filter(l => l.status === 'อนุมัติ');
      const pendingLeaves = myLeaves.filter(l => l.status === 'รออนุมัติ');
      
      console.log('[UserDashboard] Leave summary:', {
        total: leaveList.length,
        myLeaves: myLeaves.length,
        approved: approvedLeaves.length,
        pending: pendingLeaves.length,
        approvedToday: approvedLeaves.filter(l => 
          l.startDate <= today && l.endDate >= today
        ).length
      });
    }
  }, [user, refreshKey]) // refreshKey เพื่อให้ตรวจสอบใหม่เมื่อมีการอัพเดท
  
  // STEP 2.1: ฟังการเปลี่ยนแปลงของ leaveList (เมื่อ admin อนุมัติ)
  useEffect(() => {
    const handleLeaveUpdate = (e) => {
      if (e.key === 'leaveList') {
        // console.log('📢 leaveList updated, refreshing leave status...');
        setRefreshKey(prev => prev + 1); // Force refresh
      }
    };
    
    // ฟัง storage event (cross-tab)
    window.addEventListener('storage', handleLeaveUpdate);
    
    // ฟัง custom event (same tab)
    const handleLeaveStatusUpdated = (e) => {
      console.log('Leave status updated event:', e.detail);
      setRefreshKey(prev => prev + 1); // Force refresh
    };
    window.addEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
    
    return () => {
      window.removeEventListener('storage', handleLeaveUpdate);
      window.removeEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
    };
  }, []);

  // โหลดตารางงานทั้งหมดจาก localStorage
  const allSchedules = useMemo(() => {
    const savedSchedules = localStorage.getItem('attendanceSchedules')
    
    // ถ้าไม่มีใน localStorage ให้บันทึก sampleSchedules ลงไปก่อน
    if (!savedSchedules) {
      localStorage.setItem('attendanceSchedules', JSON.stringify(sampleSchedules))
    }
    
    const schedules = savedSchedules ? JSON.parse(savedSchedules) : sampleSchedules
    
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0) // ตั้งเวลาเป็นเที่ยงคืนเพื่อเปรียบเทียบวันที่
      
      // User เห็นตารางที่มีชื่อตัวเอง หรือถ้าเป็น Admin ของสาขานั้น
      const userVisibleSchedules = schedules.filter(schedule => {
        // ถ้าตารางมีรายชื่อสมาชิก ให้เช็คว่า user อยู่ในรายชื่อหรือไม่
        if (schedule.members && schedule.members.trim()) {
          const memberNames = schedule.members.split(',').map(name => name.trim().toLowerCase())
          const isInMemberList = memberNames.includes(user?.name?.toLowerCase())
          
          if (isInMemberList) {
            return true // ถ้าชื่ออยู่ในรายการ ให้แสดง
          }
        }
        
        // ถ้าไม่มีชื่อในรายการสมาชิก แต่เป็น Admin ของสาขานั้น ให้แสดง
        if (user?.role === 'admin') {
          const userBranch = user.branch || user.provinceCode || user.employeeId?.substring(0, 3)
          const scheduleBranch = schedule.branch
          
          // ถ้าตารางไม่มี branch (ตารางเก่า) ให้แสดง
          if (!scheduleBranch) {
            return schedule.createdBy === 'admin' || !schedule.createdBy
          }
          
          // แสดงตารางของสาขาเดียวกัน
          return scheduleBranch === userBranch
        }
        
        return false
      })
      
      // กรองตารางตาม teams (แผนก/ตำแหน่ง) และวันที่
      const userSchedules = userVisibleSchedules.filter(schedule => {
        // ตรวจสอบว่า user อยู่ในรายชื่อสมาชิกหรือไม่
        // ยกเว้นตารางเก่าที่ไม่มี createdBy (ตารางตัวอย่าง)
        if (schedule.createdBy && schedule.members && schedule.members.trim()) {
          const memberNames = schedule.members.split(',').map(name => name.trim().toLowerCase())
          const isInMemberList = memberNames.includes(user?.name?.toLowerCase())
          
          if (!isInMemberList) {
            return false // ถ้าไม่ได้อยู่ในรายชื่อสมาชิก ไม่แสดง
          }
        }
        
        // 1. ตรวจสอบ teams/departments (ถ้ามีการตั้งค่า)
        if (schedule.teams && schedule.teams.length > 0) {
          const hasTeamAccess = schedule.teams.some(team => 
            team === user?.department || team === user?.position || team === user?.role
          )
          
          if (!hasTeamAccess) {
            return false // ถ้าไม่มีสิทธิ์ตาม role ให้ตัดทิ้งเลย
          }
        }
        
        // 2. ตรวจสอบวันที่
        // ถ้าไม่มี date (หรือ isPermanent = true) = แสดงตลอด
        if (!schedule.date || schedule.isPermanent === true) {
          return true
        }
        
        // ถ้ามี dateEnd = ตารางรายสัปดาห์/ช่วงเวลา
        if (schedule.dateEnd) {
          const startDate = new Date(schedule.date)
          const endDate = new Date(schedule.dateEnd)
          startDate.setHours(0, 0, 0, 0)
          endDate.setHours(23, 59, 59, 999)
          
          // แสดงถ้าวันนี้อยู่ในช่วง startDate ถึง endDate
          return today >= startDate && today <= endDate
        }
        
        // ถ้ามีแค่ date เดียว = ตารางวันเดียว
        const scheduleDate = new Date(schedule.date)
        scheduleDate.setHours(0, 0, 0, 0)
        
        // แสดงเฉพาะวันที่ตรงกับวันที่กำหนด
        return today.getTime() === scheduleDate.getTime()
      })
      
      // เพิ่ม time field ถ้าไม่มี
      return userSchedules.map(schedule => ({
        ...schedule,
        time: schedule.time || `${schedule.startTime} - ${schedule.endTime}`
      }))
    } catch (error) {
      console.error('Error loading schedules:', error)
      return []
    }
  }, [user, refreshKey])

  // หากะที่ check-in แล้ว (สำหรับแสดงสถานะ)
  const shiftsCheckedIn = useMemo(() => {
    const today = new Date().toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    const todayRecord = attendanceRecords.find(r => r.date === today)
    
    if (!todayRecord || !todayRecord.shifts) return []
    
    // ดึง shiftId ที่มีการ check-in แล้ว
    return todayRecord.shifts
      .filter(shift => shift.checkIn || shift.checkInTime)
      .map(shift => shift.shiftId)
      .filter(id => id !== null && id !== undefined)
  }, [attendanceRecords])

  // ฟังก์ชันคำนวณระยะทาง (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3 // รัศมีโลกเป็นเมตร
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // ระยะทางเป็นเมตร
  }

  // แก้ไขความช้า: ตรวจสอบตำแหน่งปัจจุบันแบบ optimized
  useEffect(() => {
    let watchId = null
    
    if (navigator.geolocation) {
      // ใช้ getCurrentPosition ครั้งแรกเพื่อความเร็ว
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude
          const userLon = position.coords.longitude
          
          _setCurrentLocation({ lat: userLat, lon: userLon })

          // ตรวจสอบว่าอยู่ในพื้นที่อนุญาตหรือไม่
          const isInside = locations.some(location => {
            if (location.status !== 'active') return false
            
            const distance = calculateDistance(
              userLat,
              userLon,
              location.latitude,
              location.longitude
            )
            
            return distance <= location.radius
          })
          
          setIsWithinAllowedArea(isInside)
          setCheckingLocation(false)
        },
        (error) => {
          console.warn('Location error:', error.message)
          setCheckingLocation(false)
          // ไม่แสดง error ให้ user เห็น แต่อนุญาตใช้งานได้
          setIsWithinAllowedArea(true)
        },
        {
          enableHighAccuracy: false, // ใช้ความแม่นยำต่ำเพื่อความเร็ว
          timeout: 5000, // ลดเวลา timeout
          maximumAge: 30000 // ยอมรับตำแหน่งเก่าได้ถึง 30 วินาที
        }
      )
      
      // จากนั้นใช้ watchPosition สำหรับอัปเดตต่อเนื่อง (ไม่บังคับ)
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const userLat = position.coords.latitude
          const userLon = position.coords.longitude
          
          _setCurrentLocation({ lat: userLat, lon: userLon })

          const isInside = locations.some(location => {
            if (location.status !== 'active') return false
            
            const distance = calculateDistance(
              userLat,
              userLon,
              location.latitude,
              location.longitude
            )
            
            return distance <= location.radius
          })
          
          setIsWithinAllowedArea(isInside)
        },
        (error) => {
          // Silent - ไม่แสดง error
          console.warn('Location watch error:', error.message)
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 30000
        }
      )

      return () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
        }
      }
    } else {
      setCheckingLocation(false)
      setIsWithinAllowedArea(true)
    }
  }, [locations])

  // Hide loading เมื่อ component พร้อม render
  useEffect(() => {
    hideLoading()
  }, [hideLoading])

  // บังคับให้โหลดข้อมูล attendance ใหม่เมื่อ component mount หรือ user เปลี่ยน
  useEffect(() => {
    if (user) {
      // Trigger storage event เพื่อให้ AuthProvider โหลดข้อมูลใหม่
      const userAttendanceKey = `attendanceRecords_user_${user.id}_${user.name}`
      const savedRecords = localStorage.getItem(userAttendanceKey)
      
      if (savedRecords) {
        // Dispatch storage event เพื่อให้ context อัพเดต
        window.dispatchEvent(new StorageEvent('storage', {
          key: userAttendanceKey,
          newValue: savedRecords,
          url: window.location.href
        }))
      }
    }
  }, [user])

  // ฟังการเปลี่ยนแปลงของ attendance แบบ real-time
  useEffect(() => {
    const handleAttendanceUpdate = (event) => {
      // อัพเดต UI ทันทีเมื่อมีการเช็คชื่อสำเร็จ
      if (event.detail && event.detail.userId === user?.id) {
        // Force re-render โดยไม่ต้องรีเฟรชหน้า
        window.dispatchEvent(new Event('storage'))
      }
    }

    window.addEventListener('attendanceUpdated', handleAttendanceUpdate)
    return () => window.removeEventListener('attendanceUpdated', handleAttendanceUpdate)
  }, [user])

  // ฟังการอัปเดต timeSummary real-time (สำหรับ AttendanceStatsRow)
  useEffect(() => {
    const handleTimeSummaryUpdate = (e) => {
      if (e.detail.userId === user?.id) {
        // Force re-render โดยการอัปเดต state (ถ้ามี)
        // AttendanceStatsRow จะดึงข้อมูลใหม่จาก useAuth() อัตโนมัติ
        window.dispatchEvent(new Event('storage')); // trigger storage event
      }
    };

    window.addEventListener('timeSummaryUpdated', handleTimeSummaryUpdate);
    return () => {
      window.removeEventListener('timeSummaryUpdated', handleTimeSummaryUpdate);
    };
  }, [user]);

  // ล็อกการเลื่อนเมื่อ Modal เปิด
  useEffect(() => {
    if (showBuddyCheckIn || showAttendanceHistory) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showBuddyCheckIn, showAttendanceHistory])

  // ตรวจสอบว่ามีกะที่ check-in แล้วแต่ยังไม่ checkout หรือไม่
  const hasUncheckedOutShift = useMemo(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) return false
    
    const today = new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const todayRecord = attendanceRecords.find(record => record.date === today)
    if (!todayRecord || !todayRecord.shifts) return false
    
    // เช็คว่ามีกะไหนที่ check-in แล้วแต่ยังไม่ checkout
    return todayRecord.shifts.some(shift => 
      (shift.checkIn || shift.checkInTime) && !(shift.checkOut || shift.checkOutTime)
    )
  }, [attendanceRecords])

  // ใช้ attendance จาก context แทน mock data
  const isCheckedIn = attendance.status === 'checked_in' || hasUncheckedOutShift
  const buttonColor = isCheckedIn 
    ? 'bg-destructive hover:bg-destructive/90 shadow-lg' 
    : 'bg-white hover:shadow-xl hover:bg-brand-accent-soft border-2 border-brand-primary'
  const buttonTextColor = isCheckedIn ? 'text-white' : 'text-brand-primary'
  const buttonText = isCheckedIn ? 'ออกงาน' : 'เข้างาน'
  
  // ปิดการใช้งานปุ่มถ้าไม่ได้อยู่ในพื้นที่อนุญาต
  const isButtonDisabled = !isWithinAllowedArea && !checkingLocation

  const handleBuddyCheckIn = () => {
    // ตรวจสอบข้อมูล
    if (!buddyData.employeeId.trim()) {
      setBuddyError('กรุณากรอกรหัสพนักงาน')
      return
    }
    if (!buddyData.phone.trim()) {
      setBuddyError('กรุณากรอกเบอร์โทรศัพท์')
      return
    }
    if (buddyData.phone.length !== 10 || !/^[0-9]+$/.test(buddyData.phone)) {
      setBuddyError('เบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก)')
      return
    }

    try {
      // ตรวจสอบข้อมูลพนักงานจาก Mock Data
      const validBuddy = validateBuddy(buddyData.employeeId, buddyData.phone)
      
      if (!validBuddy) {
        setBuddyError('ไม่พบข้อมูลพนักงาน หรือรหัสพนักงานกับเบอร์โทรไม่ตรงกัน')
        return
      }

      // ตรวจสอบว่าเพื่อนมีตารางงานวันนี้หรือไม่
      const buddySchedule = allSchedules.find(s => 
        (!s.teams || s.teams.length === 0 || 
         s.teams.some(team => 
           team === validBuddy.department || 
           team === validBuddy.position || 
           team === validBuddy.role
         ))
      )

      if (!buddySchedule) {
        setBuddyError(`${validBuddy.name} ไม่มีตารางงานวันนี้`)
        return
      }

      // ดึงข้อมูล user จาก localStorage
      const storedUsers = localStorage.getItem('usersData')
      if (!storedUsers) {
        setBuddyError('ไม่พบข้อมูลระบบ')
        return
      }

      const users = JSON.parse(storedUsers)
      const buddyIndex = users.findIndex(u => u.id === validBuddy.id)
      
      if (buddyIndex === -1) {
        setBuddyError('ไม่พบข้อมูลพนักงานในระบบ')
        return
      }

      // ตรวจสอบสถานะการเช็คอินของเพื่อน
      const today = new Date()
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear() + 543}`
      
      const buddyAttendance = users[buddyIndex].attendanceRecords?.find(r => r.date === todayStr)
      
      if (buddyAttendance?.checkIn?.time) {
        setBuddyError(`${validBuddy.name} เช็คอินไปแล้วเมื่อ ${buddyAttendance.checkIn.time} น.`)
        return
      }

      // ใช้ percentage-based late detection
      const currentTime = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`
      const [startTimeStr, endTimeStr] = buddySchedule.time.split(' - ')
      const workTimeStart = startTimeStr.replace('.', ':')
      const workTimeEnd = endTimeStr.replace('.', ':')
      
      const statusResult = getCheckInStatus(currentTime, workTimeStart, workTimeEnd)
      const status = statusResult.status

      // บันทึกการเช็คอินแทน
      const checkInData = {
        time: currentTime,
        status: status,
        location: user?.department || 'Unknown',
        photo: null,
        gps: null,
        checkedByBuddy: true,
        buddyName: user?.name || 'Unknown'
      }

      // อัปเดตข้อมูล
      if (!users[buddyIndex].attendanceRecords) {
        users[buddyIndex].attendanceRecords = []
      }

      const existingRecordIndex = users[buddyIndex].attendanceRecords.findIndex(r => r.date === todayStr)
      
      if (existingRecordIndex >= 0) {
        users[buddyIndex].attendanceRecords[existingRecordIndex].checkIn = checkInData
      } else {
        users[buddyIndex].attendanceRecords.push({
          date: todayStr,
          checkIn: checkInData,
          checkOut: null
        })
      }

      // บันทึกลง localStorage
      localStorage.setItem('usersData', JSON.stringify(users))
      
      // Dispatch event เพื่อ sync ข้อมูล
      window.dispatchEvent(new Event('storage'))

      // บันทึกสำเร็จ
      setBuddyError('')
      setBuddySuccess(true)

      // รีเซ็ตและปิด modal หลัง 2 วินาที
      setTimeout(() => {
        setShowBuddyCheckIn(false)
        setBuddySuccess(false)
        setBuddyData({ employeeId: '', phone: '' })
      }, 2000)
    } catch (error) {
      console.error('Buddy check-in error:', error)
      setBuddyError('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง')
    }
  }

  const handleBuddyInputChange = (field, value) => {
    setBuddyData(prev => ({ ...prev, [field]: value }))
    setBuddyError('') // ล้าง error เมื่อพิมพ์
  }

  // ฟังก์ชันสำหรับจัดการคลิกปุ่มเช็คอิน/เช็คเอาท์
  const handleCheckInOutClick = async (e) => {
    // ถ้าไม่อยู่ในพื้นที่อนุญาต
    if (isButtonDisabled) {
      e.preventDefault()
      setPopupInfoMessage('คุณต้องอยู่ในพื้นที่อนุญาตเท่านั้นจึงจะสามารถเช็คอินได้');
      setShowInfoPopup(true);
      return
    }

    // บังคับเลือกกะเมื่อมีหลายกะ
    if (allSchedules.length > 1 && !selectedShift) {
      e.preventDefault()
      setPopupInfoMessage('กรุณาเลือกกะงานก่อนทำรายการ');
      setShowInfoPopup(true);
      return
    }

    // ถ้าปิดการตรวจสอบกล้องใน config ให้ไปหน้าถ่ายรูปเลย
    if (!config.features.enableCameraCheck) {
      return // ปล่อยให้ Link ทำงานตามปกติ
    }

    // ขออนุญาตกล้อง
    e.preventDefault() // หยุด Link ไว้ก่อน
    setCheckingCamera(true)
    
    const result = await requestCameraPermission()
    setCheckingCamera(false)

    if (result.success) {
      // อนุญาตกล้องแล้ว ไปหน้าถ่ายรูป
      navigate('/user/take-photo', { 
        state: { 
          schedule: selectedShift || allSchedules[0],
          shiftId: (selectedShift || allSchedules[0])?.time?.replace(/\./g, ':') // normalize เป็น : format
        } 
      })
    } else {
      // ไม่อนุญาตกล้อง แสดง error
      setPopupInfoMessage(result.error || 'ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้องในการตั้งค่าเบราว์เซอร์')
      setShowInfoPopup(true)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Check In/Out Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6 text-white">
        <h3 className="mb-4 text-xl font-bold text-black">บันทึกเวลา</h3>
        
        {/* Location Status Banner */}
        {checkingLocation ? (
          <div className="flex items-center gap-2 p-3 mb-4 bg-white/20 backdrop-blur-sm rounded-xl">
            <div className="w-5 h-5 border-b-2 border-white rounded-full animate-spin"></div>
            <span className="text-sm text-black">กำลังตรวจสอบตำแหน่งของคุณ...</span>
          </div>
        ) : !isWithinAllowedArea ? (
          <div className="flex items-center gap-2 p-3 mb-4 border bg-red-500/30 backdrop-blur-sm rounded-xl border-red-300/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="black">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-black">คุณอยู่นอกพื้นที่อนุญาต - ไม่สามารถเช็คอินได้</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 mb-4 border bg-green-500/30 backdrop-blur-sm rounded-xl border-green-300/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="black">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-black">คุณอยู่ในพื้นที่อนุญาต - สามารถเช็คอินได้</span>
          </div>
        )}
        
        {/* UI เลือกกะ (แสดงเมื่อมีมากกว่า 1 กะ) */}
        {allSchedules.length > 1 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-800 mb-3">เลือกกะที่ต้องการเข้างาน:</h4>
            <div className="grid grid-cols-2 gap-3">
              {allSchedules.map((schedule, index) => {
                const hasCheckedIn = shiftsCheckedIn.includes(schedule.id)
                const isSelected = selectedShift?.id === schedule.id
                
                return (
                  <button
                    key={schedule.id}
                    onClick={() => !hasCheckedIn && setSelectedShift(schedule)}
                    disabled={hasCheckedIn}
                    className={`p-3 rounded-lg text-left border-2 transition-all ${
                      isSelected 
                        ? 'bg-brand-primary text-white border-brand-primary shadow-md' 
                        : hasCheckedIn
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-800 border-gray-300 hover:border-brand-primary hover:bg-orange-50'
                    }`}
                  >
                    <div className="font-bold text-sm mb-1">กะที่ {index + 1}</div>
                    <div className={`text-xs ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                      {schedule.team}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                      {schedule.time}
                    </div>
                    {hasCheckedIn && (
                      <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        เข้างานแล้ว
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {!selectedShift && (
              <p className="text-xs text-gray-500 mt-2 text-center">กรุณาเลือกกะก่อนเข้างาน</p>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#f26623">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm112 168 56-56-128-128v-184h-80v216l152 152Z"/>
              </svg>
              <span className="text-sm text-black">เข้างาน: {attendance.checkInTime || '-'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#f26623">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm112 168 56-56-128-128v-184h-80v216l152 152Z"/>
              </svg>
              <span className="text-sm text-black">ออกงาน: {attendance.checkOutTime || '-'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {/* STEP 2: แสดงปุ่ม disabled ถ้ามีการลา */}
            {checkingCamera ? (
              <button
                disabled
                className="bg-white/50 text-gray-400 px-8 py-3 rounded-full font-bold shadow-lg inline-block text-center opacity-75 cursor-wait"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-b-transparent rounded-full animate-spin"></div>
                  <span className='text-black'>กำลังตรวจสอบกล้อง...</span>
                </div>
              </button>
            ) : leaveBlockInfo?.blocked ? (
              <button
                disabled
                className="bg-gray-300 text-gray-500 px-8 py-3 rounded-full font-bold shadow-md cursor-not-allowed opacity-60"
                title={leaveBlockInfo.reason}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  ไม่สามารถเข้างานได้
                </div>
              </button>
            ) : (
              <Link 
                to={isButtonDisabled ? "#" : "/user/take-photo"}
                state={{ 
                  schedule: selectedShift || allSchedules[0], // 🆕 ใช้ selectedShift ถ้ามี
                  shiftId: (selectedShift || allSchedules[0])?.id // 🆕 ส่ง shiftId
                }}
                onClick={(e) => {
                  if (isButtonDisabled) {
                    e.preventDefault();
                    setPopupInfoMessage('คุณต้องอยู่ในพื้นที่อนุญาตเท่านั้นจึงจะสามารถเช็คอินได้');
                    setShowInfoPopup(true);
                    return;
                  }
                  // เช็คว่าต้องเลือกกะก่อน (ถ้ามี > 1 กะ)
                  if (allSchedules.length > 1 && !selectedShift) {
                    e.preventDefault();
                    setPopupInfoMessage('กรุณาเลือกกะที่ต้องการเข้างานก่อน');
                    setShowInfoPopup(true);
                    return;
                  }
                  handleCheckInOutClick(e);
                }}
                className={`${buttonColor} ${buttonTextColor} px-8 py-3 rounded-full font-bold shadow-lg transform transition-all inline-block text-center ${
                  isButtonDisabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : 'hover:scale-105'
                }`}
              >
                {buttonText}
              </Link>
            )}
            <button
              onClick={() => {
                if (isButtonDisabled) {
                  setPopupInfoMessage('คุณต้องอยู่ในพื้นที่อนุญาตเท่านั้นจึงจะสามารถเช็คชื่อแทนเพื่อนได้');
                  setShowInfoPopup(true);
                } else {
                  setShowBuddyCheckIn(true)
                }
              }}
              disabled={isButtonDisabled}
              className={`bg-white/20 backdrop-blur-sm text-black px-6 py-2 rounded-full text-sm font-semibold border border-brand-primary/30 transition-all ${
                isButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-accent-soft'
              }`}
            >
              เช็คแทน
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Statistics - แสดงสถิติการลงเวลาจริง */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">สรุปการทำงาน</h3>
          <button
            onClick={() => setShowAttendanceHistory(true)}
            className="px-4 py-2 bg-brand-primary hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ประวัติการลงเวลา
          </button>
        </div>
        <AttendanceStatsRow />
      </div>

      {/* Work Schedule - ตารางงาน */}
      <div className="p-6 bg-white shadow-md rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">ตารางงานของคุณ</h3>
          <span className="text-sm text-gray-500">ทั้งหมด {allSchedules.length} รายการ</span>
        </div>
        
        {/* User's work schedules - แสดงตารางงานทั้งหมดของ user */}
        {allSchedules.length > 0 ? (
          <div className="space-y-3">
            {allSchedules.map((schedule) => (
              <Link key={schedule.id} to={`/user/schedule/${schedule.id}`} className="block">
                <div className="bg-gradient-to-r from-brand-primary to-orange-600 rounded-xl p-4 text-white transform transition-all hover:scale-[1.02] hover:shadow-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold">{schedule.team}</h4>
                      <p className="text-xs text-white/80 mt-1">{schedule.date}</p>
                    </div>
                    <span className="px-3 py-1 text-xs border rounded-full bg-white/20 border-white/30 whitespace-nowrap">
                      {schedule.time || 'ไม่ระบุเวลา'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-white/90">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>สถานที่: {schedule.location}</span>
                    </div>
                    {schedule.type && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>ประเภท: {schedule.type}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-white/90">
                    <span className="text-xs flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>ดูรายละเอียดเพิ่มเติม</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>ไม่มีตารางงาน</p>
          </div>
        )}
      </div>

      {/* Attendance History Modal */}
      {showAttendanceHistory && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAttendanceHistory(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-brand-primary to-orange-600 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">ประวัติการลงเวลา</h2>
                  <p className="text-white/90 text-sm mt-1">รายละเอียดการเข้า-ออกงานของคุณ</p>
                </div>
                <button
                  onClick={() => setShowAttendanceHistory(false)}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-white transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {!attendanceRecords || attendanceRecords.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">ยังไม่มีประวัติการลงเวลา</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attendanceRecords.map((record, index) => {
                    // แปลง Thai date format (DD/MM/YYYY+543) เป็น JS Date
                    let recordDate;
                    if (record.date && record.date.includes('/')) {
                      const [day, month, yearThai] = record.date.split('/');
                      const yearAD = parseInt(yearThai) - 543;
                      recordDate = new Date(yearAD, parseInt(month) - 1, parseInt(day));
                    } else {
                      recordDate = new Date(record.date);
                    }
                    
                    const dateStr = recordDate.toLocaleDateString('th-TH', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                    
                    // รองรับทั้งรูปแบบเก่า (checkIn/checkOut) และรูปแบบใหม่ (shifts)
                    const shifts = record.shifts || [{
                      checkIn: record.checkIn,
                      checkOut: record.checkOut,
                      status: record.status
                    }]
                    
                    return (
                      <div key={index} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-gray-800">{dateStr}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {shifts.length} {shifts.length === 1 ? 'กะ' : 'กะ'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {shifts.map((shift, shiftIndex) => (
                            <div key={shiftIndex} className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold text-gray-700">
                                  {shifts.length > 1 ? `กะที่ ${shiftIndex + 1}` : 'เวลาทำงาน'}
                                </span>
                                {shift.status && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    shift.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                    shift.status === 'on_time' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {shift.status === 'late' ? 'สาย' :
                                     shift.status === 'on_time' ? 'ตรงเวลา' :
                                     shift.status}
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 mb-1">เข้างาน</p>
                                    <p className="font-bold text-gray-800">
                                      {shift.checkIn || '-'}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 mb-1">ออกงาน</p>
                                    <p className="font-bold text-gray-800">
                                      {shift.checkOut || 'ยังไม่ออกงาน'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {shift.checkIn && shift.checkOut && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">เวลาทำงาน</span>
                                    <span className="font-semibold text-gray-800">
                                      {(() => {
                                        const [inHour, inMin] = shift.checkIn.split(':').map(Number)
                                        const [outHour, outMin] = shift.checkOut.split(':').map(Number)
                                        const totalMinutes = (outHour * 60 + outMin) - (inHour * 60 + inMin)
                                        const hours = Math.floor(totalMinutes / 60)
                                        const minutes = totalMinutes % 60
                                        return `${hours} ชั่วโมง ${minutes} นาที`
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowAttendanceHistory(false)}
                className="w-full bg-gradient-to-r from-brand-primary to-orange-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buddy Check-In Modal */}
      {showBuddyCheckIn && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => {
            setShowBuddyCheckIn(false)
            setBuddyData({ employeeId: '', phone: '' })
            setBuddyError('')
            setBuddySuccess(false)
          }}
        >
          <div 
            className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-brand-primary to-orange-600 p-6">
              <h2 className="text-2xl font-bold text-white">เช็คชื่อแทนเพื่อน</h2>
              <p className="mt-1 text-sm text-white/90">กรุณากรอกข้อมูลเพื่อนของคุณ</p>
            </div>
            
            <div className="p-6 space-y-4">
              {buddySuccess ? (
                <div className="py-8 text-center">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" height="32px" viewBox="0 -960 960 960" width="32px" fill="#22C55E">
                      <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">บันทึกสำเร็จ!</h3>
                  <p className="mt-2 text-gray-600">เช็คชื่อแทนเพื่อนเรียบร้อยแล้ว</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                      รหัสพนักงาน <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={buddyData.employeeId}
                      onChange={(e) => handleBuddyInputChange('employeeId', e.target.value)}
                      placeholder="กรอกรหัสพนักงานเพื่อน"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                      เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={buddyData.phone}
                      onChange={(e) => handleBuddyInputChange('phone', e.target.value)}
                      placeholder="0812345678"
                      maxLength="10"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                    />
                    <p className="mt-1 text-xs text-gray-500">กรอกเบอร์โทรศัพท์ 10 หลัก</p>
                  </div>

                  {buddyError && (
                    <div className="flex items-center p-3 space-x-2 border border-red-200 bg-red-50 rounded-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#EF4444">
                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                      </svg>
                      <p className="text-sm font-medium text-red-600">{buddyError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowBuddyCheckIn(false)
                        setBuddyData({ employeeId: '', phone: '' })
                        setBuddyError('')
                      }}
                      className="flex-1 py-3 font-semibold text-gray-700 transition-colors bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleBuddyCheckIn}
                      className="flex-1 bg-gradient-to-r from-brand-primary to-orange-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                    >
                      ยืนยัน
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Popup */}
      {showInfoPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-8 text-center bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-yellow-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#F59E0B">
                <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-800">แจ้งเตือน</h2>
            <p className="mb-8 text-gray-600">{popupInfoMessage}</p>
            <button
              onClick={() => setShowInfoPopup(false)}
              className="w-full bg-brand-primary text-white py-3 px-6 rounded-xl font-prompt font-medium text-lg shadow-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDashboard